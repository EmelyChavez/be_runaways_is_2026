import { jest } from '@jest/globals';
import { expectHttpExceptionStatus } from './expect-http-exception.js';
import 'reflect-metadata';
import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingStatus, Role } from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe("H9. Consulta de disponibilidad de un bien", () => {
  const propertyId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const tenantId = 'e75428ba-0c10-4d31-b97b-f4a1b563983e';
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const findAvailabilityProperty = jest.fn<(...args: any[]) => any>();
  const findOccupiedRanges = jest.fn<(...args: any[]) => any>();
  let service: PropertiesService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T18:00:00.000Z'));
    jest.clearAllMocks();
    findAvailabilityProperty.mockResolvedValue({ id: propertyId });
    findOccupiedRanges.mockResolvedValue([]);
    service = new PropertiesService(
      { findAvailabilityProperty, findOccupiedRanges } as never,
      {} as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  
    it("AC1: devuelve el contrato de disponibilidad para un TENANT", async () => {
      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      expect(result).toEqual({
        propertyId,
        from: '2026-11-14',
        to: '2027-02-11',
        occupiedDates: [],
      });
      expect(findAvailabilityProperty).toHaveBeenCalledWith(propertyId, undefined);
    });

    it("AC1: calcula 90 días inclusivos desde hoy en El Salvador", async () => {
      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);
      const from = new Date(`${result.from}T00:00:00.000Z`);
      const to = new Date(`${result.to}T00:00:00.000Z`);

      expect((to.getTime() - from.getTime()) / 86_400_000 + 1).toBe(90);
      expect(result.from).toBe('2026-11-14');
    });

    it("AC3: vuelve a consultar la disponibilidad después de crear una reserva", async () => {
      const occupiedRange = {
        startDate: new Date('2026-11-20T00:00:00.000Z'),
        endDate: new Date('2026-11-21T00:00:00.000Z'),
      };
      findOccupiedRanges
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([occupiedRange]);

      const beforeBooking = await service.getAvailability(propertyId, tenantId, Role.TENANT);
      const afterBooking = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      expect(beforeBooking.occupiedDates).toEqual([]);
      expect(afterBooking.occupiedDates).toEqual(['2026-11-20', '2026-11-21']);
      expect(findOccupiedRanges).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['H9-U03', 'PENDING', '2026-11-15', '2026-11-16'],
      ['H9-U04', 'PAID', '2026-11-17', '2026-11-18'],
    ])("AC4: %s incluye en ocupadas las fechas de una reserva %s", async (_testId, _status, start, end) => {
      findOccupiedRanges.mockResolvedValueOnce([
        { startDate: new Date(`${start}T00:00:00.000Z`), endDate: new Date(`${end}T00:00:00.000Z`) },
      ]);

      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      const expected = [start];
      const current = new Date(`${start}T00:00:00.000Z`);
      current.setUTCDate(current.getUTCDate() + 1);
      while (current.toISOString().slice(0, 10) <= end) {
        expected.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
      }
      expect(result.occupiedDates).toEqual(expected);
    });

    it("AC4: incluye todos los días de un bloqueo del arrendador", async () => {
      findOccupiedRanges.mockResolvedValueOnce([
        { startDate: new Date('2026-11-20T00:00:00.000Z'), endDate: new Date('2026-11-22T00:00:00.000Z') },
      ]);

      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      expect(result.occupiedDates).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    });

    it("AC4: recorta periodos que se extienden fuera del rango consultado", async () => {
      findOccupiedRanges.mockResolvedValueOnce([
        { startDate: new Date('2026-11-13T00:00:00.000Z'), endDate: new Date('2026-11-15T00:00:00.000Z') },
        { startDate: new Date('2027-02-10T00:00:00.000Z'), endDate: new Date('2027-02-13T00:00:00.000Z') },
      ]);

      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      expect(result.occupiedDates).toEqual(['2026-11-14', '2026-11-15', '2027-02-10', '2027-02-11']);
    });

    it("AC2: elimina duplicados de periodos superpuestos y ordena las fechas", async () => {
      findOccupiedRanges.mockResolvedValueOnce([
        { startDate: new Date('2026-11-18T00:00:00.000Z'), endDate: new Date('2026-11-20T00:00:00.000Z') },
        { startDate: new Date('2026-11-19T00:00:00.000Z'), endDate: new Date('2026-11-21T00:00:00.000Z') },
      ]);

      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      expect(result.occupiedDates).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
      expect(new Set(result.occupiedDates).size).toBe(result.occupiedDates.length);
    });

    it("AC4: permite al OWNER consultar su propio bien", async () => {
      const result = await service.getAvailability(propertyId, ownerId, Role.OWNER);

      expect(result.propertyId).toBe(propertyId);
      expect(findAvailabilityProperty).toHaveBeenCalledWith(propertyId, ownerId);
    });

    it("AC4: consulta reservas PENDING o PAID y bloqueos; AC5: omite datos personales", async () => {
      const findManyBooking = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
      const findManyBlocks = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
      const repository = new PropertiesRepository({
        booking: { findMany: findManyBooking },
        noAvailability: { findMany: findManyBlocks },
      } as never);

      await repository.findOccupiedRanges(
        propertyId,
        new Date('2026-11-14T00:00:00.000Z'),
        new Date('2027-02-11T00:00:00.000Z'),
      );

      expect(findManyBooking).toHaveBeenCalledWith({
        where: {
          propertyId,
          status: { in: [BookingStatus.PENDING, BookingStatus.PAID] },
          startDate: { lte: new Date('2027-02-11T00:00:00.000Z') },
          endDate: { gte: new Date('2026-11-14T00:00:00.000Z') },
        },
        select: { startDate: true, endDate: true },
      });
      expect(findManyBlocks).toHaveBeenCalledWith({
        where: {
          propertyId,
          startDate: { lte: new Date('2027-02-11T00:00:00.000Z') },
          endDate: { gte: new Date('2026-11-14T00:00:00.000Z') },
        },
        select: { startDate: true, endDate: true },
      });
      const result = await service.getAvailability(propertyId, tenantId, Role.TENANT);
      expect(result).not.toHaveProperty('tenantId');
      expect(result).not.toHaveProperty('tenant');
      expect(result).not.toHaveProperty('bookings');
    });

    it("AC4: declara TENANT y OWNER como roles autorizados", () => {
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.getAvailability)).toEqual([
        Role.TENANT,
        Role.OWNER,
      ]);
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT, Role.OWNER] } as never);

      for (const role of [Role.TENANT, Role.OWNER]) {
        const context = {
          getHandler: () => PropertiesController.prototype.getAvailability,
          getClass: () => PropertiesController,
          switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
        } as never;
        expect(guard.canActivate(context)).toBe(true);
      }
    });
  

  
    it("AC4: no incluye reservas CANCELLED ni COMPLETED en el filtro de ocupación", async () => {
      const findManyBooking = jest.fn<(...args: any[]) => any>().mockResolvedValue([]);
      const repository = new PropertiesRepository({
        booking: { findMany: findManyBooking },
        noAvailability: { findMany: jest.fn<(...args: any[]) => any>().mockResolvedValue([]) },
      } as never);

      await repository.findOccupiedRanges(
        propertyId,
        new Date('2026-11-14T00:00:00.000Z'),
        new Date('2027-02-11T00:00:00.000Z'),
      );

      expect(findManyBooking.mock.calls[0][0].where.status).toEqual({
        in: [BookingStatus.PENDING, BookingStatus.PAID],
      });
      expect(findManyBooking.mock.calls[0][0].select).not.toHaveProperty('tenant');
    });

    it.each([
      ['H9-U12', 'inexistente'],
      ['H9-U13', 'PAUSED'],
      ['H9-U14', 'DELETED'],
    ])(
      "AC5: %s responde 404 si el bien es %s o no está disponible",
      async () => {
        findAvailabilityProperty.mockResolvedValueOnce(null);

        await expect(service.getAvailability(propertyId, tenantId, Role.TENANT)).rejects.toMatchObject({
          status: 404,
          response: {
            code: 'PROPERTY_NOT_AVAILABLE',
            message: 'Este bien ya no está disponible',
          },
        });
        expect(findOccupiedRanges).not.toHaveBeenCalled();
      },
    );

    it("AC6: responde 404 si el OWNER consulta un bien ajeno", async () => {
      findAvailabilityProperty.mockResolvedValueOnce(null);

      await expect(service.getAvailability(propertyId, ownerId, Role.OWNER)).rejects.toMatchObject({ status: 404 });
      expect(findAvailabilityProperty).toHaveBeenCalledWith(propertyId, ownerId);
      expect(findOccupiedRanges).not.toHaveBeenCalled();
    });

    it("AC6: rechaza el acceso de ADMIN con 403", () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT, Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.getAvailability,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.ADMIN } }) }),
      } as never;

      expectHttpExceptionStatus(() => guard.canActivate(context), 403);
    });

    it("AC6: rechaza solicitudes sin sesión con 401", async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const context = {
        getHandler: () => PropertiesController.prototype.getAvailability,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it("AC6: rechaza identificadores que no sean UUID con 400", async () => {
      const pipe = new ParseUUIDPipe();

      await expect(
        pipe.transform('no-es-uuid', { type: 'param', metatype: String, data: 'id' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  
});
