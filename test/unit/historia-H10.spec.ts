import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingStatus, NotificationEventType, OriginModule, Prisma, Role } from '../../src/generated/prisma/client.js';
import { BookingsController, OwnerBookingsController } from '../../src/bookings/controllers/bookings.controller.js';
import { BookingQueryDto, CreateBookingDto, OwnerBookingQueryDto } from '../../src/bookings/dto/index.js';
import { BookingsRepository } from '../../src/bookings/repositories/bookings.repository.js';
import { BookingsService } from '../../src/bookings/services/bookings.service.js';

describe('H10: reserva de un bien por un periodo', () => {
  const tenantId = 'e75428ba-0c10-4d31-b97b-f4a1b563983e';
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const propertyId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const bookingId = '19be8fb4-81e2-4c84-9ad9-65524817b5ea';
  const startDate = '2026-11-20';
  const endDate = '2026-11-22';
  const tx = {};
  const serializableTransaction = vi.fn();
  const findVerifiedProfile = vi.fn();
  const findAvailableProperty = vi.fn();
  const findOverlappingActiveBooking = vi.fn();
  const findOverlappingBlock = vi.fn();
  const createPendingBooking = vi.fn();
  const listTenantBookings = vi.fn();
  const listOwnerBookings = vi.fn();
  const cancelExpiredPendingBookings = vi.fn();
  const emit = vi.fn();
  let service: BookingsService;

  const makeBooking = (overrides: Record<string, unknown> = {}) => ({
    id: bookingId,
    propertyId,
    tenantId,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
    subtotal: new Prisma.Decimal('150.00'),
    status: BookingStatus.PENDING,
    expiresAt: new Date('2026-11-17T18:00:00.000Z'),
    createdAt: new Date('2026-11-16T18:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
    vi.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findVerifiedProfile.mockResolvedValue({ isVerified: true });
    findAvailableProperty.mockResolvedValue({
      id: propertyId,
      ownerId,
      title: 'Casa de campo',
      pricePerDay: new Prisma.Decimal('50.00'),
      securityDeposit: new Prisma.Decimal('100.00'),
    });
    findOverlappingActiveBooking.mockResolvedValue(null);
    findOverlappingBlock.mockResolvedValue(null);
    createPendingBooking.mockImplementation(async (data) => makeBooking(data));
    listTenantBookings.mockResolvedValue({ data: [], total: 0 });
    listOwnerBookings.mockResolvedValue({ data: [], total: 0 });
    cancelExpiredPendingBookings.mockResolvedValue([]);
    emit.mockResolvedValue({ id: 'notification-id' });
    service = new BookingsService(
      {
        serializableTransaction,
        findVerifiedProfile,
        findAvailableProperty,
        findOverlappingActiveBooking,
        findOverlappingBlock,
        createPendingBooking,
        listTenantBookings,
        listOwnerBookings,
        cancelExpiredPendingBookings,
      } as never,
      { emit } as never,
    );
  });

  afterEach(() => vi.useRealTimers());

  describe('casos positivos', () => {
    it('H10-U01 crea una reserva en una transacción serializable para un TENANT verificado', async () => {
      await service.create(tenantId, { propertyId, startDate, endDate });

      expect(serializableTransaction).toHaveBeenCalledOnce();
      expect(findVerifiedProfile).toHaveBeenCalledWith(tenantId, tx);
      expect(findAvailableProperty).toHaveBeenCalledWith(propertyId, tx);
      expect(createPendingBooking).toHaveBeenCalledOnce();
    });

    it('H10-U02 cuenta ambos extremos y calcula el subtotal desde el precio guardado', async () => {
      await service.create(tenantId, { propertyId, startDate, endDate });

      const [data] = createPendingBooking.mock.calls[0];
      expect(data.startDate).toEqual(new Date('2026-11-20T00:00:00.000Z'));
      expect(data.endDate).toEqual(new Date('2026-11-22T00:00:00.000Z'));
      expect(data.subtotal.toFixed(2)).toBe('150.00');
    });

    it('H10-U03 cuenta un día cuando inicio y fin son la misma fecha', async () => {
      await service.create(tenantId, { propertyId, startDate, endDate: startDate });

      const [data] = createPendingBooking.mock.calls[0];
      expect(data.subtotal.toFixed(2)).toBe('50.00');
      expect(data.startDate).toEqual(data.endDate);
    });

    it('H10-U04 crea la reserva PENDING con vencimiento 24 horas después', async () => {
      const result = await service.create(tenantId, { propertyId, startDate, endDate });

      const [data] = createPendingBooking.mock.calls[0];
      expect(data.status).toBeUndefined();
      expect(data.expiresAt).toEqual(new Date('2026-11-17T18:00:00.000Z'));
      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.expiresAt).toBe('2026-11-17T18:00:00.000Z');
    });

    it('H10-U05 devuelve el mensaje de confirmación para el arrendatario', async () => {
      const result = await service.create(tenantId, { propertyId, startDate, endDate });

      expect(result.message).toBe('Reserva creada. Tienes 24 horas para pagarla.');
    });

    it('H10-U06 notifica al arrendador con el evento y origen de reservas', async () => {
      await service.create(tenantId, { propertyId, startDate, endDate });

      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: ownerId,
        eventType: NotificationEventType.RESERVATION_CREATED,
        originModule: OriginModule.RESERVATIONS,
        referenceId: bookingId,
        templateData: { propertyName: 'Casa de campo' },
        title: 'Nueva solicitud de reserva',
      }));
    });

    it('H10-U07 permite reservar un periodo sin traslapes ni bloqueos', async () => {
      const result = await service.create(tenantId, { propertyId, startDate, endDate });

      expect(findOverlappingActiveBooking).toHaveBeenCalledWith(
        propertyId,
        new Date(`${startDate}T00:00:00.000Z`),
        new Date(`${endDate}T00:00:00.000Z`),
        new Date('2026-11-16T18:00:00.000Z'),
        tx,
      );
      expect(findOverlappingBlock).toHaveBeenCalledOnce();
      expect(result.id).toBe(bookingId);
    });

    it('H10-U08 lista únicamente las reservas del arrendatario autenticado con filtros y paginación', async () => {
      const query = { page: 2, pageSize: 5, status: BookingStatus.PENDING };
      listTenantBookings.mockResolvedValueOnce({ data: [makeBooking()], total: 7 });

      const result = await service.listMine(tenantId, query);

      expect(listTenantBookings).toHaveBeenCalledWith(tenantId, query);
      expect(result).toMatchObject({ total: 7, page: 2, data: [{ tenantId, status: BookingStatus.PENDING }] });
    });

    it('H10-U09 lista reservas propias del OWNER e incluye el nombre del arrendatario', async () => {
      const query = { page: 1, pageSize: 10, propertyId, status: BookingStatus.PENDING };
      listOwnerBookings.mockResolvedValueOnce({
        data: [{ ...makeBooking(), tenant: { name: 'Ana Pérez' } }],
        total: 1,
      });

      const result = await service.listForOwner(ownerId, query);

      expect(listOwnerBookings).toHaveBeenCalledWith(ownerId, query);
      expect(result.data[0].tenant).toEqual({ name: 'Ana Pérez' });
      expect(result.total).toBe(1);
    });

    it('H10-U10 procesa reservas PENDING vencidas y notifica a ambas partes', async () => {
      cancelExpiredPendingBookings.mockResolvedValueOnce([{
        id: bookingId,
        tenantId,
        ownerId,
        propertyTitle: 'Casa de campo',
      }]);

      await service.expirePendingBookings(new Date('2026-11-17T18:00:00.000Z'));

      expect(cancelExpiredPendingBookings).toHaveBeenCalledWith(new Date('2026-11-17T18:00:00.000Z'));
      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: tenantId,
        eventType: NotificationEventType.RESERVATION_CANCELED_EXPIRED,
        originModule: OriginModule.RESERVATIONS,
        referenceId: bookingId,
      }));
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        recipientId: ownerId,
        eventType: NotificationEventType.RESERVATION_CANCELED_EXPIRED,
      }));
    });

    it('H10-U11 acepta UUID y fechas válidas en formato YYYY-MM-DD', async () => {
      const dto = plainToInstance(CreateBookingDto, { propertyId, startDate, endDate });

      expect(await validate(dto)).toHaveLength(0);
    });

    it('H10-U12 declara TENANT para creación y consulta propia, y OWNER para consulta de sus bienes', () => {
      expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.create)).toEqual([Role.TENANT]);
      expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.listMine)).toEqual([Role.TENANT]);
      expect(Reflect.getMetadata(ROLES_KEY, OwnerBookingsController.prototype.listForOwner)).toEqual([Role.OWNER]);

      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const context = {
        getHandler: () => BookingsController.prototype.create,
        getClass: () => BookingsController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.TENANT } }) }),
      } as never;
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('casos negativos', () => {
    it.each([
      ['H10-U13a', 'fecha inexistente', '2026-02-30', '2026-03-01'],
      ['H10-U13b', 'formato distinto de YYYY-MM-DD', '20-11-2026', '2026-11-22'],
    ])('%s rechaza %s con 400', async (_testId, _description, invalidStart, invalidEnd) => {
      await expect(service.create(tenantId, {
        propertyId,
        startDate: invalidStart,
        endDate: invalidEnd,
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it('H10-U14 rechaza cuando la fecha de fin es anterior a la de inicio', async () => {
      await expect(service.create(tenantId, {
        propertyId,
        startDate: '2026-11-22',
        endDate: '2026-11-21',
      })).rejects.toMatchObject({ status: 400 });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it('H10-U15 rechaza periodos mayores de 30 días inclusivos', async () => {
      await expect(service.create(tenantId, {
        propertyId,
        startDate: '2026-11-16',
        endDate: '2026-12-16',
      })).rejects.toMatchObject({ status: 400 });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it.each([
      ['H10-U16a', 'fechas anteriores a hoy', '2026-11-15', '2026-11-16'],
      ['H10-U16b', 'fecha final posterior a los próximos 90 días', '2027-02-13', '2027-02-14'],
    ])('%s rechaza %s', async (_testId, _description, invalidStart, invalidEnd) => {
      await expect(service.create(tenantId, {
        propertyId,
        startDate: invalidStart,
        endDate: invalidEnd,
      })).rejects.toMatchObject({ status: 400 });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it('H10-U17 rechaza un propertyId inválido con 400', async () => {
      const dto = plainToInstance(CreateBookingDto, { propertyId: 'no-uuid', startDate, endDate });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('H10-U18 rechaza campos no declarados en el DTO', async () => {
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });

      await expect(pipe.transform(
        { propertyId, startDate, endDate, subtotal: '1.00' },
        { type: 'body', metatype: CreateBookingDto, data: '' },
      )).rejects.toBeInstanceOf(BadRequestException);
    });

    it('H10-U19 responde 403 si el perfil del arrendatario no está verificado', async () => {
      findVerifiedProfile.mockResolvedValueOnce({ isVerified: false });

      await expect(service.create(tenantId, { propertyId, startDate, endDate }))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(findAvailableProperty).not.toHaveBeenCalled();
      expect(createPendingBooking).not.toHaveBeenCalled();
    });

    it('H10-U20 responde 404 cuando el bien no existe o no está AVAILABLE', async () => {
      findAvailableProperty.mockResolvedValueOnce(null);

      await expect(service.create(tenantId, { propertyId, startDate, endDate }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(createPendingBooking).not.toHaveBeenCalled();
    });

    it('H10-U21 responde 409 si las fechas se traslapan con una reserva activa', async () => {
      findOverlappingActiveBooking.mockResolvedValueOnce({ id: 'existing-booking' });

      await expect(service.create(tenantId, { propertyId, startDate, endDate }))
        .rejects.toMatchObject({
          status: 409,
          response: {
            code: 'DATES_UNAVAILABLE',
            message: 'Estas fechas ya no están disponibles. Elige otras.',
          },
        });
      expect(createPendingBooking).not.toHaveBeenCalled();
    });

    it('H10-U22 responde 409 si las fechas se traslapan con un bloqueo', async () => {
      findOverlappingBlock.mockResolvedValueOnce({ id: 'existing-block' });

      await expect(service.create(tenantId, { propertyId, startDate, endDate }))
        .rejects.toMatchObject({ status: 409, response: { code: 'DATES_UNAVAILABLE' } });
      expect(createPendingBooking).not.toHaveBeenCalled();
    });

    it('H10-U23 convierte un conflicto de serialización concurrente en 409', async () => {
      serializableTransaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
        { code: 'P2034', clientVersion: '7.10.0' },
      ));

      await expect(service.create(tenantId, { propertyId, startDate, endDate }))
        .rejects.toMatchObject({ status: 409, response: { code: 'DATES_UNAVAILABLE' } });
    });

    it('H10-U24 rechaza OWNER y ADMIN con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);

      for (const role of [Role.OWNER, Role.ADMIN]) {
        const context = {
          getHandler: () => BookingsController.prototype.create,
          getClass: () => BookingsController,
          switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
        } as never;
        expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
      }
    });

    it('H10-U25 rechaza una solicitud sin sesión con 401', async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => BookingsController.prototype.create,
        getClass: () => BookingsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it('H10-U26 limita Mis reservas al tenantId autenticado en la consulta Prisma', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const repository = new BookingsRepository({
        $transaction: vi.fn((queries) => Promise.all(queries)),
        booking: { findMany, count },
      } as never);

      await repository.listTenantBookings(tenantId, { page: 1, pageSize: 10 });

      expect(findMany.mock.calls[0][0].where).toEqual({ tenantId });
      expect(count.mock.calls[0][0].where).toEqual({ tenantId });
    });

    it('H10-U27 limita Reservas de mis bienes al ownerId autenticado', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const repository = new BookingsRepository({
        $transaction: vi.fn((queries) => Promise.all(queries)),
        booking: { findMany, count },
      } as never);

      await repository.listOwnerBookings(ownerId, { page: 1, pageSize: 10 });

      expect(findMany.mock.calls[0][0].where).toEqual({ property: { ownerId } });
      expect(findMany.mock.calls[0][0].select.tenant.select).toEqual({ name: true });
      expect(count.mock.calls[0][0].where).toEqual({ property: { ownerId } });
    });

    it.each([
      ['H10-U28a', { page: 0 }, BookingQueryDto],
      ['H10-U28b', { pageSize: 101 }, BookingQueryDto],
      ['H10-U28c', { status: 'UNKNOWN' }, BookingQueryDto],
      ['H10-U28d', { propertyId: 'not-uuid' }, OwnerBookingQueryDto],
    ])('%s rechaza parámetros de consulta inválidos', async (_testId, query, DtoClass) => {
      const dto = plainToInstance(DtoClass, query);

      expect(await validate(dto)).not.toHaveLength(0);
    });
  });
});
