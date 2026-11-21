import { jest } from '@jest/globals';
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role } from '../../src/generated/prisma/client.js';
import { BookingsService } from '../../src/bookings/services/bookings.service.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe("H3. Detalle de un bien", () => {
  const propertyId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const findAvailableById = jest.fn<(...args: any[]) => any>();
  const findPropertyRating = jest.fn<(...args: any[]) => any>();
  const findUserRating = jest.fn<(...args: any[]) => any>();
  const findPropertyReviews = jest.fn<(...args: any[]) => any>();

  const makeProperty = (overrides: Record<string, unknown> = {}) => ({
    id: propertyId,
    title: 'Casa de campo',
    description: 'Casa amplia y equipada para disfrutar en familia.',
    category: 'PROPERTY',
    department: 'La Libertad',
    municipality: 'Santa Tecla',
    pricePerDay: { toFixed: () => '45.00' },
    securityDeposit: { toFixed: () => '100.00' },
    images: ['https://images.example/cover.jpg', 'https://images.example/room.jpg'],
    owner: { id: ownerId, name: 'Ana Pérez' },
    ...overrides,
  });

  let service: PropertiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    findAvailableById.mockResolvedValue(makeProperty());
    findPropertyRating.mockResolvedValue({
      _avg: { propertyRating: 4.54 },
      _count: { _all: 12 },
    });
    findUserRating.mockResolvedValue({ _avg: { userRating: null }, _count: { _all: 0 } });
    findPropertyReviews.mockResolvedValue([]);
    service = new PropertiesService({
      findAvailableById,
      findPropertyRating,
      findUserRating,
      findPropertyReviews,
    } as never, {} as never);
  });


    it("AC1: devuelve fotos, información completa del bien, precio, depósito y nombre del arrendador", async () => {
      const result = await service.getDetail(propertyId);

      expect(findAvailableById).toHaveBeenCalledWith(propertyId);
      expect(result).toMatchObject({
        id: propertyId,
        title: 'Casa de campo',
        description: 'Casa amplia y equipada para disfrutar en familia.',
        category: 'PROPERTY',
        department: 'La Libertad',
        municipality: 'Santa Tecla',
        pricePerDay: '45.00',
        securityDeposit: '100.00',
        images: ['https://images.example/cover.jpg', 'https://images.example/room.jpg'],
        owner: { id: ownerId, name: 'Ana Pérez' },
      });
    });

    it("AC2: devuelve el promedio de calificación con un decimal y la cantidad de reseñas", async () => {
      const result = await service.getDetail(propertyId);

      expect(result.propertyRatingAverage).toBe('4.5');
      expect(result.propertyReviewCount).toBe(12);
    });

    it("AC2: devuelve calificación nula y cero reseñas cuando no hay calificaciones", async () => {
      findPropertyRating.mockResolvedValueOnce({
        _avg: { propertyRating: null },
        _count: { _all: 0 },
      });

      const result = await service.getDetail(propertyId);

      expect(result.propertyRatingAverage).toBeNull();
      expect(result.propertyReviewCount).toBe(0);
    });

    it("AC1: devuelve el depósito cero con dos decimales para que el cliente lo presente como Sin depósito", async () => {
      findAvailableById.mockResolvedValueOnce(makeProperty({ securityDeposit: { toFixed: () => '0.00' } }));

      const result = await service.getDetail(propertyId);

      expect(result.securityDeposit).toBe('0.00');
    });

    it("AC4: autoriza el endpoint de detalle a TENANT", () => {
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.getDetail)).toEqual([Role.TENANT]);
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.getDetail,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.TENANT } }) }),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });



    it.each(['PAUSED', 'DELETED', 'inexistente'])(
      "AC4: rechaza el detalle de un bien %s con 404", async () => {
        const findFirst = jest.fn<(...args: any[]) => any>().mockResolvedValue(null);
        const repository = new PropertiesRepository({ property: { findFirst } } as never);
        const unavailableService = new PropertiesService(repository, {} as never);

        await expect(unavailableService.getDetail(propertyId)).rejects.toMatchObject({
          status: 404,
          response: expect.objectContaining({
            code: 'PROPERTY_NOT_AVAILABLE',
            message: 'Este bien no existe o no está disponible',
          }),
        });
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: propertyId, status: 'AVAILABLE' },
        }));
      },
    );

    it("AC4: rechaza la consulta del detalle sin sesión con 401", async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const context = {
        getHandler: () => PropertiesController.prototype.getDetail,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it("AC3: bloquea la reserva de un bien que exige verificación si el perfil del arrendatario no está verificado", async () => {
      const tx = {};
      const findVerifiedProfile = jest.fn<(...args: any[]) => any>().mockResolvedValue({ isVerified: false });
      const findAvailableProperty = jest.fn<(...args: any[]) => any>().mockResolvedValue({
        id: propertyId,
        ownerId,
        title: 'Casa de campo',
        verifiedOnly: true,
        pricePerDay: { toString: () => '45.00' },
      });
      const serializableTransaction = jest.fn<(operation: (transaction: typeof tx) => Promise<any>) => Promise<any>>((operation) => operation(tx));
      const createPendingBooking = jest.fn<(...args: any[]) => any>();
      const bookingsService = new BookingsService({
        serializableTransaction,
        findVerifiedProfile,
        findAvailableProperty,
        findOverlappingActiveBooking: jest.fn<(...args: any[]) => any>(),
        findOverlappingBlock: jest.fn<(...args: any[]) => any>(),
        createPendingBooking,
      } as never, { emit: jest.fn<(...args: any[]) => any>() } as never);

      const attemptBooking = bookingsService.create('tenant-1', {
        propertyId,
        startDate: '2026-11-20',
        endDate: '2026-11-20',
      });
      await expect(attemptBooking).rejects.toBeInstanceOf(ForbiddenException);
      await expect(attemptBooking).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          code: 'VERIFICATION_REQUIRED',
          message: 'Debes verificar tu cuenta para rentar.',
        }),
      });
      expect(findVerifiedProfile).toHaveBeenCalledWith('tenant-1', tx);
      expect(createPendingBooking).not.toHaveBeenCalled();
    });

});
