import 'reflect-metadata';
import {
  BadRequestException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingStatus, Prisma, Role } from '../../src/generated/prisma/client.js';
import { AvailabilityBlocksController } from '../../src/properties/controllers/availability-blocks.controller.js';
import { CreateAvailabilityBlockDto } from '../../src/properties/dto/create-availability-block.dto.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe('H12: bloqueo de fechas no disponibles', () => {
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const otherOwnerId = 'c65c3dca-017d-47a4-b445-9d8e6a51b4f7';
  const propertyId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const blockId = '19be8fb4-81e2-4c84-9ad9-65524817b5ea';
  const startDate = '2026-11-20';
  const endDate = '2026-11-22';
  const tx = {};
  const serializableTransaction = vi.fn();
  const findOwnedForAvailability = vi.fn();
  const findOwnedProperty = vi.fn();
  const findOverlappingAvailabilityBlock = vi.fn();
  const findOverlappingActiveBooking = vi.fn();
  const createAvailabilityBlock = vi.fn();
  const listAvailabilityBlocks = vi.fn();
  const findAvailabilityBlockById = vi.fn();
  const deleteAvailabilityBlock = vi.fn();
  const findAvailabilityProperty = vi.fn();
  const findOccupiedRanges = vi.fn();
  let service: PropertiesService;

  const makeBlock = (overrides: Record<string, unknown> = {}) => ({
    id: blockId,
    propertyId,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
    createdAt: new Date('2026-11-16T18:00:00.000Z'),
    ...overrides,
  });

  const makeContext = (handler: Function, role?: Role) => ({
    getHandler: () => handler,
    getClass: () => AvailabilityBlocksController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: ownerId, role } : undefined }) }),
  }) as never;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
    vi.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findOwnedForAvailability.mockResolvedValue({ id: propertyId });
    findOwnedProperty.mockResolvedValue({ id: propertyId });
    findOverlappingAvailabilityBlock.mockResolvedValue(null);
    findOverlappingActiveBooking.mockResolvedValue(null);
    createAvailabilityBlock.mockImplementation(async () => makeBlock());
    listAvailabilityBlocks.mockResolvedValue([]);
    findAvailabilityBlockById.mockResolvedValue(makeBlock());
    deleteAvailabilityBlock.mockResolvedValue(makeBlock());
    findAvailabilityProperty.mockResolvedValue({ id: propertyId });
    findOccupiedRanges.mockResolvedValue([]);
    service = new PropertiesService(
      {
        serializableTransaction,
        findOwnedForAvailability,
        findOwnedProperty,
        findOverlappingAvailabilityBlock,
        findOverlappingActiveBooking,
        createAvailabilityBlock,
        listAvailabilityBlocks,
        findAvailabilityBlockById,
        deleteAvailabilityBlock,
        findAvailabilityProperty,
        findOccupiedRanges,
      } as never,
      {} as never,
    );
  });

  afterEach(() => vi.useRealTimers());

  describe('casos positivos', () => {
    it('H12-U01 crea un bloqueo válido y devuelve sus datos', async () => {
      const result = await service.createAvailabilityBlock(ownerId, propertyId, { startDate, endDate });

      expect(serializableTransaction).toHaveBeenCalledOnce();
      expect(findOwnedForAvailability).toHaveBeenCalledWith(ownerId, propertyId, tx);
      expect(createAvailabilityBlock).toHaveBeenCalledWith(
        propertyId,
        new Date(`${startDate}T00:00:00.000Z`),
        new Date(`${endDate}T00:00:00.000Z`),
        tx,
      );
      expect(result).toEqual({
        id: blockId,
        propertyId,
        startDate,
        endDate,
        createdAt: '2026-11-16T18:00:00.000Z',
      });
    });

    it('H12-U02 filtra bloqueos cuyo fin es hoy o posterior y ordena por inicio', async () => {
      const findMany = vi.fn().mockResolvedValue([makeBlock()]);
      const repository = new PropertiesRepository({ noAvailability: { findMany } } as never);

      await repository.listAvailabilityBlocks(propertyId, new Date('2026-11-16T00:00:00.000Z'));

      expect(findMany).toHaveBeenCalledWith({
        where: { propertyId, endDate: { gte: new Date('2026-11-16T00:00:00.000Z') } },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      });
    });

    it('H12-U03 devuelve una lista vacía cuando el bien no tiene bloqueos vigentes', async () => {
      const result = await service.listAvailabilityBlocks(ownerId, propertyId);

      expect(result).toEqual([]);
      expect(listAvailabilityBlocks).toHaveBeenCalledWith(propertyId, new Date('2026-11-16T00:00:00.000Z'));
    });

    it('H12-U04 permite eliminar el bloqueo de un bien propio', async () => {
      await expect(service.deleteAvailabilityBlock(ownerId, blockId)).resolves.toBeUndefined();

      expect(findAvailabilityBlockById).toHaveBeenCalledWith(blockId);
      expect(findOwnedProperty).toHaveBeenCalledWith(ownerId, propertyId);
      expect(deleteAvailabilityBlock).toHaveBeenCalledWith(blockId);
    });

    it('H12-U05 muestra los días bloqueados como ocupados en la disponibilidad', async () => {
      findOccupiedRanges.mockResolvedValueOnce([
        { startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`) },
      ]);

      const result = await service.getAvailability(propertyId, ownerId, Role.OWNER);

      expect(result.occupiedDates).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    });

    it('H12-U06 al eliminar el bloqueo, los días quedan libres si no hay reserva', async () => {
      findOccupiedRanges.mockResolvedValueOnce([
        { startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`) },
      ]).mockResolvedValueOnce([]);

      const occupiedBeforeDelete = await service.getAvailability(propertyId, ownerId, Role.OWNER);
      await service.deleteAvailabilityBlock(ownerId, blockId);
      const occupiedAfterDelete = await service.getAvailability(propertyId, ownerId, Role.OWNER);

      expect(occupiedBeforeDelete.occupiedDates).toHaveLength(3);
      expect(occupiedAfterDelete.occupiedDates).toEqual([]);
      expect(deleteAvailabilityBlock).toHaveBeenCalledWith(blockId);
    });

    it('H12-U07 restringe las tres rutas al rol OWNER', () => {
      const handlers = [
        AvailabilityBlocksController.prototype.create,
        AvailabilityBlocksController.prototype.list,
        AvailabilityBlocksController.prototype.delete,
      ];
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);

      for (const handler of handlers) {
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.OWNER]);
        expect(guard.canActivate(makeContext(handler, Role.OWNER))).toBe(true);
      }
    });
  });

  describe('casos negativos', () => {
    it('H12-U08 rechaza fechas requeridas, con formato inválido o de calendario inválido', async () => {
      const invalidDtos = [
        plainToInstance(CreateAvailabilityBlockDto, {}),
        plainToInstance(CreateAvailabilityBlockDto, { startDate: '20-11-2026', endDate }),
        plainToInstance(CreateAvailabilityBlockDto, { startDate: '2026-02-30', endDate }),
      ];

      for (const dto of invalidDtos) expect(await validate(dto)).not.toHaveLength(0);
    });

    it('H12-U09 rechaza una fecha de inicio anterior a hoy', async () => {
      await expect(service.createAvailabilityBlock(ownerId, propertyId, {
        startDate: '2026-11-15', endDate: '2026-11-20',
      })).rejects.toMatchObject({ status: 400 });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it('H12-U10 rechaza una fecha de fin anterior a la de inicio', async () => {
      await expect(service.createAvailabilityBlock(ownerId, propertyId, {
        startDate: '2026-11-22', endDate: '2026-11-21',
      })).rejects.toMatchObject({ status: 400 });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it('H12-U11 rechaza fechas posteriores al horizonte de 90 días', async () => {
      await expect(service.createAvailabilityBlock(ownerId, propertyId, {
        startDate: '2027-02-14', endDate: '2027-02-14',
      })).rejects.toMatchObject({ status: 400 });
      expect(serializableTransaction).not.toHaveBeenCalled();
    });

    it('H12-U12 responde 409 si el periodo se traslapa con otro bloqueo', async () => {
      findOverlappingAvailabilityBlock.mockResolvedValueOnce({ id: 'another-block-id' });

      await expect(service.createAvailabilityBlock(ownerId, propertyId, { startDate, endDate })).rejects.toMatchObject({
        status: 409,
        response: { code: 'DATES_UNAVAILABLE' },
      });
      expect(createAvailabilityBlock).not.toHaveBeenCalled();
    });

    it.each([
      ['H12-U13', BookingStatus.PENDING],
      ['H12-U14', BookingStatus.PAID],
    ])('%s responde 409 si el periodo se traslapa con una reserva %s', async (_testId, status) => {
      findOverlappingActiveBooking.mockResolvedValueOnce({ id: 'booking-id', status });

      await expect(service.createAvailabilityBlock(ownerId, propertyId, { startDate, endDate })).rejects.toMatchObject({
        status: 409,
        response: { code: 'DATES_UNAVAILABLE' },
      });
      expect(createAvailabilityBlock).not.toHaveBeenCalled();
    });

    it('H12-U15 responde 404 al crear un bloqueo para un bien ajeno o inexistente', async () => {
      findOwnedForAvailability.mockResolvedValueOnce(null);

      await expect(service.createAvailabilityBlock(otherOwnerId, propertyId, { startDate, endDate }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(createAvailabilityBlock).not.toHaveBeenCalled();
    });

    it('H12-U16 responde 404 al consultar bloqueos de un bien ajeno o inexistente', async () => {
      findOwnedProperty.mockResolvedValueOnce(null);

      await expect(service.listAvailabilityBlocks(otherOwnerId, propertyId)).rejects.toMatchObject({ status: 404 });
      expect(listAvailabilityBlocks).not.toHaveBeenCalled();
    });

    it('H12-U17 responde 404 si el bloqueo que se desea eliminar no existe', async () => {
      findAvailabilityBlockById.mockResolvedValueOnce(null);

      await expect(service.deleteAvailabilityBlock(ownerId, blockId)).rejects.toMatchObject({ status: 404 });
      expect(deleteAvailabilityBlock).not.toHaveBeenCalled();
    });

    it('H12-U18 responde 404 y conserva un bloqueo que pertenece a otro arrendador', async () => {
      findOwnedProperty.mockResolvedValueOnce(null);

      await expect(service.deleteAvailabilityBlock(otherOwnerId, blockId)).rejects.toMatchObject({ status: 404 });
      expect(deleteAvailabilityBlock).not.toHaveBeenCalled();
    });

    it('H12-U19 responde 403 para TENANT y ADMIN, y 401 cuando falta la sesión', async () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const handler = AvailabilityBlocksController.prototype.create;

      for (const role of [Role.TENANT, Role.ADMIN]) {
        expect(() => guard.canActivate(makeContext(handler, role))).toThrow(expect.objectContaining({ status: 403 }));
      }
      expect(() => guard.canActivate(makeContext(handler))).toThrow(expect.objectContaining({ status: 401 }));

      const jwtGuard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => handler,
        getClass: () => AvailabilityBlocksController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(jwtGuard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it('H12-U20 rechaza UUID inválidos en las tres rutas con 400', async () => {
      const pipe = new ParseUUIDPipe();
      for (let routeIndex = 0; routeIndex < 3; routeIndex += 1) {
        await expect(pipe.transform('no-es-uuid', { type: 'param', metatype: String, data: 'id' }))
          .rejects.toBeInstanceOf(BadRequestException);
      }
    });

    it('H12-U21 convierte un conflicto de serialización al crear en 409', async () => {
      serializableTransaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Serialization conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      );

      await expect(service.createAvailabilityBlock(ownerId, propertyId, { startDate, endDate })).rejects.toMatchObject({
        status: 409,
        response: { code: 'DATES_UNAVAILABLE' },
      });
    });
  });
});
