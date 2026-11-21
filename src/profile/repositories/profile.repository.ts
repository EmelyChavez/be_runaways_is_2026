import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import {
  Prisma,
  type BookingStatus,
  type DepositStatus,
  type PropertyStatus,
  type User,
} from '@PrismaClient';

/** Prisma rejected a serializable transaction because another write raced it. */
export class ConcurrentRoleChangeError extends Error {
  constructor() {
    super('The role change transaction conflicted with another write.');
    this.name = ConcurrentRoleChangeError.name;
  }
}

/** Database operations available to the role-change service in one transaction. */
export class ProfileRoleTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  findUserWithProfile(userId: string) {
    return this.transaction.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  async hasBookingWithStatuses(
    userId: string,
    statuses: BookingStatus[],
  ): Promise<boolean> {
    const booking = await this.transaction.booking.findFirst({
      where: {
        status: { in: statuses },
        OR: [
          { tenantId: userId },
          { property: { is: { ownerId: userId } } },
        ],
      },
      select: { id: true },
    });

    return booking !== null;
  }

  async hasDepositWithState(
    ownerId: string,
    state: DepositStatus,
  ): Promise<boolean> {
    const deposit = await this.transaction.deposit.findFirst({
      where: {
        state,
        booking: { is: { property: { is: { ownerId } } } },
      },
      select: { id: true },
    });

    return deposit !== null;
  }

  pauseProperties(ownerId: string, from: PropertyStatus, to: PropertyStatus) {
    return this.transaction.property.updateMany({
      where: { ownerId, status: from },
      data: { status: to },
    });
  }

  updateUserRole(userId: string, role: User['role']): Promise<User> {
    return this.transaction.user.update({
      where: { id: userId },
      data: { role },
    });
  }
}

@Injectable()
export class ProfileRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async inSerializableTransaction<T>(
    operation: (repository: ProfileRoleTransactionRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        (transaction) =>
          operation(new ProfileRoleTransactionRepository(transaction)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConcurrentRoleChangeError();
      }
      throw error;
    }
  }
}

/** Lecturas propias del perfil que no forman parte de la transacción de cambio de rol. */
@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        profile: { select: { isVerified: true, identityDocument: {
          select: { documentType: true, documentNumber: true, documentStatus: true },
        } } },
      },
    });
  }

  getReviews(userId: string, reviewType: 'RENTER_TO_PROPERTY' | 'OWNER_TO_RENTER') {
    return this.prisma.review.aggregate({
      where: { targetUserId: userId, reviewType },
      _avg: { userRating: true },
      _count: { _all: true },
    });
  }
}
