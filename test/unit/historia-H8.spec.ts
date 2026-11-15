import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import {
  BookingStatus,
  PropertyCategory,
  PropertyStatus,
  Role,
} from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertyCatalogQueryDto } from '../../src/properties/dto/property-catalog-query.dto.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe('H8: filtrar publicaciones por fechas disponibles', () => {
  const findAvailablePage = vi.fn();
  let service: PropertiesService;
  const fixedNow = new Date('2026-11-14T18:00:00.000Z');
  const startDate = '2026-11-20';
  const endDate = '2026-11-25';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    vi.clearAllMocks();
    findAvailablePage.mockResolvedValue({ properties: [], total: 0 });
    service = new PropertiesService({ findAvailablePage } as never, {} as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('casos positivos', () => {
    it('acepta fechas ISO válidas enviadas juntas', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, { startDate, endDate });

      expect(await validate(dto)).toHaveLength(0);
    });

    it('permite consultar el catálogo sin filtro cuando se omiten ambas fechas', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, { page: 1 });

      expect(await validate(dto)).toHaveLength(0);
      await service.listCatalog(dto);

      expect(findAvailablePage).toHaveBeenCalledWith(1, { status: PropertyStatus.AVAILABLE }, undefined);
    });

    it('combina disponibilidad con los demás filtros del catálogo', async () => {
      await service.listCatalog({
        page: 2,
        category: PropertyCategory.EQUIPMENT,
        minPrice: '10.00',
        maxPrice: '80.00',
        startDate,
        endDate,
        q: 'cámara',
      });

      const [page, filters, q] = findAvailablePage.mock.calls[0];
      expect(page).toBe(2);
      expect(q).toBe('cámara');
      expect(filters).toMatchObject({
        status: PropertyStatus.AVAILABLE,
        category: PropertyCategory.EQUIPMENT,
        pricePerDay: { gte: '10.00', lte: '80.00' },
        NOT: {
          OR: [
            {
              bookings: {
                some: {
                  startDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
                  endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
                  OR: [
                    { status: BookingStatus.PAID },
                    { status: BookingStatus.PENDING, expiresAt: { gt: fixedNow } },
                  ],
                },
              },
            },
            {
              availabilityBlocks: {
                some: {
                  startDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
                  endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
                },
              },
            },
          ],
        },
      });
    });

    it('solo considera ocupadas las reservas pagadas, las pendientes vigentes y los bloqueos traslapados', async () => {
      await service.listCatalog({ page: 1, startDate, endDate });
      const filters = findAvailablePage.mock.calls[0][1];
      const bookingFilter = filters.NOT.OR[0].bookings.some;

      expect(bookingFilter.OR).toEqual([
        { status: BookingStatus.PAID },
        { status: BookingStatus.PENDING, expiresAt: { gt: fixedNow } },
      ]);
      expect(bookingFilter.startDate.lte).toEqual(new Date(`${endDate}T00:00:00.000Z`));
      expect(bookingFilter.endDate.gte).toEqual(new Date(`${startDate}T00:00:00.000Z`));
      expect(filters.NOT.OR[1].availabilityBlocks.some).toEqual({
        startDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
        endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
      });
    });

    it('actualiza los criterios enviados al repositorio cuando cambian las fechas', async () => {
      await service.listCatalog({ page: 1, startDate: '2026-11-20', endDate: '2026-11-22' });
      await service.listCatalog({ page: 1, startDate: '2026-11-23', endDate: '2026-11-25' });

      expect(findAvailablePage.mock.calls[0][1].NOT.OR[0].bookings.some).toMatchObject({
        startDate: { lte: new Date('2026-11-22T00:00:00.000Z') },
        endDate: { gte: new Date('2026-11-20T00:00:00.000Z') },
      });
      expect(findAvailablePage.mock.calls[1][1].NOT.OR[0].bookings.some).toMatchObject({
        startDate: { lte: new Date('2026-11-25T00:00:00.000Z') },
        endDate: { gte: new Date('2026-11-23T00:00:00.000Z') },
      });
    });

    it('acepta un rango de 30 días y la fecha límite de 90 días', async () => {
      const maxDate = new Date(fixedNow);
      maxDate.setUTCDate(maxDate.getUTCDate() + 90);
      const horizonDate = maxDate.toISOString().slice(0, 10);
      const dto = plainToInstance(PropertyCatalogQueryDto, {
        startDate: horizonDate,
        endDate: horizonDate,
      });
      const thirtyDayRange = plainToInstance(PropertyCatalogQueryDto, {
        startDate: '2026-11-14',
        endDate: '2026-12-13',
      });

      expect(await validate(dto)).toHaveLength(0);
      expect(await validate(thirtyDayRange)).toHaveLength(0);
    });

    it('declara TENANT como único rol autorizado para el catálogo', () => {
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.listCatalog)).toEqual([Role.TENANT]);

      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.listCatalog,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.TENANT } }) }),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('casos negativos', () => {
    it('rechaza enviar solo una de las fechas', async () => {
      for (const query of [{ startDate }, { endDate }]) {
        const dto = plainToInstance(PropertyCatalogQueryDto, query);
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it('rechaza fechas ISO inválidas o inexistentes', async () => {
      for (const query of [
        { startDate: '20-11-2026', endDate },
        { startDate: '2026-02-30', endDate: '2026-03-01' },
      ]) {
        const dto = plainToInstance(PropertyCatalogQueryDto, query);
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it('rechaza fechas anteriores a hoy', async () => {
      for (const query of [
        { startDate: '2026-11-13', endDate: '2026-11-20' },
        { startDate: '2026-11-10', endDate: '2026-11-13' },
      ]) {
        const dto = plainToInstance(PropertyCatalogQueryDto, query);
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it('rechaza una fecha de fin anterior a la fecha de inicio', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, {
        startDate: '2026-11-25',
        endDate: '2026-11-24',
      });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rechaza rangos mayores de 30 días contando inicio y fin', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, {
        startDate: '2026-11-14',
        endDate: '2026-12-14',
      });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rechaza fechas posteriores al horizonte de 90 días', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, {
        startDate: '2027-02-12',
        endDate: '2027-02-13',
      });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rechaza solicitudes sin sesión con 401', async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => PropertiesController.prototype.listCatalog,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it('rechaza OWNER y ADMIN con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);

      for (const role of [Role.OWNER, Role.ADMIN]) {
        const context = {
          getHandler: () => PropertiesController.prototype.listCatalog,
          getClass: () => PropertiesController,
          switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
        } as never;

        expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
      }
    });
  });
});
