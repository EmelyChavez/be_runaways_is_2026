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
}
