import { jest } from '@jest/globals';
import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookingStatus, Prisma, ReviewType, Role } from '../../src/generated/prisma/client.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingsService } from '../../src/bookings/services/bookings.service.js';
import { ProfileRoleService } from '../../src/profile/services/profile.service.js';
import { ReviewsController } from '../../src/reviews/controllers/reviews.controller.js';
import { CreateRenterReviewDto } from '../../src/reviews/dto/create-renter-review.dto.js';
import { ReviewsService } from '../../src/reviews/services/reviews.service.js';

describe("H18. Calificar experiencia con arrendatario", () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const bookingId = '33333333-3333-4333-8333-333333333333';
  const propertyId = '44444444-4444-4444-8444-444444444444';
  const tx = {};
  const serializableTransaction = jest.fn<(...args: any[]) => any>();
  const findBooking = jest.fn<(...args: any[]) => any>();
  const create = jest.fn<(...args: any[]) => any>();
  const findPropertyDetail = jest.fn<(...args: any[]) => any>();
  const getRenterRating = jest.fn<(...args: any[]) => any>();
  let service: ReviewsService;

  const makeBooking = (overrides: Record<string, unknown> = {}) => ({
    id: bookingId,
    tenantId,
    propertyId,
    status: BookingStatus.COMPLETED,
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    tenant: { id: tenantId, name: 'Arrendatario' },
    property: { ownerId },
    reviews: [],
    ...overrides,
  });

  const makeContext = (handler: Function, role?: Role) => ({
    getHandler: () => handler,
    getClass: () => ReviewsController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: ownerId, role } : undefined }) }),
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
    jest.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findBooking.mockResolvedValue(makeBooking());
    create.mockResolvedValue({ id: 'review-id', createdAt: new Date('2026-11-18T12:00:00.000Z') });
    findPropertyDetail.mockResolvedValue(validDetail());
    getRenterRating.mockResolvedValue({ _avg: { userRating: 4.26 }, _count: { _all: 3 } });
    service = new ReviewsService({
      serializableTransaction,
      findBooking,
      create,
      findPropertyDetail,
      getRenterRating,
    } as never);
  });

  afterEach(() => jest.useRealTimers());

  
    it("AC1: publica la reseña, devuelve promedios y fecha ISO, y restringe la ruta a OWNER con HTTP 200", async () => {
      const handler = ReviewsController.prototype.createRenterReview;
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const result = await service.createRenterReview(ownerId, bookingId, {
        userRating: 5,
        comment: 'Fue puntual y cuidó bien el equipo.',
      });

      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.OWNER]);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
      expect(guard.canActivate(makeContext(handler, Role.OWNER))).toBe(true);
      expect(create).toHaveBeenCalledWith({
        reservationId: bookingId,
        propertyId,
        authorId: ownerId,
        targetUserId: tenantId,
        reviewType: ReviewType.OWNER_TO_RENTER,
        userRating: 5,
        comment: 'Fue puntual y cuidó bien el equipo.',
      }, tx);
      expect(result).toMatchObject({
        id: propertyId,
        tenant: { id: tenantId, name: 'Arrendatario', rating: { average: 4.3, count: 3 } },
        reviewCreatedAt: '2026-11-18T12:00:00.000Z',
      });
    });

    it("AC1: acepta comentario opcional y los límites válidos de puntuación y longitud", async () => {
      await service.createRenterReview(ownerId, bookingId, { userRating: 1 });
      expect(create).toHaveBeenCalledWith(expect.not.objectContaining({ comment: expect.anything() }), tx);

      const dto = plainToInstance(CreateRenterReviewDto, {
        userRating: 5,
        comment: 'x'.repeat(200),
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it("AC2: refleja el promedio del TENANT en su perfil y en las reservas del OWNER", async () => {
      const profileRepository = {
        findByUserId: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          id: tenantId,
          name: 'Arrendatario',
          email: 'tenant@example.com',
          role: Role.TENANT,
          profile: null,
        }),
        getReviews: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          _avg: { userRating: 4.26 },
          _count: { _all: 3 },
        }),
      };
      const profileService = new ProfileRoleService({} as never, profileRepository as never, {} as never);
      const profile = await profileService.getMyProfile(tenantId);

      expect(profileRepository.getReviews).toHaveBeenCalledWith(tenantId, ReviewType.OWNER_TO_RENTER);
      expect(profile.rating).toEqual({ average: 4.3, count: 3 });

      const bookingRepository = {
        listOwnerBookings: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          data: [{
            id: bookingId,
            tenantId,
            tenant: { name: 'Arrendatario' },
            property: { title: 'Casa de campo', securityDeposit: new Prisma.Decimal('20.00') },
            startDate: new Date('2026-11-10T00:00:00.000Z'),
            endDate: new Date('2026-11-11T00:00:00.000Z'),
            subtotal: new Prisma.Decimal('40.00'),
            status: BookingStatus.COMPLETED,
            expiresAt: new Date('2026-11-10T12:00:00.000Z'),
          }],
          total: 1,
        }),
        getRenterRatings: jest.fn<(...args: any[]) => any>().mockResolvedValue([{
          targetUserId: tenantId,
          _avg: { userRating: 4.26 },
          _count: { _all: 3 },
        }]),
      };
      const bookingsService = new BookingsService(bookingRepository as never, { emit: jest.fn<(...args: any[]) => any>() } as never);
      const bookings = await bookingsService.listForOwner(ownerId, { page: 1, pageSize: 10 });

      expect(bookingRepository.getRenterRatings).toHaveBeenCalledWith([tenantId]);
      expect(bookings.data[0].tenant).toEqual({ name: 'Arrendatario', rating: { average: 4.3, count: 3 } });
    });

    it("AC3: permite calificar exactamente al cumplirse los 14 días", async () => {
      findBooking.mockResolvedValue(makeBooking({
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      }));

      await expect(service.createRenterReview(ownerId, bookingId, { userRating: 4 })).resolves.toMatchObject({
        reviewCreatedAt: '2026-11-18T12:00:00.000Z',
      });
    });
  

  
    it("AC4: devuelve 404 para una reserva inexistente o de un bien ajeno", async () => {
      for (const booking of [null, makeBooking({ property: { ownerId: tenantId } })]) {
        findBooking.mockResolvedValueOnce(booking);
        await expect(service.createRenterReview(ownerId, bookingId, { userRating: 4 }))
          .rejects.toMatchObject({ status: 404 });
      }
    });

    it("AC4: devuelve 409 si la reserva no está COMPLETED, ya fue calificada o venció el plazo", async () => {
      const invalidBookings = [
        makeBooking({ status: BookingStatus.PAID }),
        makeBooking({ reviews: [{ id: 'existing-review' }] }),
        makeBooking({ updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 - 1) }),
      ];
      for (const booking of invalidBookings) {
        findBooking.mockResolvedValueOnce(booking);
        await expect(service.createRenterReview(ownerId, bookingId, { userRating: 4 }))
          .rejects.toMatchObject({ status: 409 });
      }
      expect(create).not.toHaveBeenCalled();
    });

    it("AC5: rechaza puntuaciones inválidas y comentarios que exceden longitud o tipo", async () => {
      for (const userRating of [0, 6, 2.5, '5']) {
        const dto = plainToInstance(CreateRenterReviewDto, { userRating });
        expect(await validate(dto)).not.toHaveLength(0);
      }
      for (const comment of ['x'.repeat(201), 123]) {
        const dto = plainToInstance(CreateRenterReviewDto, { userRating: 4, comment });
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it("AC4: convierte duplicados y conflictos serializables de Prisma en 409", async () => {
      for (const code of ['P2002', 'P2034']) {
        const prismaError = new Prisma.PrismaClientKnownRequestError('conflict', {
          code,
          clientVersion: 'test',
        });
        if (code === 'P2002') create.mockRejectedValueOnce(prismaError);
        else serializableTransaction.mockRejectedValueOnce(prismaError);

        await expect(service.createRenterReview(ownerId, bookingId, { userRating: 4 }))
          .rejects.toMatchObject({ status: 409 });
      }
    });

    it("AC5: responde 401 sin sesión y 403 a TENANT y ADMIN", async () => {
      const handler = ReviewsController.prototype.createRenterReview;
      const jwtGuard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const context = {
        getHandler: () => handler,
        getClass: () => ReviewsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(jwtGuard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);

      const rolesGuard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      for (const role of [Role.TENANT, Role.ADMIN]) {
        expect(() => rolesGuard.canActivate(makeContext(handler, role))).toThrow(ForbiddenException);
      }
    });
  
});
