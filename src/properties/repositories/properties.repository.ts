import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';

const CATALOG_PAGE_SIZE = 12;

@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailablePage(page: number) {
    const where = { status: 'AVAILABLE' as const };
    const [properties, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * CATALOG_PAGE_SIZE,
        take: CATALOG_PAGE_SIZE,
        select: {
          id: true,
          title: true,
          municipality: true,
          department: true,
          category: true,
          pricePerDay: true,
          images: true,
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return { properties, total };
  }

  findAvailableById(id: string) {
    return this.prisma.property.findFirst({
      where: { id, status: 'AVAILABLE' },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        department: true,
        municipality: true,
        pricePerDay: true,
        securityDeposit: true,
        images: true,
        owner: { select: { id: true, name: true } },
      },
    });
  }

  findPropertyRating(propertyId: string) {
    return this.prisma.review.aggregate({
      where: { propertyId, reviewType: 'RENTER_TO_PROPERTY' },
      _avg: { propertyRating: true },
      _count: { _all: true },
    });
  }

  findUserRating(userId: string) {
    return this.prisma.review.aggregate({
      where: { targetUserId: userId },
      _avg: { userRating: true },
      _count: { _all: true },
    });
  }

  findPropertyReviews(propertyId: string) {
    return this.prisma.review.findMany({
      where: { propertyId, reviewType: 'RENTER_TO_PROPERTY' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        propertyRating: true,
        userRating: true,
        comment: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
  }
}
