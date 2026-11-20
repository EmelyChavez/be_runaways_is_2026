import { jest } from '@jest/globals';
import { expectHttpExceptionStatus } from './expect-http-exception.js';
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import {
  BookingStatus,
  DepositStatus,
  NotificationEventType,
  OriginModule,
  Prisma,
  Role,
  TransactionType,
} from '../../src/generated/prisma/client.js';
import { BookingsController } from '../../src/bookings/controllers/bookings.controller.js';
import { BookingsService } from '../../src/bookings/services/bookings.service.js';
import { CreateDepositDecisionDto } from '../../src/payments/dto/create-deposit-decision.dto.js';
import { DepositsRepository } from '../../src/payments/repositories/deposits.repository.js';
import { DepositDecisionsService } from '../../src/payments/services/deposit-decisions.service.js';
import { PaymentsService } from '../../src/payments/services/payments.service.js';

describe("H14. Devolución o retención del depósito de garantía", () => {
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const tenantId = 'e75428ba-0c10-4d31-b97b-f4a1b563983e';
  const otherOwnerId = 'c65c3dca-017d-47a4-b445-9d8e6a51b4f7';
  const bookingId = '19be8fb4-81e2-4c84-9ad9-65524817b5ea';
  const depositId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const tx = {};
  const serializableTransaction = jest.fn<(...args: any[]) => any>();
  const findForBooking = jest.fn<(...args: any[]) => any>();
  const findById = jest.fn<(...args: any[]) => any>();
  const findAutoReturnCandidates = jest.fn<(...args: any[]) => any>();
  const updateDecision = jest.fn<(...args: any[]) => any>();
  const createTransaction = jest.fn<(...args: any[]) => any>();
  const emit = jest.fn<(...args: any[]) => any>();
  let service: DepositDecisionsService;

  const makeDeposit = (overrides: Record<string, unknown> = {}) => ({
    id: depositId,
    bookingId,
    amount: new Prisma.Decimal('100.00'),
    state: DepositStatus.PENDING,
    retainedAmount: new Prisma.Decimal('0.00'),
    returnedAmount: new Prisma.Decimal('0.00'),
    decidedAt: null,
    booking: {
      id: bookingId,
      status: BookingStatus.COMPLETED,
      updatedAt: new Date('2026-11-09T12:00:00.000Z'),
      tenantId,
      property: { ownerId, title: 'Casa de campo' },
    },
    ...overrides,
  });

  const makeContext = (handler: Function, role?: Role) => ({
    getHandler: () => handler,
    getClass: () => BookingsController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: ownerId, role } : undefined }) }),
  }) as never;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
    jest.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findForBooking.mockResolvedValue(makeDeposit());
    findById.mockResolvedValue(makeDeposit());
    findAutoReturnCandidates.mockResolvedValue([]);
    updateDecision.mockResolvedValue({ count: 1 });
    createTransaction.mockResolvedValue({ id: 'movement-id' });
    emit.mockResolvedValue({ id: 'notification-id' });
    service = new DepositDecisionsService(
      { serializableTransaction, findForBooking, findById, findAutoReturnCandidates, updateDecision, createTransaction } as never,
      { emit } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  
    it("AC1: devuelve el depósito completo, registra el movimiento y notifica al arrendatario", async () => {
      const result = await service.decide(ownerId, bookingId, { decisionType: 'DEVOLVER' });

      expect(result).toEqual({
        id: depositId,
        bookingId,
        state: DepositStatus.RETURNED,
        amount: '100.00',
        retainedAmount: '0.00',
        returnedAmount: '100.00',
        decidedAt: '2026-11-16T12:00:00.000Z',
      });
      expect(serializableTransaction).toHaveBeenCalledTimes(1);
      expect(updateDecision).toHaveBeenCalledWith(depositId, expect.objectContaining({
        state: DepositStatus.RETURNED,
        decidedById: ownerId,
        retainedAmount: new Prisma.Decimal(0),
        returnedAmount: new Prisma.Decimal('100.00'),
      }), tx);
      expect(createTransaction).toHaveBeenCalledWith(
        bookingId, ownerId, TransactionType.REFUND, new Prisma.Decimal('100.00'),
        'Devolución del depósito de garantía.', tx,
      );
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: tenantId,
        eventType: NotificationEventType.DEPOSIT_RETURNED,
        originModule: OriginModule.PAYMENTS,
        referenceId: bookingId,
        templateData: { amount: '100.00' },
      }));
    });

    it("AC2: retiene el depósito completo y registra el motivo", async () => {
      const result = await service.decide(ownerId, bookingId, {
        decisionType: 'RETENER',
        retentionAmount: '100.00',
        retentionReason: 'Reparación por daño comprobado',
      });

      expect(result).toMatchObject({
        state: DepositStatus.RETAINED,
        retainedAmount: '100.00',
        returnedAmount: '0.00',
      });
      expect(createTransaction).toHaveBeenCalledTimes(1);
      expect(createTransaction).toHaveBeenCalledWith(
        bookingId, ownerId, TransactionType.RETENTION, new Prisma.Decimal('100.00'),
        'Reparación por daño comprobado', tx,
      );
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: tenantId,
        eventType: NotificationEventType.DEPOSIT_RETAINED,
        templateData: { amount: '100.00', reason: 'Reparación por daño comprobado' },
      }));
    });

    it("AC2: retiene parcialmente y registra la retención junto con la devolución del saldo", async () => {
      const result = await service.decide(ownerId, bookingId, {
        decisionType: 'RETENER',
        retentionAmount: '25.00',
        retentionReason: 'Limpieza extraordinaria',
      });

      expect(result).toMatchObject({
        state: DepositStatus.PARTIALLY_RETAINED,
        amount: '100.00',
        retainedAmount: '25.00',
        returnedAmount: '75.00',
      });
      expect(new Prisma.Decimal(result.retainedAmount).add(result.returnedAmount).toFixed(2)).toBe(result.amount);
      expect(createTransaction).toHaveBeenNthCalledWith(
        1, bookingId, ownerId, TransactionType.RETENTION, new Prisma.Decimal('25.00'),
        'Limpieza extraordinaria', tx,
      );
      expect(createTransaction).toHaveBeenNthCalledWith(
        2, bookingId, ownerId, TransactionType.REFUND, new Prisma.Decimal('75.00'),
        'Devolución del saldo restante del depósito.', tx,
      );
    });

    it("AC1: presenta devoluciones y retenciones en el historial privado de la reserva", async () => {
      const findBookingForPayment = jest.fn<(...args: any[]) => any>().mockResolvedValue({
        id: bookingId,
        tenantId,
        property: { ownerId },
      });
      const listTransactions = jest.fn<(...args: any[]) => any>().mockResolvedValue([
        { id: 'refund-id', type: TransactionType.REFUND, amount: new Prisma.Decimal('75.00'), reason: 'Saldo devuelto', createdAt: new Date('2026-11-16T12:00:00.000Z') },
        { id: 'retention-id', type: TransactionType.RETENTION, amount: new Prisma.Decimal('25.00'), reason: 'Daño comprobado', createdAt: new Date('2026-11-16T11:00:00.000Z') },
      ]);
      const paymentsService = new PaymentsService({ findBookingForPayment, listTransactions } as never, {} as never);

      const history = await paymentsService.getTransactionHistory(tenantId, bookingId);

      expect(history.data).toEqual([
        { id: 'refund-id', type: 'DEVOLUCION', amount: '75.00', reason: 'Saldo devuelto', createdAt: '2026-11-16T12:00:00.000Z' },
        { id: 'retention-id', type: 'RETENCION', amount: '25.00', reason: 'Daño comprobado', createdAt: '2026-11-16T11:00:00.000Z' },
      ]);
      expect(listTransactions).toHaveBeenCalledWith(bookingId);
    });

    it("AC1: incluye en las reservas del arrendatario el estado y desglose actualizado del depósito", async () => {
      const listTenantBookings = jest.fn<(...args: any[]) => any>().mockResolvedValue({
        total: 1,
        data: [{
          id: bookingId,
          propertyId: 'property-id',
          tenantId,
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: new Date('2026-11-02T00:00:00.000Z'),
          subtotal: new Prisma.Decimal('50.00'),
          status: BookingStatus.COMPLETED,
          expiresAt: new Date('2026-10-20T12:00:00.000Z'),
          createdAt: new Date('2026-10-19T12:00:00.000Z'),
          property: { title: 'Casa de campo', securityDeposit: new Prisma.Decimal('100.00') },
          deposit: {
            id: depositId,
            amount: new Prisma.Decimal('100.00'),
            state: DepositStatus.PARTIALLY_RETAINED,
            retainedAmount: new Prisma.Decimal('25.00'),
            returnedAmount: new Prisma.Decimal('75.00'),
            decidedAt: new Date('2026-11-16T12:00:00.000Z'),
          },
        }],
      });
      const bookingsService = new BookingsService({ listTenantBookings } as never, {} as never);

      const result = await bookingsService.listMine(tenantId, { page: 1, pageSize: 10 });

      expect(result.data[0].deposit).toEqual({
        id: depositId,
        amount: '100.00',
        state: DepositStatus.PARTIALLY_RETAINED,
        retainedAmount: '25.00',
        returnedAmount: '75.00',
        decidedAt: '2026-11-16T12:00:00.000Z',
      });
    });

    it("AC4: devuelve automáticamente depósitos al cumplirse siete días desde COMPLETED", async () => {
      const now = new Date('2026-11-16T12:00:00.000Z');
      const expiredDeposit = makeDeposit({
        booking: { ...makeDeposit().booking, updatedAt: new Date('2026-11-09T12:00:00.000Z') },
      });
      findAutoReturnCandidates.mockResolvedValueOnce([expiredDeposit]);
      findById.mockResolvedValueOnce(expiredDeposit);

      await service.autoReturnExpiredDeposits(now);

      expect(findAutoReturnCandidates).toHaveBeenCalledWith(new Date('2026-11-09T12:00:00.000Z'));
      expect(updateDecision).toHaveBeenCalledWith(depositId, expect.objectContaining({
        state: DepositStatus.RETURNED,
        decidedById: null,
        retainedAmount: new Prisma.Decimal(0),
        returnedAmount: new Prisma.Decimal('100.00'),
        decidedAt: now,
      }), tx);
      expect(createTransaction).toHaveBeenCalledWith(
        bookingId, null, TransactionType.REFUND, new Prisma.Decimal('100.00'),
        'Plazo de decisión vencido', tx,
      );
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: tenantId,
        eventType: NotificationEventType.DEPOSIT_RETURNED_AUTO,
        templateData: { amount: '100.00' },
      }));
    });

    it("AC3: restringe el endpoint de decisión al rol OWNER", () => {
      const handler = BookingsController.prototype.decideDeposit;
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);

      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.OWNER]);
      expect(guard.canActivate(makeContext(handler, Role.OWNER))).toBe(true);
    });
  

  
    it("AC3: no permite decidir un depósito antes de finalizar la reserva", async () => {
      findForBooking.mockResolvedValueOnce(makeDeposit({
        booking: { ...makeDeposit().booking, status: BookingStatus.PAID },
      }));

      await expect(service.decide(ownerId, bookingId, { decisionType: 'DEVOLVER' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'BOOKING_NOT_FINALIZED' },
      });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC3: no permite que un arrendador decida el depósito de un bien ajeno", async () => {
      findForBooking.mockResolvedValueOnce(makeDeposit({
        booking: { ...makeDeposit().booking, property: { ownerId: otherOwnerId, title: 'Casa ajena' } },
      }));

      await expect(service.decide(ownerId, bookingId, { decisionType: 'DEVOLVER' })).rejects.toBeInstanceOf(NotFoundException);
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC3: responde 404 cuando la reserva no tiene depósito", async () => {
      findForBooking.mockResolvedValueOnce(null);

      await expect(service.decide(ownerId, bookingId, { decisionType: 'DEVOLVER' })).rejects.toBeInstanceOf(NotFoundException);
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it.each([
      ['H14-U11', DepositStatus.RETURNED],
      ['H14-U12', DepositStatus.RETAINED],
      ['H14-U13', DepositStatus.PARTIALLY_RETAINED],
    ])("AC3: %s impide volver a decidir un depósito %s", async (_testId, state) => {
      findForBooking.mockResolvedValueOnce(makeDeposit({ state }));

      await expect(service.decide(ownerId, bookingId, { decisionType: 'DEVOLVER' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'DEPOSIT_ALREADY_DECIDED' },
      });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC3: rechaza una retención de cero con VALIDATION_ERROR", async () => {
      await expect(service.decide(ownerId, bookingId, {
        decisionType: 'RETENER', retentionAmount: '0.00', retentionReason: 'Daño comprobado',
      })).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_ERROR' } });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC3: rechaza una retención mayor que el depósito con VALIDATION_ERROR", async () => {
      await expect(service.decide(ownerId, bookingId, {
        decisionType: 'RETENER', retentionAmount: '100.01', retentionReason: 'Daño comprobado',
      })).rejects.toMatchObject({ status: 400, response: { code: 'VALIDATION_ERROR' } });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it.each([
      ['H14-U16', '-1.00'],
      ['H14-U17', 'no-numérico'],
      ['H14-U18', '1.001'],
    ])("AC3: %s rechaza el monto decimal inválido \"%s\"", async (_testId, retentionAmount) => {
      const dto = plainToInstance(CreateDepositDecisionDto, {
        decisionType: 'RETENER', retentionAmount, retentionReason: 'Daño comprobado',
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it.each([
      ['H14-U19', { decisionType: 'RETENER', retentionReason: 'Daño comprobado' }],
      ['H14-U20', { decisionType: 'RETENER', retentionAmount: '25.00' }],
      ['H14-U21', { decisionType: 'RETENER', retentionAmount: '25.00', retentionReason: '' }],
      ['H14-U22', { decisionType: 'RETENER', retentionAmount: '25.00', retentionReason: '   ' }],
    ])("AC2: %s requiere un monto y motivo válido para retener", async (_testId, data) => {
      const dto = plainToInstance(CreateDepositDecisionDto, data);
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it("AC2: rechaza un motivo de más de 250 caracteres", async () => {
      const dto = plainToInstance(CreateDepositDecisionDto, {
        decisionType: 'RETENER', retentionAmount: '25.00', retentionReason: 'x'.repeat(251),
      });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it("AC2: solo acepta DEVOLVER o RETENER como decisión", async () => {
      const dto = plainToInstance(CreateDepositDecisionDto, { decisionType: 'APROBAR' });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it("AC2: responde 403 a TENANT y ADMIN, y 401 cuando falta la sesión", async () => {
      const handler = BookingsController.prototype.decideDeposit;
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);

      for (const role of [Role.TENANT, Role.ADMIN]) {
        expectHttpExceptionStatus(() => guard.canActivate(makeContext(handler, role)), 403);
      }
      expectHttpExceptionStatus(() => guard.canActivate(makeContext(handler)), 401);

      const jwtGuard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const context = {
        getHandler: () => handler,
        getClass: () => BookingsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(jwtGuard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it("AC3: rechaza un UUID inválido en el parámetro de reserva con 400", async () => {
      const pipe = new (await import('@nestjs/common')).ParseUUIDPipe();
      await expect(pipe.transform('no-es-uuid', {
        type: 'param', metatype: String, data: 'id',
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("AC3: conserva pendiente el depósito antes de cumplir siete días", async () => {
      findAutoReturnCandidates.mockResolvedValueOnce([]);

      await service.autoReturnExpiredDeposits(new Date('2026-11-16T11:59:59.999Z'));

      expect(findAutoReturnCandidates).toHaveBeenCalledWith(new Date('2026-11-09T11:59:59.999Z'));
      expect(serializableTransaction).not.toHaveBeenCalled();
      expect(createTransaction).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it("AC4: consulta solo depósitos pendientes positivos de reservas completadas vencidas", async () => {
      const findMany = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
      const repository = new DepositsRepository({ deposit: { findMany } } as never);
      const deadline = new Date('2026-11-09T12:00:00.000Z');

      await repository.findAutoReturnCandidates(deadline);

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          state: DepositStatus.PENDING,
          amount: { gt: new Prisma.Decimal(0) },
          booking: { status: BookingStatus.COMPLETED, updatedAt: { lte: deadline } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }));
    });

    it("AC4: evita un segundo movimiento si otra decisión gana la carrera", async () => {
      findForBooking
        .mockResolvedValueOnce(makeDeposit())
        .mockResolvedValueOnce(makeDeposit());
      updateDecision.mockResolvedValueOnce({ count: 0 });

      await expect(service.decide(ownerId, bookingId, { decisionType: 'DEVOLVER' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'DEPOSIT_ALREADY_DECIDED' },
      });
      expect(updateDecision).toHaveBeenCalledTimes(1);
      expect(createTransaction).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  
});
