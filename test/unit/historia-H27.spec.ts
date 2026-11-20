import { jest } from '@jest/globals';
import { expectHttpExceptionStatus } from './expect-http-exception.js';
import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingStatus, PropertyStatus, Role } from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { OccupancyReportQueryDto } from '../../src/properties/dto/occupancy-report-query.dto.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe("H27. Visualización de la tasa de ocupación por bien", () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const propertyOneId = '22222222-2222-4222-8222-222222222222';
  const propertyTwoId = '33333333-3333-4333-8333-333333333333';
  const propertyThreeId = '44444444-4444-4444-8444-444444444444';

  
    it("AC1: calcula ocupación inclusiva de PAID y COMPLETED, excluye bloqueos y devuelve cero sin reservas", async () => {
      const propertyFindMany = jest.fn<(...args: any[]) => any>().mockResolvedValue([
        { id: propertyOneId, title: 'Casa ocupada', status: PropertyStatus.AVAILABLE },
        { id: propertyTwoId, title: 'Equipo libre', status: PropertyStatus.PAUSED },
      ]);
      const bookingFindMany = jest.fn<(...args: any[]) => any>().mockResolvedValue([
        {
          propertyId: propertyOneId,
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: new Date('2026-11-02T00:00:00.000Z'),
        },
        {
          propertyId: propertyOneId,
          startDate: new Date('2026-11-03T00:00:00.000Z'),
          endDate: new Date('2026-11-03T00:00:00.000Z'),
        },
      ]);
      const noAvailabilityFindMany = jest.fn<(...args: any[]) => any>();
      const repository = new PropertiesRepository({
        property: { findMany: propertyFindMany },
        booking: { findMany: bookingFindMany },
        noAvailability: { findMany: noAvailabilityFindMany },
      } as never);
      const service = new PropertiesService(repository, {} as never);

      const result = await service.getOccupancyReport(ownerId, query({ from: '2026-11-01', to: '2026-11-07' }));

      expect(propertyFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId } }));
      expect(bookingFindMany).toHaveBeenCalledWith({
        where: {
          propertyId: { in: [propertyOneId, propertyTwoId] },
          status: { in: [BookingStatus.PAID, BookingStatus.COMPLETED] },
          startDate: { lte: new Date('2026-11-07T00:00:00.000Z') },
          endDate: { gte: new Date('2026-11-01T00:00:00.000Z') },
        },
        select: { propertyId: true, startDate: true, endDate: true },
      });
      expect(noAvailabilityFindMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        from: '2026-11-01',
        to: '2026-11-07',
        periodDays: 7,
        total: 2,
        data: [
          { propertyId: propertyOneId, occupiedDays: 3, occupancyRate: 42.9 },
          { propertyId: propertyTwoId, occupiedDays: 0, occupancyRate: 0 },
        ],
      });
    });

    it("AC3: usa los últimos 30 días contando hoy cuando no se envía período", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-18T18:00:00.000Z'));
      const findOwnerOccupancyData = jest.fn<(...args: any[]) => any>().mockResolvedValue({ properties: [], bookings: [] });
      const service = new PropertiesService({ findOwnerOccupancyData } as never, {} as never);

      try {
        const result = await service.getOccupancyReport(ownerId, query());

        expect(findOwnerOccupancyData).toHaveBeenCalledWith(
          ownerId,
          new Date('2026-10-20T00:00:00.000Z'),
          new Date('2026-11-18T00:00:00.000Z'),
        );
        expect(result).toMatchObject({ from: '2026-10-20', to: '2026-11-18', periodDays: 30 });
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC2: ordena en ambos sentidos y pagina manteniendo el total de bienes", async () => {
      const findOwnerOccupancyData = jest.fn<(...args: any[]) => any>().mockResolvedValue({
        properties: [
          { id: propertyOneId, title: 'Bien alto', status: PropertyStatus.AVAILABLE },
          { id: propertyTwoId, title: 'Bien bajo', status: PropertyStatus.PAUSED },
          { id: propertyThreeId, title: 'Bien medio', status: PropertyStatus.DELETED },
        ],
        bookings: [
          booking(propertyOneId, '2026-11-01', '2026-11-08'),
          booking(propertyTwoId, '2026-11-01', '2026-11-01'),
          booking(propertyThreeId, '2026-11-01', '2026-11-04'),
        ],
      });
      const service = new PropertiesService({ findOwnerOccupancyData } as never, {} as never);

      const descending = await service.getOccupancyReport(ownerId, query({
        from: '2026-11-01', to: '2026-11-10', order: 'desc', page: 1, pageSize: 1,
      }));
      const ascending = await service.getOccupancyReport(ownerId, query({
        from: '2026-11-01', to: '2026-11-10', order: 'asc', page: 2, pageSize: 1,
      }));

      expect(descending).toMatchObject({ total: 3, page: 1, data: [{ propertyId: propertyOneId }] });
      expect(ascending).toMatchObject({ total: 3, page: 2, data: [{ propertyId: propertyThreeId }] });
    });

    it("AC1: toma el OWNER de la sesión y declara la ruta GET protegida por OWNER", () => {
      const getOccupancy = jest.fn<(...args: any[]) => any>();
      const controller = new PropertiesController({ getOccupancyReport: getOccupancy } as never);
      const requestQuery = query({ from: '2026-11-01', to: '2026-11-07' });

      controller.getOccupancy({ id: ownerId } as never, requestQuery);

      expect(getOccupancy).toHaveBeenCalledWith(ownerId, requestQuery);
      expect(Reflect.getMetadata(PATH_METADATA, PropertiesController.prototype.getOccupancy)).toBe('owner/reports/occupancy');
      expect(Reflect.getMetadata(METHOD_METADATA, PropertiesController.prototype.getOccupancy)).toBe(0);
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.getOccupancy)).toEqual([Role.OWNER]);
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.getOccupancy,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.OWNER } }) }),
      } as never;
      expect(guard.canActivate(context)).toBe(true);
    });
  

  
    it("AC5: rechaza fechas incompletas, invertidas, inválidas y períodos mayores a 365 días", async () => {
      const findOwnerOccupancyData = jest.fn<(...args: any[]) => any>().mockResolvedValue({ properties: [], bookings: [] });
      const service = new PropertiesService({ findOwnerOccupancyData } as never, {} as never);

      for (const invalid of [
        { from: '2026-11-01' },
        { to: '2026-11-07' },
        { from: '2026-11-08', to: '2026-11-07' },
        { from: '2026-01-01', to: '2027-01-01' },
      ]) {
        await expect(service.getOccupancyReport(ownerId, query(invalid))).rejects.toMatchObject({
          status: 400,
          response: { code: 'VALIDATION_ERROR' },
        });
      }
      expect(findOwnerOccupancyData).not.toHaveBeenCalled();

      const pipe = new ValidationPipe({ transform: true });
      for (const invalid of [{ from: '2026-02-30', to: '2026-03-01' }, { order: 'popular' }, { page: '0' }, { pageSize: '101' }]) {
        await expect(pipe.transform(invalid, {
          type: 'query',
          metatype: OccupancyReportQueryDto,
          data: '',
        })).rejects.toBeInstanceOf(BadRequestException);
      }

      await expect(service.getOccupancyReport(ownerId, query({ from: '2026-01-01', to: '2026-12-31' })))
        .resolves.toMatchObject({ periodDays: 365 });
    });

    it("AC4: requiere sesión OWNER: 401 sin sesión y 403 para TENANT o ADMIN", async () => {
      const jwtGuard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const noSessionContext = {
        getHandler: () => PropertiesController.prototype.getOccupancy,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(jwtGuard.canActivate(noSessionContext)).rejects.toMatchObject({ status: 401 });

      const rolesGuard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      for (const role of [Role.TENANT, Role.ADMIN]) {
        const context = {
          getHandler: () => PropertiesController.prototype.getOccupancy,
          getClass: () => PropertiesController,
          switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role } }) }),
        } as never;
        expectHttpExceptionStatus(() => rolesGuard.canActivate(context), 403);
      }
    });
  
});

function query(overrides: Partial<OccupancyReportQueryDto> = {}): OccupancyReportQueryDto {
  return Object.assign(new OccupancyReportQueryDto(), overrides);
}

function booking(propertyId: string, start: string, end: string) {
  return {
    propertyId,
    startDate: new Date(`${start}T00:00:00.000Z`),
    endDate: new Date(`${end}T00:00:00.000Z`),
  };
}
