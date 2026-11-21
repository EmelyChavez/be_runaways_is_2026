import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  BookingStatus,
  NotificationEventType,
  OriginModule,
  Prisma,
} from '@PrismaClient';
import { NotificationsService } from '@Notifications/services';
import type { BookingQueryDto, CreateBookingDto, OwnerBookingQueryDto } from '@Bookings/dto';
import { BookingsRepository } from '@Bookings/repositories';
import { getTodayInElSalvador } from '../booking-dates.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_BOOKING_DAYS = 30;
const BOOKING_HORIZON_DAYS = 90;
const EXPIRATION_SCAN_INTERVAL_MS = 30 * 1000;

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsService.name);
  private expirationTimer?: NodeJS.Timeout;

  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.expirationTimer = setInterval(() => {
      void this.processBookingLifecycle().catch((error: unknown) => {
        this.logger.error('No se pudo procesar el ciclo de vida de las reservas.', error);
      });
    }, EXPIRATION_SCAN_INTERVAL_MS);
    this.expirationTimer.unref();
    void this.processBookingLifecycle().catch((error: unknown) => {
      this.logger.error('No se pudo procesar el ciclo de vida de las reservas.', error);
    });
  }

  onModuleDestroy(): void {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
  }

  async create(tenantId: string, dto: CreateBookingDto) {
    const { startDate, endDate, days } = this.validatePeriod(dto.startDate, dto.endDate);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS);

    try {
      const result = await this.bookingsRepository.serializableTransaction(async (transaction) => {
        const property = await this.bookingsRepository.findAvailableProperty(dto.propertyId, transaction);
        if (!property) {
          throw new NotFoundException({
            code: 'PROPERTY_NOT_AVAILABLE',
            message: 'Este bien no existe o no está disponible',
          });
        }

        const profile = await this.bookingsRepository.findVerifiedProfile(tenantId, transaction);
        if (!profile?.isVerified) {
          throw new ForbiddenException({
            code: 'VERIFICATION_REQUIRED',
            message: 'Debes verificar tu cuenta para rentar.',
          });
        }

        const [overlappingBooking, overlappingBlock] = await Promise.all([
          this.bookingsRepository.findOverlappingActiveBooking(
            property.id,
            startDate,
            endDate,
            now,
            transaction,
          ),
          this.bookingsRepository.findOverlappingBlock(property.id, startDate, endDate, transaction),
        ]);
        if (overlappingBooking || overlappingBlock) {
          throw this.datesUnavailable();
        }

        const subtotal = new Prisma.Decimal(property.pricePerDay.toString()).mul(days).toDecimalPlaces(2);
        const booking = await this.bookingsRepository.createPendingBooking(
          {
            propertyId: property.id,
            tenantId,
            startDate,
            endDate,
            expiresAt,
            subtotal,
          },
          transaction,
        );
        return { booking, property };
      });

      await this.notificationsService.emit({
        recipientId: result.property.ownerId,
        eventType: NotificationEventType.RESERVATION_CREATED,
        originModule: OriginModule.RESERVATIONS,
        referenceId: result.booking.id,
        templateData: { propertyName: result.property.title },
        title: 'Nueva solicitud de reserva',
        message: `Se ha registrado una nueva reserva para tu bien "${result.property.title}".`,
      });

      return {
        ...this.serializeBooking(result.booking),
        message: 'Reserva creada. Tienes 24 horas para pagarla.',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw this.datesUnavailable();
      }
      throw error;
    }
  }

  async listMine(tenantId: string, query: BookingQueryDto) {
    const result = await this.bookingsRepository.listTenantBookings(tenantId, query);
    return {
      data: result.data.map((booking) => ({
        ...this.serializeBooking(booking),
        hasPropertyReview: booking.reviews.length > 0,
      })),
      total: result.total,
      page: query.page,
    };
  }

  async listForOwner(ownerId: string, query: OwnerBookingQueryDto) {
    const result = await this.bookingsRepository.listOwnerBookings(ownerId, query);
    const ratings = await this.bookingsRepository.getRenterRatings(
      [...new Set(result.data.map((booking) => booking.tenantId))],
    );
    const ratingsByTenant = new Map(ratings.map((rating) => [rating.targetUserId, rating]));
    return {
      data: result.data.map((booking) => {
        const renterRating = ratingsByTenant.get(booking.tenantId);
        return {
          ...this.serializeBooking(booking),
          hasRenterReview: booking.reviews.length > 0,
          tenant: {
            ...booking.tenant,
            rating: {
              average: renterRating?._avg.userRating == null
                ? null
                : Math.round(renterRating._avg.userRating * 10) / 10,
              count: renterRating?._count._all ?? 0,
            },
          },
        };
      }),
      total: result.total,
      page: query.page,
    };
  }

  async expirePendingBookings(now = new Date()): Promise<void> {
    const expired = await this.bookingsRepository.cancelExpiredPendingBookings(now);
    for (const booking of expired) {
      const templateData = { propertyName: booking.propertyTitle };
      await Promise.all([
        this.notificationsService.emit({
          recipientId: booking.tenantId,
          eventType: NotificationEventType.RESERVATION_CANCELED_EXPIRED,
          originModule: OriginModule.RESERVATIONS,
          referenceId: booking.id,
          templateData,
          title: 'Reserva cancelada',
          message: `La reserva del bien "${booking.propertyTitle}" fue cancelada automáticamente por falta de pago dentro del tiempo límite.`,
        }),
        this.notificationsService.emit({
          recipientId: booking.ownerId,
          eventType: NotificationEventType.RESERVATION_CANCELED_EXPIRED,
          originModule: OriginModule.RESERVATIONS,
          referenceId: booking.id,
          templateData,
          title: 'Reserva cancelada',
          message: `La reserva del bien "${booking.propertyTitle}" fue cancelada automáticamente por falta de pago dentro del tiempo límite.`,
        }),
      ]);
    }
  }

  async completeExpiredPaidBookings(now = new Date()): Promise<void> {
    const today = this.getTodayInElSalvador(now);
    const completed = await this.bookingsRepository.completeExpiredPaidBookings(today);
    for (const booking of completed) {
      await this.notificationsService.emit({
        recipientId: booking.tenantId,
        eventType: NotificationEventType.RESERVATION_FINISHED,
        originModule: OriginModule.RESERVATIONS,
        referenceId: booking.id,
        templateData: { propertyName: booking.propertyTitle },
        title: 'Reserva finalizada',
        message: `La reserva del bien "${booking.propertyTitle}" ha sido marcada como finalizada.`,
      });
    }
  }

  private async processBookingLifecycle(): Promise<void> {
    await this.expirePendingBookings();
    await this.completeExpiredPaidBookings();
  }

  private validatePeriod(start: string, end: string) {
    if (!this.isDateOnly(start) || !this.isDateOnly(end)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Las fechas deben usar el formato YYYY-MM-DD.' });
    }
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    if (startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Las fechas indicadas no son válidas.' });
    }
    if (endDate < startDate) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
    }

    const days = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    if (days > MAX_BOOKING_DAYS) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'El periodo de reserva no puede superar 30 días.' });
    }

    const today = this.getTodayInElSalvador();
    const lastBookableDate = new Date(today);
    lastBookableDate.setUTCDate(lastBookableDate.getUTCDate() + BOOKING_HORIZON_DAYS - 1);
    if (startDate < today || endDate > lastBookableDate) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Las fechas deben estar dentro de los próximos 90 días.' });
    }

    return { startDate, endDate, days };
  }

  private isDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private getTodayInElSalvador(now = new Date()): Date {
    return getTodayInElSalvador(now);
  }

  private serializeBooking<T extends {
    id: string;
    propertyId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    subtotal: Prisma.Decimal;
    status: BookingStatus;
    expiresAt: Date;
    createdAt?: Date;
    property?: { title: string; securityDeposit: Prisma.Decimal };
    reviews?: Array<{ id: string }>;
    deposit?: {
      id: string;
      amount: Prisma.Decimal;
      state: string;
      retainedAmount: Prisma.Decimal;
      returnedAmount: Prisma.Decimal;
      decidedAt: Date | null;
    } | null;
  }>(booking: T) {
    return {
      id: booking.id,
      propertyId: booking.propertyId,
      tenantId: booking.tenantId,
      startDate: booking.startDate.toISOString().slice(0, 10),
      endDate: booking.endDate.toISOString().slice(0, 10),
      subtotal: booking.subtotal.toFixed(2),
      status: booking.status,
      expiresAt: booking.expiresAt.toISOString(),
      ...(booking.createdAt && { createdAt: booking.createdAt.toISOString() }),
      ...(booking.property && {
        property: {
          title: booking.property.title,
          securityDeposit: booking.property.securityDeposit.toFixed(2),
        },
      }),
      ...(booking.deposit && {
        deposit: {
          id: booking.deposit.id,
          amount: booking.deposit.amount.toFixed(2),
          state: booking.deposit.state,
          retainedAmount: booking.deposit.retainedAmount.toFixed(2),
          returnedAmount: booking.deposit.returnedAmount.toFixed(2),
          decidedAt: booking.deposit.decidedAt?.toISOString() ?? null,
        },
      }),
    };
  }

  private datesUnavailable(): ConflictException {
    return new ConflictException({
      code: 'DATES_UNAVAILABLE',
      message: 'Estas fechas ya no están disponibles. Elige otras.',
    });
  }
}
