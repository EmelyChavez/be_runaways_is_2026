import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role, PropertyCategory, PropertyStatus } from '../../src/generated/prisma/client.js';
import { PropertyCatalogQueryDto } from '../../src/properties/dto/property-catalog-query.dto.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe('H6: búsqueda de bienes por criterios', () => {
  const findAvailablePage = vi.fn();
  let service: PropertiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PropertiesService(
      { findAvailablePage } as never,
      {} as never,
    );
    findAvailablePage.mockResolvedValue({ properties: [], total: 0 });
  });

  describe('casos positivos', () => {
    it('busca por texto sin otros filtros y devuelve resultados y total', async () => {
      const properties = [{ id: 'p1', title: 'Casa céntrica', pricePerDay: { toFixed: () => '45.00' } }];
      findAvailablePage.mockResolvedValueOnce({ properties, total: 1 });

      const result = await service.listCatalog({ page: 1, q: 'casa' });

      expect(findAvailablePage).toHaveBeenCalledWith(1, { status: PropertyStatus.AVAILABLE }, 'casa');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('combina ubicación, categoría, ausencia de depósito y texto', async () => {
      await service.listCatalog({
        page: 1,
        q: 'cámara',
        department: 'San Salvador',
        municipality: 'San Salvador',
        category: PropertyCategory.EQUIPMENT,
        noDeposit: true,
      });

      expect(findAvailablePage).toHaveBeenCalledWith(
        1,
        {
          status: PropertyStatus.AVAILABLE,
          department: { equals: 'San Salvador', mode: 'insensitive' },
          municipality: { equals: 'San Salvador', mode: 'insensitive' },
          category: PropertyCategory.EQUIPMENT,
          securityDeposit: '0',
        },
        'cámara',
      );
    });

    it.each([PropertyCategory.PROPERTY, PropertyCategory.EQUIPMENT])(
      'filtra la categoría %s', async (category) => {
        await service.listCatalog({ page: 1, category });

        expect(findAvailablePage).toHaveBeenCalledWith(
          1,
          { status: PropertyStatus.AVAILABLE, category },
          undefined,
        );
      },
    );

    it('acepta búsqueda por departamento sin municipio', async () => {
      await service.listCatalog({ page: 1, department: 'La Libertad' });

      expect(findAvailablePage).toHaveBeenCalledWith(
        1,
        { status: PropertyStatus.AVAILABLE, department: { equals: 'La Libertad', mode: 'insensitive' } },
        undefined,
      );
    });

    it('actualiza resultados y total cuando cambian los filtros o se quita uno', async () => {
      findAvailablePage
        .mockResolvedValueOnce({ properties: [{ id: 'p1', pricePerDay: { toFixed: () => '10.00' } }], total: 1 })
        .mockResolvedValueOnce({ properties: [{ id: 'p2', pricePerDay: { toFixed: () => '20.00' } }], total: 1 })
        .mockResolvedValueOnce({ properties: [], total: 0 });

      const first = await service.listCatalog({ page: 1, category: PropertyCategory.PROPERTY, noDeposit: true });
      const changed = await service.listCatalog({ page: 1, category: PropertyCategory.EQUIPMENT, noDeposit: true });
      const filterRemoved = await service.listCatalog({ page: 1, category: PropertyCategory.EQUIPMENT });

      expect(first.data[0].id).toBe('p1');
      expect(changed.data[0].id).toBe('p2');
      expect(filterRemoved).toMatchObject({ data: [], total: 0, page: 1, pageSize: 12 });
      expect(findAvailablePage).toHaveBeenNthCalledWith(
        3,
        1,
        { status: PropertyStatus.AVAILABLE, category: PropertyCategory.EQUIPMENT },
        undefined,
      );
    });

    it('responde con lista vacía y total cero cuando no hay coincidencias', async () => {
      const result = await service.listCatalog({ page: 1, q: 'inexistente' });

      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 12 });
    });

    it('declara TENANT como único rol autorizado para el catálogo', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.listCatalog);

      expect(roles).toEqual([Role.TENANT]);
    });

    it('permite al rol TENANT pasar el guard de roles del catálogo', () => {
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
    it('rechaza municipio sin departamento y no consulta el repositorio', async () => {
      await expect(service.listCatalog({ page: 1, municipality: 'Santa Tecla' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(findAvailablePage).not.toHaveBeenCalled();
    });

    it.each([
      ['texto de un carácter', { q: 'a' }],
      ['texto de más de 100 caracteres', { q: 'a'.repeat(101) }],
      ['categoría inválida', { category: 'OTRA' }],
      ['noDeposit inválido', { noDeposit: 'sí' }],
    ])('rechaza %s', async (_description, query) => {
      const dto = plainToInstance(PropertyCatalogQueryDto, query);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('no declara OWNER ni ADMIN como roles autorizados para el catálogo', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.listCatalog) as Role[];

      expect(roles).not.toContain(Role.OWNER);
      expect(roles).not.toContain(Role.ADMIN);
    });

    it('rechaza una solicitud sin sesión con 401', async () => {
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

    it('rechaza el guard de roles si no hay usuario autenticado con 401', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.listCatalog,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 401 }));
    });

    it.each([Role.OWNER, Role.ADMIN])('rechaza el rol %s con 403', (role) => {
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
