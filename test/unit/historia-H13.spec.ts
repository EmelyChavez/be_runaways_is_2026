import { jest } from '@jest/globals';
import { expectHttpExceptionStatus } from './expect-http-exception.js';
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingStatus, Prisma, Role, TransactionType } from '../../src/generated/prisma/client.js';
import { BookingTransactionsController, PaymentsController } from '../../src/payments/controllers/payments.controller.js';
import { CreatePaymentDto } from '../../src/payments/dto/create-payment.dto.js';
import { PaymentsRepository } from '../../src/payments/repositories/payments.repository.js';
import { PaymentsService } from '../../src/payments/services/payments.service.js';

describe("H13. Pago de alquiler con detalle del depósito", () => {
  const tenantId = 'e75428ba-0c10-4d31-b97b-f4a1b563983e';
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const otherUserId = 'c65c3dca-017d-47a4-b445-9d8e6a51b4f7';
  const bookingId = '19be8fb4-81e2-4c84-9ad9-65524817b5ea';
  const tx = {};
  const serializableTransaction = jest.fn<(...args: any[]) => any>();
  const findBookingForPayment = jest.fn<(...args: any[]) => any>();
  const markBookingPaid = jest.fn<(...args: any[]) => any>();
  const createPayment = jest.fn<(...args: any[]) => any>();
  const createDeposit = jest.fn<(...args: any[]) => any>();
  const createChargeHistory = jest.fn<(...args: any[]) => any>();
  const listTransactions = jest.fn<(...args: any[]) => any>();
  const emit = jest.fn<(...args: any[]) => any>();
  let service: PaymentsService;

  const makeBooking = (overrides: Record<string, unknown> = {}) => ({
    id: bookingId,
    tenantId,
    startDate: new Date('2026-11-20T00:00:00.000Z'),
    endDate: new Date('2026-11-22T00:00:00.000Z'),
    subtotal: new Prisma.Decimal('150.00'),
    status: BookingStatus.PENDING,
    expiresAt: new Date('2026-11-17T18:00:00.000Z'),
    tenant: { profile: { isVerified: true } },
    property: {
      id: '1d4f3fa0-bb7d-4c31-9b19-87324a78e114',
      title: 'Casa de campo',
      ownerId,
      pricePerDay: new Prisma.Decimal('50.00'),
      securityDeposit: new Prisma.Decimal('100.00'),
      verifiedOnly: false,
    },
    ...overrides,
  });

  const makeContext = (handler: Function, role?: Role) => ({
    getHandler: () => handler,
    getClass: () => PaymentsController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: tenantId, role } : undefined }) }),
  }) as never;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
    jest.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findBookingForPayment.mockResolvedValue(makeBooking());
    markBookingPaid.mockResolvedValue({ count: 1 });
    createPayment.mockResolvedValue({
      receiptNumber: 'PAY-RECEIPT-01',
      last4Digits: '4242',
      createdAt: new Date('2026-11-16T18:00:02.000Z'),
    });
    createDeposit.mockResolvedValue({});
    createChargeHistory.mockResolvedValue({});
    listTransactions.mockResolvedValue([]);
    emit.mockResolvedValue({ id: 'notification-id' });
    service = new PaymentsService(
      {
        serializableTransaction,
        findBookingForPayment,
        markBookingPaid,
        createPayment,
        createDeposit,
        createChargeHistory,
        listTransactions,
      } as never,
      { emit } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  
    it("AC1: calcula el resumen de pago con días inclusivos y montos a dos decimales", async () => {
      const result = await service.getSummary(tenantId, bookingId);

      expect(result).toEqual({
        bookingId,
        propertyTitle: 'Casa de campo',
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        days: 3,
        pricePerDay: '50.00',
        rentalAmount: '150.00',
        depositAmount: '100.00',
        totalAmount: '250.00',
        expiresAt: '2026-11-17T18:00:00.000Z',
      });
      expect(findBookingForPayment).toHaveBeenCalledWith(bookingId);
    });

    it("AC2: espera dos segundos, aprueba 4242, registra el cobro y devuelve el comprobante", async () => {
      const paymentPromise = service.pay(tenantId, { bookingId, last4Digits: '4242' });

      expect(markBookingPaid).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(2_000);
      const receipt = await paymentPromise;

      expect(receipt).toEqual({
        receiptNumber: 'PAY-RECEIPT-01',
        bookingId,
        paymentDate: '2026-11-16T18:00:02.000Z',
        propertyTitle: 'Casa de campo',
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        days: 3,
        pricePerDay: '50.00',
        rentalAmount: '150.00',
        depositAmount: '100.00',
        totalAmount: '250.00',
        last4Digits: '4242',
      });
      expect(serializableTransaction).toHaveBeenCalledTimes(1);
      expect(markBookingPaid).toHaveBeenCalledWith(bookingId, tenantId, expect.any(Date), tx);
      expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({
        bookingId,
        payerId: tenantId,
        rentalAmount: new Prisma.Decimal('150.00'),
        depositAmount: new Prisma.Decimal('100.00'),
        totalAmount: new Prisma.Decimal('250.00'),
        last4Digits: '4242',
      }), tx);
      expect(createDeposit).toHaveBeenCalledWith(bookingId, new Prisma.Decimal('100.00'), tx);
      expect(createChargeHistory).toHaveBeenCalledWith(
        bookingId,
        tenantId,
        new Prisma.Decimal('250.00'),
        expect.any(String),
        tx,
      );
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: ownerId,
        referenceId: bookingId,
      }));
    });

    it("AC3: permite al arrendatario consultar los movimientos de su reserva", async () => {
      listTransactions.mockResolvedValueOnce([
        { id: 'movement-new', type: TransactionType.CHARGE, amount: new Prisma.Decimal('250.00'), reason: 'Cobro del alquiler.', createdAt: new Date('2026-11-16T18:00:02.000Z') },
      ]);

      const result = await service.getTransactionHistory(tenantId, bookingId);

      expect(result).toEqual({
        bookingId,
        data: [{
          id: 'movement-new',
          type: 'COBRO',
          amount: '250.00',
          reason: 'Cobro del alquiler.',
          createdAt: '2026-11-16T18:00:02.000Z',
        }],
      });
      expect(listTransactions).toHaveBeenCalledWith(bookingId);
    });

    it("AC3: permite al arrendador del bien consultar movimientos recientes primero", async () => {
      listTransactions.mockResolvedValueOnce([
        { id: 'movement-new', type: TransactionType.CHARGE, amount: new Prisma.Decimal('250.00'), reason: 'Cobro nuevo.', createdAt: new Date('2026-11-16T18:00:02.000Z') },
        { id: 'movement-old', type: TransactionType.REFUND, amount: new Prisma.Decimal('100.00'), reason: 'Movimiento anterior.', createdAt: new Date('2026-11-15T18:00:02.000Z') },
      ]);

      const result = await service.getTransactionHistory(ownerId, bookingId);

      expect(result.data.map(({ id }) => id)).toEqual(['movement-new', 'movement-old']);
      expect(listTransactions).toHaveBeenCalledWith(bookingId);
    });

    it("AC4: declara TENANT para consultar el resumen y procesar pagos", () => {
      const handlers = [PaymentsController.prototype.getSummary, PaymentsController.prototype.pay];
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);

      for (const handler of handlers) {
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.TENANT]);
        expect(guard.canActivate(makeContext(handler, Role.TENANT))).toBe(true);
      }
    });

    it("AC3: ordena el historial de Prisma del más reciente al más antiguo", async () => {
      const findMany = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
      const repository = new PaymentsRepository({ transactionHistory: { findMany } } as never);

      await repository.listTransactions(bookingId);

      expect(findMany).toHaveBeenCalledWith({
        where: { bookingId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });
  

  
    it("AC2: rechaza 0002 con el mensaje indicado sin cambiar la reserva", async () => {
      const paymentPromise = service.pay(tenantId, { bookingId, last4Digits: '0002' });
      const rejection = expect(paymentPromise).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Fondos insuficientes. Intenta con otra tarjeta',
        },
      });
      await jest.advanceTimersByTimeAsync(2_000);

      await rejection;
      expect(serializableTransaction).not.toHaveBeenCalled();
      expect(markBookingPaid).not.toHaveBeenCalled();
      expect(createPayment).not.toHaveBeenCalled();
      expect(createDeposit).not.toHaveBeenCalled();
      expect(createChargeHistory).not.toHaveBeenCalled();
    });

    it.each([
      ['H13-U08', 'cancelada', BookingStatus.CANCELED],
      ['H13-U09', 'vencida', BookingStatus.PENDING],
    ])("AC4: %s no permite consultar resumen de una reserva %s", async (_testId, description, status) => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({
        status,
        expiresAt: description === 'vencida' ? new Date('2026-11-16T17:59:59.000Z') : new Date('2026-11-17T18:00:00.000Z'),
      }));

      await expect(service.getSummary(tenantId, bookingId)).rejects.toMatchObject({ status: 409 });
    });

    it.each([
      ['H13-U10', 'cancelada', BookingStatus.CANCELED],
      ['H13-U11', 'vencida', BookingStatus.PENDING],
    ])("AC4: %s no permite pagar una reserva %s ni genera registros", async (_testId, description, status) => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({
        status,
        expiresAt: description === 'vencida' ? new Date('2026-11-16T17:59:59.000Z') : new Date('2026-11-17T18:00:00.000Z'),
      }));

      await expect(service.pay(tenantId, { bookingId, last4Digits: '4242' })).rejects.toMatchObject({ status: 409 });
      expect(serializableTransaction).not.toHaveBeenCalled();
      expect(createPayment).not.toHaveBeenCalled();
    });

    it("AC4: responde ALREADY_PAID al pagar una reserva ya pagada", async () => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({ status: BookingStatus.PAID }));

      await expect(service.pay(tenantId, { bookingId, last4Digits: '4242' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'ALREADY_PAID' },
      });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC4: convierte una carrera de pago a ALREADY_PAID", async () => {
      findBookingForPayment
        .mockResolvedValueOnce(makeBooking())
        .mockResolvedValueOnce(makeBooking({ status: BookingStatus.PAID }));
      serializableTransaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'unit-test',
        }),
      );
      const paymentPromise = service.pay(tenantId, { bookingId, last4Digits: '4242' });
      const rejection = expect(paymentPromise).rejects.toMatchObject({ status: 409, response: { code: 'ALREADY_PAID' } });
      await jest.advanceTimersByTimeAsync(2_000);

      await rejection;
    });

    it("AC4: no permite pagar una reserva de otro arrendatario", async () => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({ tenantId: otherUserId }));

      await expect(service.pay(tenantId, { bookingId, last4Digits: '4242' })).rejects.toBeInstanceOf(NotFoundException);
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC4: no muestra el resumen de una reserva ajena", async () => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({ tenantId: otherUserId }));

      await expect(service.getSummary(tenantId, bookingId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("AC4: no muestra movimientos de una reserva ajena", async () => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking());

      await expect(service.getTransactionHistory(otherUserId, bookingId)).rejects.toBeInstanceOf(NotFoundException);
      expect(listTransactions).not.toHaveBeenCalled();
    });

    it("AC4: exige perfil verificado para pagar un bien que lo requiere", async () => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({
        property: { ...makeBooking().property, verifiedOnly: true },
        tenant: { profile: { isVerified: false } },
      }));

      await expect(service.pay(tenantId, { bookingId, last4Digits: '4242' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it("AC3: exige perfil verificado para consultar el resumen cuando el bien lo requiere", async () => {
      findBookingForPayment.mockResolvedValueOnce(makeBooking({
        property: { ...makeBooking().property, verifiedOnly: true },
        tenant: { profile: { isVerified: false } },
      }));

      await expect(service.getSummary(tenantId, bookingId)).rejects.toMatchObject({
        status: 403,
        response: { code: 'VERIFICATION_REQUIRED' },
      });
    });

    it("AC4: rechaza UUID ausente o inválido en el DTO", async () => {
      const dtos = [
        plainToInstance(CreatePaymentDto, { last4Digits: '4242' }),
        plainToInstance(CreatePaymentDto, { bookingId: 'no-es-uuid', last4Digits: '4242' }),
      ];

      for (const dto of dtos) expect(await validate(dto)).not.toHaveLength(0);
    });

    it.each([
      ['H13-U20', ''],
      ['H13-U21', '42'],
      ['H13-U22', '42420'],
      ['H13-U23', '42a2'],
    ])("AC4: %s rechaza last4Digits inválido: \"%s\"", async (_testId, last4Digits) => {
      const dto = plainToInstance(CreatePaymentDto, { bookingId, last4Digits });
      expect(await validate(dto)).not.toHaveLength(0);
    });

    it("AC4: responde 403 a OWNER y ADMIN, y 401 si falta la sesión", async () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const handler = PaymentsController.prototype.pay;

      for (const role of [Role.OWNER, Role.ADMIN]) {
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
        getClass: () => PaymentsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(jwtGuard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it("AC4: rechaza un UUID inválido en el parámetro de historial con 400", async () => {
      const pipe = new (await import('@nestjs/common')).ParseUUIDPipe();

      await expect(pipe.transform('no-es-uuid', {
        type: 'param',
        metatype: String,
        data: 'bookingId',
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(BookingTransactionsController.prototype.getTransactions).toBeDefined();
    });
  
});
