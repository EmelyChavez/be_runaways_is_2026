import { Injectable } from '@nestjs/common';
import { BookingStatus, DepositStatus, Prisma } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';

@Injectable()
export class IncomeRepository {
  constructor(private readonly prisma: PrismaService) {}

  rentalIncome(ownerId: string, from?: Date, to?: Date) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;

    return this.prisma.payment.aggregate({
      where: {
        ...(from || to ? { createdAt } : {}),
        booking: {
          status: { in: [BookingStatus.PAID, BookingStatus.COMPLETED] },
          property: { ownerId },
        },
      },
      _sum: { rentalAmount: true },
    });
  }

  retainedDepositIncome(ownerId: string, from?: Date, to?: Date) {
    const decidedAt: Prisma.DateTimeNullableFilter = {};
    if (from) decidedAt.gte = from;
    if (to) decidedAt.lte = to;

    return this.prisma.deposit.aggregate({
      where: {
        state: { in: [DepositStatus.RETAINED, DepositStatus.PARTIALLY_RETAINED] },
        ...(from || to ? { decidedAt: { ...decidedAt, not: null } } : {}),
        booking: { property: { ownerId } },
      },
      _sum: { retainedAmount: true },
    });
  }

  incomeByProperty(ownerId: string, from?: Date, to?: Date) {
    const createdAt: Prisma.DateTimeFilter = {};
    const decidedAt: Prisma.DateTimeNullableFilter = {};
    if (from) {
      createdAt.gte = from;
      decidedAt.gte = from;
    }
    if (to) {
      createdAt.lte = to;
      decidedAt.lte = to;
    }

    return Promise.all([
      this.prisma.property.findMany({
        where: { ownerId },
        select: { id: true, title: true, category: true },
      }),
      this.prisma.payment.findMany({
        where: {
          ...(from || to ? { createdAt } : {}),
          booking: {
            status: { in: [BookingStatus.PAID, BookingStatus.COMPLETED] },
            property: { ownerId },
          },
        },
        select: { rentalAmount: true, booking: { select: { propertyId: true } } },
      }),
      this.prisma.deposit.findMany({
        where: {
          state: { in: [DepositStatus.RETAINED, DepositStatus.PARTIALLY_RETAINED] },
          ...(from || to ? { decidedAt: { ...decidedAt, not: null } } : {}),
          booking: { property: { ownerId } },
        },
        select: { retainedAmount: true, booking: { select: { propertyId: true } } },
      }),
    ]).then(([properties, payments, deposits]) => ({ properties, payments, deposits }));
  }
}
