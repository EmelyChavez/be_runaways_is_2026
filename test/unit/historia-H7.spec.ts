import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { PropertyCategory, PropertyStatus, Role } from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertyCatalogQueryDto } from '../../src/properties/dto/property-catalog-query.dto.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe('H7: filtro por rango de precio', () => {
  const findAvailablePage = vi.fn();
  let service: PropertiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    findAvailablePage.mockResolvedValue({ properties: [], total: 0 });
    service = new PropertiesService({ findAvailablePage } as never, {} as never);
  });

  describe('casos positivos', () => {
    it('acepta los límites válidos de precio y ambos valores iguales', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, { minPrice: '0.01', maxPrice: '9999.99' });
      const equalDto = plainToInstance(PropertyCatalogQueryDto, { minPrice: '45.00', maxPrice: '45.00' });

      expect(await validate(dto)).toHaveLength(0);
      expect(await validate(equalDto)).toHaveLength(0);
    });

    it('filtra desde el precio mínimo indicado, incluyéndolo', async () => {
      await service.listCatalog({ page: 1, minPrice: '25.00' });

      expect(findAvailablePage).toHaveBeenCalledWith(
        1,
        { status: PropertyStatus.AVAILABLE, pricePerDay: { gte: '25.00' } },
        undefined,
      );
    });

    it('filtra hasta el precio máximo indicado, incluyéndolo', async () => {
      await service.listCatalog({ page: 1, maxPrice: '80.00' });

      expect(findAvailablePage).toHaveBeenCalledWith(
        1,
        { status: PropertyStatus.AVAILABLE, pricePerDay: { lte: '80.00' } },
        undefined,
      );
    });

    it('incluye los bienes cuyo precio coincide con cualquiera de los límites', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const repository = new PropertiesRepository({
        property: { findMany, count },
        $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      } as never);

      await repository.findAvailablePage(1, {
        status: PropertyStatus.AVAILABLE,
        pricePerDay: { gte: '10.00', lte: '50.00' },
      });

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
        status: PropertyStatus.AVAILABLE,
        pricePerDay: { gte: '10.00', lte: '50.00' },
      } }));
      expect(count).toHaveBeenCalledWith({ where: {
        status: PropertyStatus.AVAILABLE,
        pricePerDay: { gte: '10.00', lte: '50.00' },
      } });
    });

    it('combina ambos precios con otros filtros del catálogo', async () => {
      await service.listCatalog({
        page: 2,
        minPrice: '10.00',
        maxPrice: '50.00',
        category: PropertyCategory.EQUIPMENT,
        department: 'La Libertad',
      });

      expect(findAvailablePage).toHaveBeenCalledWith(2, {
        status: PropertyStatus.AVAILABLE,
        department: { equals: 'La Libertad', mode: 'insensitive' },
        category: PropertyCategory.EQUIPMENT,
        pricePerDay: { gte: '10.00', lte: '50.00' },
      }, undefined);
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
    it.each([
      ['mínimo cero', { minPrice: '0' }],
      ['mínimo negativo', { minPrice: '-1.00' }],
      ['mínimo no numérico', { minPrice: 'abc' }],
      ['mínimo con más de dos decimales', { minPrice: '10.001' }],
      ['mínimo mayor al máximo permitido', { minPrice: '10000.00' }],
      ['máximo cero', { maxPrice: '0' }],
      ['máximo negativo', { maxPrice: '-1.00' }],
      ['máximo no numérico', { maxPrice: 'abc' }],
      ['máximo con más de dos decimales', { maxPrice: '10.001' }],
      ['máximo mayor al permitido', { maxPrice: '10000.00' }],
    ])('rechaza %s con error de validación', async (_description, query) => {
      const dto = plainToInstance(PropertyCatalogQueryDto, query);

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('rechaza un mínimo mayor que el máximo con mensaje que explica el problema', async () => {
      const dto = plainToInstance(PropertyCatalogQueryDto, { minPrice: '50.00', maxPrice: '10.00' });
      const errors = await validate(dto);

      expect(errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          property: 'maxPrice',
          constraints: expect.objectContaining({ priceRange: 'El precio mínimo no puede ser mayor que el precio máximo.' }),
        }),
      ]));
    });

    it('rechaza la consulta del catálogo sin sesión con 401', async () => {
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

    it.each([Role.OWNER, Role.ADMIN])('deniega el catálogo al rol %s con 403', (role) => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.listCatalog,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
    });
  });
});
