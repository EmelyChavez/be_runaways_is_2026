import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationEventType, OriginModule, Prisma, TransactionType } from '@PrismaClient';
import { NotificationsService } from '@Notifications/services';
import type { CreatePaymentDto } from '@Payments/dto';
import { PaymentsRepository } from '@Payments/repositories';

const SIMULATED_PROCESSING_DELAY_MS = 2_000;
const PAYMENT_DECLINED_LAST4 = '0002';
const PAYMENT_CHARGE_REASON = 'Cobro del alquiler y depósito de garantía.';

type PaymentBookingContext = NonNullable<Awaited<ReturnType<PaymentsRepository['findBookingForPayment']>>>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSummary(tenantId: string, bookingId: string) {
    const booking = await this.paymentsRepository.findBookingForPayment(bookingId);
    this.assertPayable(booking, tenantId, new Date());
    this.assertVerifiedIfRequired(booking);

    const days = this.getInclusiveDays(booking.startDate, booking.endDate);
    const rentalAmount = new Prisma.Decimal(booking.subtotal.toString()).toDecimalPlaces(2);
    const depositAmount = new Prisma.Decimal(booking.property.securityDeposit.toString()).toDecimalPlaces(2);
    return {
      bookingId: booking.id,
      propertyTitle: booking.property.title,
      startDate: booking.startDate.toISOString().slice(0, 10),
      endDate: booking.endDate.toISOString().slice(0, 10),
      days,
      pricePerDay: booking.property.pricePerDay.toFixed(2),
      rentalAmount: rentalAmount.toFixed(2),
      depositAmount: depositAmount.toFixed(2),
      totalAmount: rentalAmount.add(depositAmount).toFixed(2),
      expiresAt: booking.expiresAt.toISOString(),
    };
  }

  async pay(tenantId: string, dto: CreatePaymentDto) {
    const initialBooking = await this.paymentsRepository.findBookingForPayment(dto.bookingId);
    this.assertPayable(initialBooking, tenantId, new Date());
    this.assertVerifiedIfRequired(initialBooking);

    await new Promise<void>((resolve) => setTimeout(resolve, SIMULATED_PROCESSING_DELAY_MS));
    if (dto.last4Digits === PAYMENT_DECLINED_LAST4) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_FUNDS',
        message: 'Fondos insuficientes. Intenta con otra tarjeta',
      });
    }

    try {
      const result = await this.paymentsRepository.serializableTransaction(async (transaction) => {
        const booking = await this.paymentsRepository.findBookingForPayment(dto.bookingId, transaction);
        const now = new Date();
        this.assertPayable(booking, tenantId, now);
        this.assertVerifiedIfRequired(booking);

        const updated = await this.paymentsRepository.markBookingPaid(booking.id, tenantId, now, transaction);
        if (updated.count !== 1) {
          const latest = await this.paymentsRepository.findBookingForPayment(booking.id, transaction);
          this.assertPayable(latest, tenantId, now);
          throw this.bookingNotPayable();
        }

        const rentalAmount = new Prisma.Decimal(booking.subtotal.toString()).toDecimalPlaces(2);
        const depositAmount = new Prisma.Decimal(booking.property.securityDeposit.toString()).toDecimalPlaces(2);
        const totalAmount = rentalAmount.add(depositAmount).toDecimalPlaces(2);
        const receiptNumber = `PAY-${randomUUID().toUpperCase()}`;
        const payment = await this.paymentsRepository.createPayment({
          bookingId: booking.id,
          payerId: tenantId,
          receiptNumber,
          rentalAmount,
          depositAmount,
          totalAmount,
          last4Digits: dto.last4Digits,
        }, transaction);
        await this.paymentsRepository.createDeposit(booking.id, depositAmount, transaction);
        await this.paymentsRepository.createChargeHistory(
          booking.id,
          tenantId,
          totalAmount,
          PAYMENT_CHARGE_REASON,
          transaction,
        );

        return { booking, payment, rentalAmount, depositAmount, totalAmount };
      });

      await this.notificationsService.emit({
        recipientId: result.booking.property.ownerId,
        eventType: NotificationEventType.PAYMENT_CONFIRMED,
        originModule: OriginModule.PAYMENTS,
        referenceId: result.booking.id,
        templateData: { propertyName: result.booking.property.title },
        title: 'Pago de reserva confirmado',
        message: `El pago por la reserva del bien "${result.booking.property.title}" ha sido procesado exitosamente.`,
      });

      return {
        receiptNumber: result.payment.receiptNumber,
        bookingId: result.booking.id,
        paymentDate: result.payment.createdAt.toISOString(),
        propertyTitle: result.booking.property.title,
        startDate: result.booking.startDate.toISOString().slice(0, 10),
        endDate: result.booking.endDate.toISOString().slice(0, 10),
        days: this.getInclusiveDays(result.booking.startDate, result.booking.endDate),
        pricePerDay: result.booking.property.pricePerDay.toFixed(2),
        rentalAmount: result.rentalAmount.toFixed(2),
        depositAmount: result.depositAmount.toFixed(2),
        totalAmount: result.totalAmount.toFixed(2),
        last4Digits: result.payment.last4Digits,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        const latest = await this.paymentsRepository.findBookingForPayment(dto.bookingId);
        if (latest?.status === 'PAID') throw this.alreadyPaid();
        throw this.bookingNotPayable();
      }
      throw error;
    }
  }

  async getTransactionHistory(userId: string, bookingId: string) {
    const booking = await this.paymentsRepository.findBookingForPayment(bookingId);
    if (!booking) throw this.bookingNotFound();
    if (booking.tenantId !== userId && booking.property.ownerId !== userId) throw this.bookingNotFound();

    const transactions = await this.paymentsRepository.listTransactions(bookingId);
    return {
      bookingId,
      data: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type === TransactionType.CHARGE
          ? 'COBRO' as const
          : transaction.type === TransactionType.REFUND
            ? 'DEVOLUCION' as const
            : 'RETENCION' as const,
        amount: transaction.amount.toFixed(2),
        reason: transaction.reason,
        createdAt: transaction.createdAt.toISOString(),
      })),
    };
  }

  private assertPayable(
    booking: PaymentBookingContext | null,
    tenantId: string,
    now: Date,
  ): asserts booking is PaymentBookingContext {
    if (!booking || booking.tenantId !== tenantId) throw this.bookingNotFound();
    if (booking.status === 'PAID') throw this.alreadyPaid();
    if (booking.status !== 'PENDING' || booking.expiresAt <= now) throw this.bookingNotPayable();
  }

  private assertVerifiedIfRequired(booking: PaymentBookingContext) {
    if (!booking.tenant.profile?.isVerified) {
      throw new ForbiddenException({
        code: 'VERIFICATION_REQUIRED',
        message: 'Debes verificar tu cuenta para rentar.',
      });
    }
  }

  private getInclusiveDays(startDate: Date, endDate: Date): number {
    return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  }

  private bookingNotFound(): NotFoundException {
    return new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'La reserva no existe.' });
  }

  private bookingNotPayable(): ConflictException {
    return new ConflictException({ code: 'BOOKING_NOT_PAYABLE', message: 'La reserva no se puede pagar porque está cancelada o vencida.' });
  }

  private alreadyPaid(): ConflictException {
    return new ConflictException({ code: 'ALREADY_PAID', message: 'La reserva ya fue pagada.' });
  }
}
