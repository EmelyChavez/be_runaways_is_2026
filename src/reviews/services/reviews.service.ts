import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@PrismaClient';
import type { CreatePropertyReviewDto } from '../dto/create-property-review.dto.js';
import { ReviewsRepository } from '../repositories/reviews.repository.js';

const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReviewsService {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

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

  private reviewConflict(message: string) {
    return new ConflictException({ code: 'REVIEW_NOT_ALLOWED', message });
  }
}
