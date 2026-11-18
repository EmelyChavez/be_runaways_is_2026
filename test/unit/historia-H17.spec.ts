import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { BookingStatus, Prisma, Role } from '../../src/generated/prisma/client.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { ReviewsController } from '../../src/reviews/controllers/reviews.controller.js';
import { CreatePropertyReviewDto } from '../../src/reviews/dto/create-property-review.dto.js';
import { ReviewsService } from '../../src/reviews/services/reviews.service.js';

describe('H17: calificar experiencia sobre un bien y su arrendador', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const ownerId = '22222222-2222-4222-8222-222222222222';
  const bookingId = '33333333-3333-4333-8333-333333333333';
  const propertyId = '44444444-4444-4444-8444-444444444444';
  const tx = {};
  const serializableTransaction = vi.fn();
  const findBooking = vi.fn();
  const create = vi.fn();
  const findPropertyDetail = vi.fn();
  const getRatings = vi.fn();
  let service: ReviewsService;

  const makeBooking = (overrides: Record<string, unknown> = {}) => ({
    id: bookingId,
    tenantId,
    propertyId,
    status: BookingStatus.COMPLETED,
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    property: { ownerId },
    reviews: [],
    ...overrides,
  });

  const makeContext = (handler: Function, role?: Role) => ({
    getHandler: () => handler,
    getClass: () => ReviewsController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: tenantId, role } : undefined }) }),
  }) as never;

  const validDetail = () => ({
    id: propertyId,
    title: 'Casa de campo',
    description: 'Espacio para descansar',
    category: 'PROPERTY',
    department: 'La Libertad',
    municipality: 'Santa Tecla',
    address: 'Centro',
    pricePerDay: new Prisma.Decimal('40.00'),
    securityDeposit: new Prisma.Decimal('20.00'),
    images: [],
    status: 'AVAILABLE',
    verifiedOnly: false,
    owner: { id: ownerId, name: 'Arrendador' },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
    vi.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findBooking.mockResolvedValue(makeBooking());
    create.mockResolvedValue({ id: 'review-id', createdAt: new Date('2026-11-18T12:00:00.000Z') });
    findPropertyDetail.mockResolvedValue(validDetail());
    getRatings.mockResolvedValue([
      { _avg: { propertyRating: 4.25 }, _count: { _all: 2 } },
      { _avg: { userRating: 4.75 }, _count: { _all: 2 } },
      [{ id: 'review-id', propertyRating: 5, userRating: 5, comment: 'Excelente', createdAt: new Date(), author: { name: 'Arrendatario' } }],
    ]);
    service = new ReviewsService({
      serializableTransaction,
      findBooking,
      create,
      findPropertyDetail,
      getRatings,
    } as never);
  });

  afterEach(() => vi.useRealTimers());

  describe('casos positivos', () => {
    it('H17-U01 publica la reseña y devuelve detalle, fecha ISO y promedios actualizados', async () => {
      const result = await service.createPropertyReview(tenantId, bookingId, {
        propertyRating: 5, userRating: 4, comment: 'Excelente experiencia',
      });

      expect(serializableTransaction).toHaveBeenCalledWith(expect.any(Function));
      expect(create).toHaveBeenCalledWith({
        reservationId: bookingId,
        propertyId,
        authorId: tenantId,
        targetUserId: ownerId,
        propertyRating: 5,
        userRating: 4,
        comment: 'Excelente experiencia',
      }, tx);
      expect(result).toMatchObject({
        id: propertyId,
        propertyRatingAverage: '4.3',
        propertyReviewCount: 2,
        ownerRatingAverage: '4.8',
        ownerReviewCount: 2,
        reviewCreatedAt: '2026-11-18T12:00:00.000Z',
      });
      expect(result.reviews).toHaveLength(1);
    });

    it('H17-U02 acepta calificar sin comentario', async () => {
      await service.createPropertyReview(tenantId, bookingId, { propertyRating: 1, userRating: 5 });

      expect(create).toHaveBeenCalledWith(expect.not.objectContaining({ comment: expect.anything() }), tx);
    });

    it('H17-U03 admite puntuaciones límite y un comentario de 200 caracteres', async () => {
      const dto = plainToInstance(CreatePropertyReviewDto, {
        propertyRating: 1,
        userRating: 5,
        comment: 'x'.repeat(200),
      });

      expect(await validate(dto)).toHaveLength(0);
    });

    it('H17-U04 permite publicar exactamente al cumplirse los 14 días', async () => {
      findBooking.mockResolvedValue(makeBooking({ updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 })).resolves.toMatchObject({
        reviewCreatedAt: '2026-11-18T12:00:00.000Z',
      });
    });

    it('H17-U05 permite el endpoint al rol TENANT', () => {
      const handler = ReviewsController.prototype.createPropertyReview;
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);

      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.TENANT]);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
      expect(guard.canActivate(makeContext(handler, Role.TENANT))).toBe(true);
    });
  });

  describe('casos negativos', () => {
    it('H17-U06 devuelve 404 cuando la reserva no existe', async () => {
      findBooking.mockResolvedValue(null);

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 404 });
    });

    it('H17-U07 devuelve 404 cuando la reserva pertenece a otro arrendatario', async () => {
      findBooking.mockResolvedValue(makeBooking({ tenantId: ownerId }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 404 });
    });

    it('H17-U08 devuelve 409 si la reserva no está finalizada', async () => {
      findBooking.mockResolvedValue(makeBooking({ status: BookingStatus.PAID }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('H17-U09 devuelve 409 si la reserva ya fue calificada', async () => {
      findBooking.mockResolvedValue(makeBooking({ reviews: [{ id: 'existing-review' }] }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('H17-U10 devuelve 409 si venció el plazo de 14 días', async () => {
      findBooking.mockResolvedValue(makeBooking({ updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 - 1) }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('H17-U11 convierte el duplicado de base de datos en conflicto 409', async () => {
      create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002', clientVersion: 'test',
      }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('H17-U12 convierte el conflicto serializable concurrente en 409', async () => {
      serializableTransaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034', clientVersion: 'test',
      }));

      await expect(service.createPropertyReview(tenantId, bookingId, { propertyRating: 5, userRating: 5 }))
        .rejects.toMatchObject({ status: 409 });
    });

    it('H17-U13 rechaza propertyRating fuera del rango o no entero', async () => {
      for (const propertyRating of [0, 6, 2.5, '5']) {
        const dto = plainToInstance(CreatePropertyReviewDto, { propertyRating, userRating: 4 });
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it('H17-U14 rechaza userRating fuera del rango o no entero', async () => {
      for (const userRating of [0, 6, 2.5, '5']) {
        const dto = plainToInstance(CreatePropertyReviewDto, { propertyRating: 4, userRating });
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it('H17-U15 rechaza comentarios de más de 200 caracteres', async () => {
      const dto = plainToInstance(CreatePropertyReviewDto, {
        propertyRating: 4, userRating: 4, comment: 'x'.repeat(201),
      });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('H17-U16 rechaza comentarios que no son texto', async () => {
      const dto = plainToInstance(CreatePropertyReviewDto, {
        propertyRating: 4, userRating: 4, comment: 123,
      });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it('H17-U17 responde 401 cuando falta la sesión', async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => ReviewsController.prototype.createPropertyReview,
        getClass: () => ReviewsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('H17-U18 deniega al rol OWNER con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);

      expect(() => guard.canActivate(makeContext(ReviewsController.prototype.createPropertyReview, Role.OWNER)))
        .toThrow(ForbiddenException);
    });

    it('H17-U19 deniega al rol ADMIN con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);

      expect(() => guard.canActivate(makeContext(ReviewsController.prototype.createPropertyReview, Role.ADMIN)))
        .toThrow(ForbiddenException);
    });
  });
});
