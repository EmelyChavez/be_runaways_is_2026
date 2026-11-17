import 'reflect-metadata';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role, PropertyStatus } from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe('H2: consultar el catálogo de bienes disponibles', () => {
  const findAvailablePage = vi.fn();
  let service: PropertiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    findAvailablePage.mockResolvedValue({ properties: [], total: 0 });
    service = new PropertiesService({ findAvailablePage } as never, {} as never);
  });

  describe('casos positivos', () => {
    it('devuelve imagen, nombre, ubicación, categoría y precio con dos decimales para cada tarjeta', async () => {
      findAvailablePage.mockResolvedValueOnce({
        properties: [{
          id: 'property-1',
          title: 'Cámara profesional',
          municipality: 'Santa Tecla',
          department: 'La Libertad',
          category: 'EQUIPMENT',
          pricePerDay: { toFixed: vi.fn().mockReturnValue('45.00') },
          images: ['https://images.example/cover.jpg', 'https://images.example/second.jpg'],
        }],
        total: 1,
      });

      const result = await service.listCatalog({ page: 1 });

      expect(result.data[0]).toMatchObject({
        id: 'property-1',
        title: 'Cámara profesional',
        municipality: 'Santa Tecla',
        department: 'La Libertad',
        category: 'EQUIPMENT',
        pricePerDay: '45.00',
        images: ['https://images.example/cover.jpg', 'https://images.example/second.jpg'],
      });
      expect(result.pageSize).toBe(12);
    });

    it('devuelve el detalle del bien disponible seleccionado', async () => {
      const findAvailableById = vi.fn().mockResolvedValue({
        id: 'property-1',
        title: 'Cámara profesional',
        pricePerDay: { toFixed: () => '45.00' },
        securityDeposit: { toFixed: () => '100.00' },
        owner: { id: 'owner-1', name: 'Arrendador' },
      });
      const findPropertyRating = vi.fn().mockResolvedValue({ _avg: { propertyRating: null }, _count: { _all: 0 } });
      const findUserRating = vi.fn().mockResolvedValue({ _avg: { userRating: null }, _count: { _all: 0 } });
      const findPropertyReviews = vi.fn().mockResolvedValue([]);
      const detailService = new PropertiesService({
        findAvailableById,
        findPropertyRating,
        findUserRating,
        findPropertyReviews,
      } as never, {} as never);

      const result = await detailService.getDetail('property-1');

      expect(findAvailableById).toHaveBeenCalledWith('property-1');
      expect(result).toMatchObject({ id: 'property-1', title: 'Cámara profesional', pricePerDay: '45.00' });
    });

    it('consulta 12 bienes por página en orden de creación descendente y solo selecciona los campos del catálogo', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const repository = new PropertiesRepository({
        property: { findMany, count },
        $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      } as never);

      await repository.findAvailablePage(1, { status: PropertyStatus.AVAILABLE });

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: PropertyStatus.AVAILABLE },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 12,
        select: {
          id: true,
          title: true,
          municipality: true,
          department: true,
          category: true,
          pricePerDay: true,
          images: true,
        },
      }));
    });

    it('permite consultar páginas sucesivas y devuelve metadatos de la página solicitada', async () => {
      findAvailablePage.mockResolvedValueOnce({
        properties: [{ id: 'property-13', pricePerDay: { toFixed: () => '45.00' } }],
        total: 13,
      });

      const result = await service.listCatalog({ page: 2 });

      expect(findAvailablePage).toHaveBeenCalledWith(2, { status: PropertyStatus.AVAILABLE }, undefined);
      expect(result).toMatchObject({ data: [{ id: 'property-13' }], total: 13, page: 2, pageSize: 12 });
    });

    it('devuelve una lista vacía y total cero cuando no hay bienes disponibles', async () => {
      const result = await service.listCatalog({ page: 1 });

      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 12 });
    });

    it('autoriza el catálogo a TENANT', () => {
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
    it('excluye bienes PAUSED al limitar la consulta a AVAILABLE', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const repository = new PropertiesRepository({
        property: { findMany, count: vi.fn().mockResolvedValue(0) },
        $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      } as never);

      await repository.findAvailablePage(1, { status: PropertyStatus.AVAILABLE });

      expect(findMany.mock.calls[0][0].where).toEqual({ status: PropertyStatus.AVAILABLE });
      expect(findMany.mock.calls[0][0].where.status).not.toBe(PropertyStatus.PAUSED);
    });

    it('excluye bienes DELETED al limitar la consulta a AVAILABLE', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const repository = new PropertiesRepository({
        property: { findMany, count: vi.fn().mockResolvedValue(0) },
        $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      } as never);

      await repository.findAvailablePage(1, { status: PropertyStatus.AVAILABLE });

      expect(findMany.mock.calls[0][0].where).toEqual({ status: PropertyStatus.AVAILABLE });
      expect(findMany.mock.calls[0][0].where.status).not.toBe(PropertyStatus.DELETED);
    });

    it('rechaza el catálogo sin sesión con 401', async () => {
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
