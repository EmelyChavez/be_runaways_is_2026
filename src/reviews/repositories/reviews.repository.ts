import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, ReviewType } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  serializableTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  findBooking(reservationId: string, transaction: Prisma.TransactionClient) {
    return transaction.booking.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        status: true,
        updatedAt: true,
        property: { select: { ownerId: true } },
        reviews: { where: { reviewType: ReviewType.RENTER_TO_PROPERTY }, select: { id: true } },
      },
    });
  }

  create(data: {
    reservationId: string;
    propertyId: string;
    authorId: string;
    targetUserId: string;
    propertyRating: number;
    userRating: number;
    comment?: string;
  }, transaction: Prisma.TransactionClient) {
    return transaction.review.create({
      data: {
        ...data,
        reviewType: ReviewType.RENTER_TO_PROPERTY,
      },
      select: { id: true, createdAt: true },
    });
  }

  findPropertyDetail(propertyId: string) {
    return this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true, title: true, description: true, category: true, department: true,
        municipality: true, address: true, pricePerDay: true, securityDeposit: true,
        images: true, status: true, verifiedOnly: true,
        owner: { select: { id: true, name: true } },
      },
    });
  }

  getRatings(propertyId: string, ownerId: string) {
    return Promise.all([
      this.prisma.review.aggregate({
        where: { propertyId, reviewType: ReviewType.RENTER_TO_PROPERTY },
        _avg: { propertyRating: true }, _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { targetUserId: ownerId, reviewType: ReviewType.RENTER_TO_PROPERTY },
        _avg: { userRating: true }, _count: { _all: true },
      }),
      this.prisma.review.findMany({
        where: { propertyId, reviewType: ReviewType.RENTER_TO_PROPERTY },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, propertyRating: true, userRating: true, comment: true, createdAt: true,
          author: { select: { name: true } },
        },
      }),
    ]);
  }
}
