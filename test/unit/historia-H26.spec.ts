import 'reflect-metadata';
import { BadRequestException, ForbiddenException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { PropertyStatus, ReviewType, Role } from '../../src/generated/prisma/client.js';
import { OwnerRatingsController } from '../../src/reviews/controllers/owner-ratings.controller.js';
import { OwnerRatingsQueryDto } from '../../src/reviews/dto/owner-ratings-query.dto.js';
import { ReviewsRepository } from '../../src/reviews/repositories/reviews.repository.js';
import { ReviewsService } from '../../src/reviews/services/reviews.service.js';

describe('H26: visualización de calificación de los bienes', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const ratedPropertyId = '22222222-2222-4222-8222-222222222222';
  const unratedPropertyId = '33333333-3333-4333-8333-333333333333';
  const lowPropertyId = '44444444-4444-4444-8444-444444444444';
  const noSessionId = '55555555-5555-4555-8555-555555555555';
  const reservationId = '66666666-6666-4666-8666-666666666666';
  const tenantId = '77777777-7777-4777-8777-777777777777';

  describe('casos positivos', () => {
    it('H26-U01 devuelve bienes propios con promedio y cantidad, e incluye los que no tienen reseñas', async () => {
      const propertyFindMany = vi.fn().mockResolvedValue([
        { id: ratedPropertyId, title: 'Casa de playa', status: PropertyStatus.AVAILABLE },
        { id: unratedPropertyId, title: 'Taladro', status: PropertyStatus.PAUSED },
      ]);
      const reviewGroupBy = vi.fn().mockResolvedValue([
        { propertyId: ratedPropertyId, _avg: { propertyRating: 4.25 }, _count: { _all: 2 } },
      ]);
      const repository = new ReviewsRepository({
        property: { findMany: propertyFindMany },
        review: { groupBy: reviewGroupBy },
      } as never);
      const service = new ReviewsService(repository);

      const result = await service.getOwnerPropertyRatings(ownerId, new OwnerRatingsQueryDto());

      expect(propertyFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId } }));
      expect(reviewGroupBy).toHaveBeenCalledWith(expect.objectContaining({
        by: ['propertyId'],
        where: { propertyId: { in: [ratedPropertyId, unratedPropertyId] }, reviewType: ReviewType.RENTER_TO_PROPERTY },
        _avg: { propertyRating: true },
        _count: { _all: true },
      }));
      expect(result).toMatchObject({
        total: 2,
        page: 1,
        data: [
          {
            propertyId: ratedPropertyId,
            title: 'Casa de playa',
            status: PropertyStatus.AVAILABLE,
            averageRating: 4.3,
            reviewCount: 2,
          },
          {
            propertyId: unratedPropertyId,
            title: 'Taladro',
            status: PropertyStatus.PAUSED,
            averageRating: null,
            reviewCount: 0,
          },
        ],
      });
    });

    it('H26-U02 refleja una nueva calificación en la siguiente consulta del reporte', async () => {
      let reviewCount = 0;
      const repository = {
        getOwnerPropertyRatings: vi.fn(async () => [{
          propertyId: ratedPropertyId,
          title: 'Casa de playa',
          status: PropertyStatus.AVAILABLE,
          averageRating: reviewCount === 0 ? null : 5,
          reviewCount,
        }]),
        serializableTransaction: vi.fn((operation) => operation({})),
        findBooking: vi.fn().mockResolvedValue({
          id: reservationId,
          tenantId,
          propertyId: ratedPropertyId,
          status: 'COMPLETED',
          updatedAt: new Date(),
          tenant: { id: tenantId, name: 'Arrendatario' },
          property: { ownerId },
          reviews: [],
        }),
        create: vi.fn(async () => {
          reviewCount += 1;
          return { id: 'review-id', createdAt: new Date() };
        }),
        findPropertyDetail: vi.fn().mockResolvedValue({
          id: ratedPropertyId,
          title: 'Casa de playa',
          pricePerDay: { toFixed: () => '45.00' },
          securityDeposit: { toFixed: () => '100.00' },
          owner: { id: ownerId, name: 'Arrendador' },
        }),
        getRatings: vi.fn(async () => [
          { _avg: { propertyRating: reviewCount === 0 ? null : 5 }, _count: { _all: reviewCount } },
          { _avg: { userRating: null }, _count: { _all: 0 } },
          [],
        ]),
      };
      const service = new ReviewsService(repository as never);
      const query = new OwnerRatingsQueryDto();

      const beforeNewReview = await service.getOwnerPropertyRatings(ownerId, query);
      await service.createPropertyReview(tenantId, reservationId, { propertyRating: 5, userRating: 4 });
      const afterNewReview = await service.getOwnerPropertyRatings(ownerId, query);

      expect(beforeNewReview.data[0]).toMatchObject({ averageRating: null, reviewCount: 0 });
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        propertyId: ratedPropertyId,
        reviewType: ReviewType.RENTER_TO_PROPERTY,
        propertyRating: 5,
      }), expect.anything());
      expect(afterNewReview.data[0]).toMatchObject({ averageRating: 5, reviewCount: 1 });
      expect(repository.getOwnerPropertyRatings).toHaveBeenCalledTimes(2);
    });

    it('H26-U03 ordena por promedio ascendente y descendente y deja sin calificación al final', async () => {
      const getOwnerPropertyRatings = vi.fn().mockResolvedValue([
        { propertyId: ratedPropertyId, title: 'Bien alto', status: PropertyStatus.AVAILABLE, averageRating: 4.8, reviewCount: 3 },
        { propertyId: lowPropertyId, title: 'Bien bajo', status: PropertyStatus.AVAILABLE, averageRating: 2.1, reviewCount: 2 },
        { propertyId: unratedPropertyId, title: 'Sin reseñas', status: PropertyStatus.PAUSED, averageRating: null, reviewCount: 0 },
      ]);
      const service = new ReviewsService({ getOwnerPropertyRatings } as never);

      const descending = await service.getOwnerPropertyRatings(ownerId, { ...new OwnerRatingsQueryDto(), order: 'desc' });
      const ascending = await service.getOwnerPropertyRatings(ownerId, { ...new OwnerRatingsQueryDto(), order: 'asc' });

      expect(descending.data.map(({ propertyId }) => propertyId)).toEqual([
        ratedPropertyId,
        lowPropertyId,
        unratedPropertyId,
      ]);
      expect(ascending.data.map(({ propertyId }) => propertyId)).toEqual([
        lowPropertyId,
        ratedPropertyId,
        unratedPropertyId,
      ]);
    });

    it('H26-U04 pagina el reporte y conserva el total de bienes propios', async () => {
      const getOwnerPropertyRatings = vi.fn().mockResolvedValue([
        { propertyId: ratedPropertyId, title: 'A', status: PropertyStatus.AVAILABLE, averageRating: 4.8, reviewCount: 3 },
        { propertyId: lowPropertyId, title: 'B', status: PropertyStatus.AVAILABLE, averageRating: 2.1, reviewCount: 2 },
        { propertyId: unratedPropertyId, title: 'C', status: PropertyStatus.PAUSED, averageRating: null, reviewCount: 0 },
      ]);
      const service = new ReviewsService({ getOwnerPropertyRatings } as never);

      const result = await service.getOwnerPropertyRatings(ownerId, {
        ...new OwnerRatingsQueryDto(),
        page: 2,
        pageSize: 1,
      });

      expect(result).toMatchObject({ total: 3, page: 2, data: [{ propertyId: lowPropertyId }] });
    });

    it('H26-U05 expone el reporte como GET de solo lectura y requiere OWNER de la sesión', () => {
      expect(Reflect.getMetadata(PATH_METADATA, OwnerRatingsController)).toBe('owner/reports');
      expect(Reflect.getMetadata(PATH_METADATA, OwnerRatingsController.prototype.getRatings)).toBe('ratings');
      expect(Reflect.getMetadata(METHOD_METADATA, OwnerRatingsController.prototype.getRatings)).toBe(0);
      expect(Reflect.getMetadata(ROLES_KEY, OwnerRatingsController.prototype.getRatings)).toEqual([Role.OWNER]);
      expect(Object.getOwnPropertyNames(OwnerRatingsController.prototype)).toEqual(['constructor', 'getRatings']);

      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => OwnerRatingsController.prototype.getRatings,
        getClass: () => OwnerRatingsController,
        switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.OWNER } }) }),
      } as never;
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('casos negativos', () => {
    it('H26-U06 rechaza orden y parámetros de paginación inválidos con 400', async () => {
      const pipe = new ValidationPipe({ transform: true });
      const invalidQueries = [
        { order: 'popular' },
        { page: '0' },
        { page: '1.5' },
        { pageSize: '101' },
        { pageSize: '-1' },
      ];

      for (const query of invalidQueries) {
        await expect(pipe.transform(query, {
          type: 'query',
          metatype: OwnerRatingsQueryDto,
          data: '',
        })).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(await validate(plainToInstance(OwnerRatingsQueryDto, { order: 'asc', page: '1', pageSize: '10' })))
        .toHaveLength(0);
    });

    it('H26-U07 deniega acceso sin sesión con 401', async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => OwnerRatingsController.prototype.getRatings,
        getClass: () => OwnerRatingsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('H26-U08 deniega TENANT y ADMIN con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);

      for (const role of [Role.TENANT, Role.ADMIN]) {
        const context = {
          getHandler: () => OwnerRatingsController.prototype.getRatings,
          getClass: () => OwnerRatingsController,
          switchToHttp: () => ({ getRequest: () => ({ user: { id: noSessionId, role } }) }),
        } as never;
        expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({
          status: 403,
          constructor: ForbiddenException,
        }));
      }
    });
  });
});
