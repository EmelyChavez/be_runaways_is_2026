import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, ReviewType, Role, type PropertyStatus } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  serializableTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  findBooking(
    reservationId: string,
    transaction: Prisma.TransactionClient,
    reviewType: ReviewType = ReviewType.RENTER_TO_PROPERTY,
  ) {
    return transaction.booking.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        tenantId: true,
        propertyId: true,
        status: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true } },
        property: { select: { ownerId: true } },
        reviews: { where: { reviewType }, select: { id: true } },
      },
    });
  }

  create(data: {
    reservationId: string;
    propertyId: string;
    authorId: string;
    targetUserId: string;
    reviewType: ReviewType;
    propertyRating?: number;
    userRating: number;
    comment?: string;
  }, transaction: Prisma.TransactionClient) {
    return transaction.review.create({
      data: {
        ...data,
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

  getRenterRating(userId: string) {
    return this.prisma.review.aggregate({
      where: { targetUserId: userId, reviewType: ReviewType.OWNER_TO_RENTER },
      _avg: { userRating: true },
      _count: { _all: true },
    });
  }

  findRenter(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, role: Role.TENANT },
      select: { id: true, name: true },
    });
  }

  getRenterReviews(userId: string) {
    return this.prisma.review.findMany({
      where: { targetUserId: userId, reviewType: ReviewType.OWNER_TO_RENTER },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reservationId: true,
        userRating: true,
        comment: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
  }

  async getOwnerPropertyRatings(ownerId: string) {
    const properties = await this.prisma.property.findMany({
      where: { ownerId },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true, status: true },
    });
    if (properties.length === 0) return [];

    const ratings = await this.prisma.review.groupBy({
      by: ['propertyId'],
      where: {
        propertyId: { in: properties.map(({ id }) => id) },
        reviewType: ReviewType.RENTER_TO_PROPERTY,
      },
      _avg: { propertyRating: true },
      _count: { _all: true },
    });
    const ratingsByPropertyId = new Map(ratings.map((rating) => [rating.propertyId, rating]));

    return properties.map((property) => {
      const rating = ratingsByPropertyId.get(property.id);
      return {
        propertyId: property.id,
        title: property.title,
        status: property.status as PropertyStatus,
        averageRating: rating?._avg.propertyRating ?? null,
        reviewCount: rating?._count._all ?? 0,
      };
    });
  }
}
