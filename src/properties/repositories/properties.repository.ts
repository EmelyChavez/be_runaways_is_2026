import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type { CreatePropertyRequestDto } from '@Properties/dto';
import { Prisma, PropertyStatus, type Property } from '@PrismaClient';

const CATALOG_PAGE_SIZE = 12;
@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, data: CreatePropertyRequestDto, images: string[]): Promise<Property> {
    return this.prisma.property.create({
      data: {
        ownerId,
        title: data.title,
        description: data.description,
        category: data.category,
        department: data.department,
        municipality: data.municipality,
        address: data.address,
        pricePerDay: data.pricePerDay,
        securityDeposit: data.securityDeposit,
        images,
      },
    });
  }

  async findAvailablePage(
    page: number,
    filters: Prisma.PropertyWhereInput,
    q?: string,
  ) {
    const textConditions: Prisma.Sql[] = [];
    if (q) {
      textConditions.push(Prisma.sql`(
        strpos(unaccent(lower(coalesce(title, ''))), unaccent(lower(${q}))) > 0 OR
        strpos(unaccent(lower(coalesce(description, ''))), unaccent(lower(${q}))) > 0 OR
        strpos(unaccent(lower(coalesce(department, ''))), unaccent(lower(${q}))) > 0 OR
        strpos(unaccent(lower(coalesce(municipality, ''))), unaccent(lower(${q}))) > 0 OR
        strpos(unaccent(lower(coalesce(address, ''))), unaccent(lower(${q}))) > 0
      )`);
    }

    const matchingIds = textConditions.length
      ? await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id FROM properties WHERE ${Prisma.join(textConditions, ' AND ')}
        `)
      : undefined;

    const where: Prisma.PropertyWhereInput = {
      ...filters,
      ...(matchingIds && { id: { in: matchingIds.map(({ id }) => id) } }),
    };
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

  async findOwnerPage(ownerId: string, page: number) {
    const where = {
      ownerId,
      status: { in: [PropertyStatus.AVAILABLE, PropertyStatus.PAUSED] },
    };
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
          status: true,
        },
      }),
      this.prisma.property.count({ where }),
    ]);
    return { properties, total };
  }

  findOwnedById(ownerId: string, id: string, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.property.findFirst({
      where: {
        id,
        ownerId,
        status: { in: [PropertyStatus.AVAILABLE, PropertyStatus.PAUSED] },
      },
    });
  }

  countActiveBookings(propertyId: string, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.booking.count({
      where: { propertyId, status: { in: ['PENDING', 'PAID'] } },
    });
  }

  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation);
  }

  updateOwned(
    ownerId: string,
    id: string,
    data: CreatePropertyRequestDto,
    images: string[],
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.property.update({
      where: { id, ownerId },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        department: data.department,
        municipality: data.municipality,
        address: data.address,
        pricePerDay: data.pricePerDay,
        securityDeposit: data.securityDeposit,
        images,
      },
    });
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
