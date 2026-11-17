import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DepositStatus, NotificationEventType, OriginModule, Prisma, TransactionType } from '@PrismaClient';
import { NotificationsService } from '@Notifications/services';
import type { CreateDepositDecisionDto } from '@Payments/dto';
import { DepositsRepository } from '@Payments/repositories';

const AUTO_RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_RETURN_SCAN_INTERVAL_MS = 60 * 1000;
const AUTO_RETURN_REASON = 'Plazo de decisión vencido';
const DEPOSIT_REFUND_REASON = 'Devolución del depósito de garantía.';
const PARTIAL_REFUND_REASON = 'Devolución del saldo restante del depósito.';

type DepositDecisionContext = NonNullable<Awaited<ReturnType<DepositsRepository['findForBooking']>>>;

@Injectable()
export class DepositDecisionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DepositDecisionsService.name);
  private autoReturnTimer?: NodeJS.Timeout;

  constructor(
    private readonly depositsRepository: DepositsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.autoReturnTimer = setInterval(() => {
      void this.autoReturnExpiredDeposits().catch((error: unknown) => {
        this.logger.error('No se pudieron devolver los depósitos cuyo plazo venció.', error);
      });
    }, AUTO_RETURN_SCAN_INTERVAL_MS);
    this.autoReturnTimer.unref();
    void this.autoReturnExpiredDeposits().catch((error: unknown) => {
      this.logger.error('No se pudieron procesar los depósitos vencidos.', error);
    });
  }

  onModuleDestroy(): void {
    if (this.autoReturnTimer) clearInterval(this.autoReturnTimer);
  }

  async decide(ownerId: string, bookingId: string, dto: CreateDepositDecisionDto) {
    const deposit = await this.depositsRepository.findForBooking(bookingId);
    this.assertOwnedAndEligible(deposit, ownerId);

    const amount = new Prisma.Decimal(deposit.amount.toString()).toDecimalPlaces(2);
    if (amount.lte(0)) {
      throw new ConflictException({
        code: 'DEPOSIT_NOT_ELIGIBLE',
        message: 'La reserva no tiene un depósito disponible para decidir.',
      });
    }

    const returning = dto.decisionType === 'DEVOLVER';
    const retainedAmount = returning ? new Prisma.Decimal(0) : this.parseRetentionAmount(dto.retentionAmount);
    if (!returning && (retainedAmount.lte(0) || retainedAmount.gt(amount))) {
      throw this.invalidRetentionAmount();
    }
    const returnedAmount = amount.sub(retainedAmount).toDecimalPlaces(2);
    const state = returning
      ? DepositStatus.RETURNED
      : retainedAmount.equals(amount)
        ? DepositStatus.RETAINED
        : DepositStatus.PARTIALLY_RETAINED;
    const decidedAt = new Date();
    const retentionReason = dto.retentionReason?.trim();

    try {
      await this.depositsRepository.serializableTransaction(async (transaction) => {
        const current = await this.depositsRepository.findForBooking(bookingId, transaction);
        this.assertOwnedAndEligible(current, ownerId);

        const updated = await this.depositsRepository.updateDecision(current.id, {
          state,
          decidedById: ownerId,
          retainedAmount,
          returnedAmount,
          decidedAt,
        }, transaction);
        if (updated.count !== 1) throw this.alreadyDecided();

        if (returning) {
          await this.depositsRepository.createTransaction(
            bookingId,
            ownerId,
            TransactionType.REFUND,
            amount,
            DEPOSIT_REFUND_REASON,
            transaction,
          );
          return;
        }

        await this.depositsRepository.createTransaction(
          bookingId,
          ownerId,
          TransactionType.RETENTION,
          retainedAmount,
          retentionReason!,
          transaction,
        );
        if (returnedAmount.gt(0)) {
          await this.depositsRepository.createTransaction(
            bookingId,
            ownerId,
            TransactionType.REFUND,
            returnedAmount,
            PARTIAL_REFUND_REASON,
            transaction,
          );
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw this.alreadyDecided();
      }
      throw error;
    }

    await this.notifyTenant(deposit, {
      eventType: returning ? NotificationEventType.DEPOSIT_RETURNED : NotificationEventType.DEPOSIT_RETAINED,
      amount: returning ? returnedAmount : retainedAmount,
      ...(retentionReason && { reason: retentionReason }),
    });

    return {
      id: deposit.id,
      bookingId,
      state,
      amount: amount.toFixed(2),
      retainedAmount: retainedAmount.toFixed(2),
      returnedAmount: returnedAmount.toFixed(2),
      decidedAt: decidedAt.toISOString(),
    };
  }

  async autoReturnExpiredDeposits(now = new Date()): Promise<void> {
    const decisionDeadline = new Date(now.getTime() - AUTO_RETURN_WINDOW_MS);
    const candidates = await this.depositsRepository.findAutoReturnCandidates(decisionDeadline);

    for (const candidate of candidates) {
      try {
        const returned = await this.depositsRepository.serializableTransaction(async (transaction) => {
          const current = await this.depositsRepository.findById(candidate.id, transaction);
          if (!current || current.state !== DepositStatus.PENDING ||
            current.booking.status !== 'COMPLETED' || current.booking.updatedAt > decisionDeadline) {
            return false;
          }

          const amount = new Prisma.Decimal(current.amount.toString()).toDecimalPlaces(2);
          if (amount.lte(0)) return false;
          const decidedAt = now;
          const updated = await this.depositsRepository.updateDecision(current.id, {
            state: DepositStatus.RETURNED,
            decidedById: null,
            retainedAmount: new Prisma.Decimal(0),
            returnedAmount: amount,
            decidedAt,
          }, transaction);
          if (updated.count !== 1) return false;

          await this.depositsRepository.createTransaction(
            current.booking.id,
            null,
            TransactionType.REFUND,
            amount,
            AUTO_RETURN_REASON,
            transaction,
          );
          return true;
        });

        if (returned) {
          await this.notifyTenant(candidate, {
            eventType: NotificationEventType.DEPOSIT_RETURNED_AUTO,
            amount: new Prisma.Decimal(candidate.amount.toString()),
          });
        }
      } catch (error) {
        this.logger.error(`No se pudo procesar la devolución automática del depósito ${candidate.id}.`, error);
      }
    }
  }

  private assertOwnedAndEligible(deposit: DepositDecisionContext | null, ownerId: string): asserts deposit is DepositDecisionContext {
    if (!deposit || deposit.booking.property.ownerId !== ownerId) {
      throw new NotFoundException({ code: 'DEPOSIT_NOT_FOUND', message: 'El depósito no existe.' });
    }
    if (deposit.booking.status !== 'COMPLETED') {
      throw new ConflictException({
        code: 'BOOKING_NOT_FINALIZED',
        message: 'Solo se puede decidir el depósito de una reserva finalizada.',
      });
    }
    if (deposit.state !== DepositStatus.PENDING) throw this.alreadyDecided();
  }

  private parseRetentionAmount(value?: string): Prisma.Decimal {
    if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) throw this.invalidRetentionAmount();
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  }

  private invalidRetentionAmount(): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'El monto a retener debe ser mayor que cero y no superar el depósito.',
    });
  }

  private alreadyDecided(): ConflictException {
    return new ConflictException({
      code: 'DEPOSIT_ALREADY_DECIDED',
      message: 'Este depósito ya tiene una decisión registrada.',
    });
  }

  private async notifyTenant(
    deposit: Pick<DepositDecisionContext, 'booking'>,
    data: { eventType: NotificationEventType; amount: Prisma.Decimal; reason?: string },
  ) {
    const amount = data.amount.toFixed(2);
    await this.notificationsService.emit({
      recipientId: deposit.booking.tenantId,
      eventType: data.eventType,
      originModule: OriginModule.PAYMENTS,
      referenceId: deposit.booking.id,
      templateData: { amount, ...(data.reason && { reason: data.reason }) },
      title: data.eventType === NotificationEventType.DEPOSIT_RETAINED
        ? 'Depósito de garantía retenido'
        : 'Depósito de garantía devuelto',
      message: `La decisión de depósito para el bien "${deposit.booking.property.title}" fue registrada.`,
    });
  }
}
