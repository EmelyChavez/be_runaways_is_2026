import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, ReviewType } from '@PrismaClient';
import type { CreatePropertyReviewDto } from '../dto/create-property-review.dto.js';
import type { CreateRenterReviewDto } from '../dto/create-renter-review.dto.js';
import type { OwnerRatingsQueryDto } from '../dto/owner-ratings-query.dto.js';
import { OwnerRatingsReportResponseDto } from '../dto/owner-ratings-report-response.dto.js';
import { ReviewsRepository } from '../repositories/reviews.repository.js';

const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReviewsService {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  async getOwnerPropertyRatings(ownerId: string, query: OwnerRatingsQueryDto) {
    const properties = await this.reviewsRepository.getOwnerPropertyRatings(ownerId);
    const direction = query.order === 'asc' ? 1 : -1;
    properties.sort((left, right) => {
      if (left.averageRating === null && right.averageRating !== null) return 1;
      if (left.averageRating !== null && right.averageRating === null) return -1;
      if (left.averageRating !== null && right.averageRating !== null) {
        const ratingOrder = (left.averageRating - right.averageRating) * direction;
        if (ratingOrder !== 0) return ratingOrder;
      }
      return left.title.localeCompare(right.title) || left.propertyId.localeCompare(right.propertyId);
    });

    const startIndex = (query.page - 1) * query.pageSize;
    const data = properties.slice(startIndex, startIndex + query.pageSize).map((property) => ({
      ...property,
      averageRating: property.averageRating === null
        ? null
        : Math.round(property.averageRating * 10) / 10,
    }));

    return new OwnerRatingsReportResponseDto({ data, total: properties.length, page: query.page });
  }

  async createPropertyReview(authorId: string, reservationId: string, dto: CreatePropertyReviewDto) {
    let propertyId: string;
    try {
      const result = await this.reviewsRepository.serializableTransaction(async (transaction) => {
        const booking = await this.reviewsRepository.findBooking(reservationId, transaction);
        if (!booking || booking.tenantId !== authorId) {
          throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'La reserva no existe o no te pertenece.' });
        }
        if (booking.status !== BookingStatus.COMPLETED) {
          throw this.reviewConflict('Solo puedes calificar una reserva finalizada.');
        }
        if (booking.reviews.length > 0) {
          throw this.reviewConflict('Esta reserva ya fue calificada.');
        }
        if (Date.now() - booking.updatedAt.getTime() > REVIEW_WINDOW_MS) {
          throw this.reviewConflict('El plazo de 14 días para calificar esta reserva venció.');
        }

        const review = await this.reviewsRepository.create({
          reservationId: booking.id,
          propertyId: booking.propertyId,
          authorId,
          targetUserId: booking.property.ownerId,
          reviewType: ReviewType.RENTER_TO_PROPERTY,
          propertyRating: dto.propertyRating,
          userRating: dto.userRating,
          ...(dto.comment !== undefined && { comment: dto.comment }),
        }, transaction);
        return { review, propertyId: booking.propertyId };
      });
      propertyId = result.propertyId;
      const detail = await this.reviewsRepository.findPropertyDetail(propertyId);
      if (!detail) throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien asociado no existe.' });
      const [propertyRating, ownerRating, reviews] = await this.reviewsRepository.getRatings(propertyId, detail.owner.id);
      return {
        ...detail,
        pricePerDay: detail.pricePerDay.toFixed(2),
        securityDeposit: detail.securityDeposit.toFixed(2),
        propertyRatingAverage: propertyRating._avg.propertyRating?.toFixed(1) ?? null,
        propertyReviewCount: propertyRating._count._all,
        ownerRatingAverage: ownerRating._avg.userRating?.toFixed(1) ?? null,
        ownerReviewCount: ownerRating._count._all,
        reviews,
        reviewCreatedAt: result.review.createdAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw this.reviewConflict('Esta reserva ya fue calificada.');
      }
      throw error;
    }
  }

  async createRenterReview(ownerId: string, reservationId: string, dto: CreateRenterReviewDto) {
    try {
      const result = await this.reviewsRepository.serializableTransaction(async (transaction) => {
        const booking = await this.reviewsRepository.findBooking(
          reservationId,
          transaction,
          ReviewType.OWNER_TO_RENTER,
        );
        if (!booking || booking.property.ownerId !== ownerId) {
          throw new NotFoundException({
            code: 'BOOKING_NOT_FOUND',
            message: 'La reserva no existe o no pertenece a uno de tus bienes.',
          });
        }
        if (booking.status !== BookingStatus.COMPLETED) {
          throw this.reviewConflict('Solo puedes calificar una reserva finalizada.');
        }
        if (booking.reviews.length > 0) {
          throw this.reviewConflict('Esta reserva ya fue calificada.');
        }
        if (Date.now() - booking.updatedAt.getTime() > REVIEW_WINDOW_MS) {
          throw this.reviewConflict('El plazo de 14 días para calificar esta reserva venció.');
        }

        const review = await this.reviewsRepository.create({
          reservationId: booking.id,
          propertyId: booking.propertyId,
          authorId: ownerId,
          targetUserId: booking.tenantId,
          reviewType: ReviewType.OWNER_TO_RENTER,
          userRating: dto.userRating,
          ...(dto.comment !== undefined && { comment: dto.comment }),
        }, transaction);
        return { review, booking };
      });

      const detail = await this.reviewsRepository.findPropertyDetail(result.booking.propertyId);
      if (!detail) {
        throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien asociado no existe.' });
      }
      const rating = await this.reviewsRepository.getRenterRating(result.booking.tenantId);
      return {
        ...detail,
        pricePerDay: detail.pricePerDay.toFixed(2),
        securityDeposit: detail.securityDeposit.toFixed(2),
        tenant: {
          id: result.booking.tenant.id,
          name: result.booking.tenant.name,
          rating: {
            average: rating._avg.userRating === null
              ? null
              : Math.round(rating._avg.userRating * 10) / 10,
            count: rating._count._all,
          },
        },
        reviewCreatedAt: result.review.createdAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw this.reviewConflict('Esta reserva ya fue calificada.');
      }
      throw error;
    }
  }

  async getRenterReviews(tenantId: string) {
    const tenant = await this.reviewsRepository.findRenter(tenantId);
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'El arrendatario no existe.',
      });
    }
    const [rating, reviews] = await Promise.all([
      this.reviewsRepository.getRenterRating(tenant.id),
      this.reviewsRepository.getRenterReviews(tenant.id),
    ]);
    return {
      tenant,
      averageRating: rating._avg.userRating === null
        ? null
        : Math.round(rating._avg.userRating * 10) / 10,
      reviewCount: rating._count._all,
      reviews: reviews.map((review) => ({
        ...review,
        createdAt: review.createdAt.toISOString(),
      })),
    };
  }

  private reviewConflict(message: string) {
    return new ConflictException({ code: 'REVIEW_NOT_ALLOWED', message });
  }
}
