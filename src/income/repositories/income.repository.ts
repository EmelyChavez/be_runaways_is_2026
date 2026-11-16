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
}
