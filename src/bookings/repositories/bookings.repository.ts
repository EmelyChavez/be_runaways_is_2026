import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, PropertyStatus } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';

export interface CreatePendingBookingData {
  propertyId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  expiresAt: Date;
  subtotal: Prisma.Decimal;
}

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  serializableTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  findVerifiedProfile(tenantId: string, transaction: Prisma.TransactionClient) {
    return transaction.profile.findUnique({
      where: { userId: tenantId },
      select: { isVerified: true },
    });
  }

  findAvailableProperty(propertyId: string, transaction: Prisma.TransactionClient) {
    return transaction.property.findFirst({
      where: { id: propertyId, status: PropertyStatus.AVAILABLE },
      select: {
        id: true,
        ownerId: true,
        title: true,
        pricePerDay: true,
        securityDeposit: true,
      },
    });
  }

  findOverlappingActiveBooking(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    now: Date,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.booking.findFirst({
      where: {
        propertyId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        OR: [
          { status: BookingStatus.PAID },
          { status: BookingStatus.PENDING, expiresAt: { gt: now } },
        ],
      },
      select: { id: true },
    });
  }

  findOverlappingBlock(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.noAvailability.findFirst({
      where: {
        propertyId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
  }

  createPendingBooking(data: CreatePendingBookingData, transaction: Prisma.TransactionClient) {
    return transaction.booking.create({
      data: {
        propertyId: data.propertyId,
        tenantId: data.tenantId,
        startDate: data.startDate,
        endDate: data.endDate,
        subtotal: data.subtotal,
        expiresAt: data.expiresAt,
        status: BookingStatus.PENDING,
      },
    });
  }

  async listTenantBookings(tenantId: string, query: { status?: BookingStatus; page: number; pageSize: number }) {
    const where: Prisma.BookingWhereInput = {
      tenantId,
      ...(query.status && { status: query.status }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          propertyId: true,
          tenantId: true,
          startDate: true,
          endDate: true,
          subtotal: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          property: { select: { title: true, securityDeposit: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total };
  }

  async listOwnerBookings(
    ownerId: string,
    query: { propertyId?: string; status?: BookingStatus; page: number; pageSize: number },
  ) {
    const where: Prisma.BookingWhereInput = {
      property: { ownerId },
      ...(query.propertyId && { propertyId: query.propertyId }),
      ...(query.status && { status: query.status }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          propertyId: true,
          tenantId: true,
          startDate: true,
          endDate: true,
          subtotal: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          tenant: { select: { name: true } },
          property: { select: { title: true, securityDeposit: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total };
  }

  async cancelExpiredPendingBookings(now: Date) {
    const expired = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDING, expiresAt: { lte: now } },
      select: {
        id: true,
        tenantId: true,
        property: { select: { ownerId: true, title: true } },
      },
    });
    const canceled: Array<{
      id: string;
      tenantId: string;
      ownerId: string;
      propertyTitle: string;
    }> = [];

    for (const booking of expired) {
      const result = await this.prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.PENDING,
          expiresAt: { lte: now },
        },
        data: { status: BookingStatus.CANCELED },
      });
      if (result.count === 1) {
        canceled.push({
          id: booking.id,
          tenantId: booking.tenantId,
          ownerId: booking.property.ownerId,
          propertyTitle: booking.property.title,
        });
      }
    }
    return canceled;
  }
}
