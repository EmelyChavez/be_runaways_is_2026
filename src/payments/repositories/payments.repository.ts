import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { BookingStatus, Prisma, TransactionType } from '@PrismaClient';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  serializableTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  findBookingForPayment(bookingId: string, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        tenantId: true,
        startDate: true,
        endDate: true,
        subtotal: true,
        status: true,
        expiresAt: true,
        tenant: { select: { profile: { select: { isVerified: true } } } },
        property: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            pricePerDay: true,
            securityDeposit: true,
            verifiedOnly: true,
          },
        },
      },
    });
  }

  markBookingPaid(bookingId: string, tenantId: string, now: Date, transaction: Prisma.TransactionClient) {
    return transaction.booking.updateMany({
      where: { id: bookingId, tenantId, status: BookingStatus.PENDING, expiresAt: { gt: now } },
      data: { status: BookingStatus.PAID },
    });
  }

  createPayment(
    data: {
      bookingId: string;
      payerId: string;
      receiptNumber: string;
      rentalAmount: Prisma.Decimal;
      depositAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      last4Digits: string;
    },
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.payment.create({ data });
  }

  createDeposit(bookingId: string, amount: Prisma.Decimal, transaction: Prisma.TransactionClient) {
    return transaction.deposit.create({ data: { bookingId, amount } });
  }

  createChargeHistory(
    bookingId: string,
    actorId: string,
    amount: Prisma.Decimal,
    reason: string,
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.transactionHistory.create({
      data: { bookingId, actorId, type: TransactionType.CHARGE, amount, reason },
    });
  }

  listTransactions(bookingId: string) {
    return this.prisma.transactionHistory.findMany({
      where: { bookingId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
