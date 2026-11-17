import { Injectable } from '@nestjs/common';
import { BookingStatus, DepositStatus, Prisma, TransactionType } from '@PrismaClient';
import { PrismaService } from '@Prisma/services';

@Injectable()
export class DepositsRepository {
  constructor(private readonly prisma: PrismaService) {}

  serializableTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  findForBooking(bookingId: string, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.deposit.findUnique({
      where: { bookingId },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        state: true,
        retainedAmount: true,
        returnedAmount: true,
        decidedAt: true,
        booking: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
            tenantId: true,
            property: { select: { ownerId: true, title: true } },
          },
        },
      },
    });
  }

  findById(id: string, transaction: Prisma.TransactionClient) {
    return transaction.deposit.findUnique({
      where: { id },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        state: true,
        booking: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
            tenantId: true,
            property: { select: { ownerId: true, title: true } },
          },
        },
      },
    });
  }

  updateDecision(
    id: string,
    data: {
      state: DepositStatus;
      decidedById: string | null;
      retainedAmount: Prisma.Decimal;
      returnedAmount: Prisma.Decimal;
      decidedAt: Date;
    },
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.deposit.updateMany({
      where: { id, state: DepositStatus.PENDING },
      data,
    });
  }

  findAutoReturnCandidates(decisionDeadline: Date) {
    return this.prisma.deposit.findMany({
      where: {
        state: DepositStatus.PENDING,
        amount: { gt: new Prisma.Decimal(0) },
        booking: {
          status: BookingStatus.COMPLETED,
          updatedAt: { lte: decisionDeadline },
        },
      },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        booking: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
            tenantId: true,
            property: { select: { ownerId: true, title: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  createTransaction(
    bookingId: string,
    actorId: string | null,
    type: TransactionType,
    amount: Prisma.Decimal,
    reason: string,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.transactionHistory.create({
      data: { bookingId, actorId, type, amount, reason },
    });
  }
}
