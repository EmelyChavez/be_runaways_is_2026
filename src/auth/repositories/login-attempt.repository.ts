import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma } from '@PrismaClient';

/** Database operations used to update login-attempt records atomically. */
export class LoginAttemptTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  deleteExpired(now: Date) {
    return this.transaction.loginAttempt.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }

  recordFailure(keyHash: string, now: Date, expiresAt: Date) {
    return this.transaction.loginAttempt.upsert({
      where: { keyHash },
      create: {
        keyHash,
        attempts: 1,
        windowStartedAt: now,
        expiresAt,
      },
      update: { attempts: { increment: 1 }, expiresAt },
    });
  }

  resetWindow(keyHash: string, now: Date, expiresAt: Date) {
    return this.transaction.loginAttempt.update({
      where: { keyHash },
      data: {
        attempts: 1,
        windowStartedAt: now,
        lockedUntil: null,
        expiresAt,
      },
    });
  }

  setLock(keyHash: string, lockedUntil: Date, expiresAt: Date) {
    return this.transaction.loginAttempt.update({
      where: { keyHash },
      data: { lockedUntil, expiresAt },
    });
  }

  async isLocked(keyHashes: string[], now: Date): Promise<boolean> {
    const attempt = await this.transaction.loginAttempt.findFirst({
      where: { keyHash: { in: keyHashes }, lockedUntil: { gt: now } },
      select: { keyHash: true },
    });
    return attempt !== null;
  }
}

@Injectable()
export class LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isLocked(keyHashes: string[], now = new Date()): Promise<boolean> {
    const attempt = await this.prisma.loginAttempt.findFirst({
      where: { keyHash: { in: keyHashes }, lockedUntil: { gt: now } },
      select: { keyHash: true },
    });
    return attempt !== null;
  }

  async inTransaction<T>(
    operation: (repository: LoginAttemptTransactionRepository) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (transaction) =>
            operation(new LoginAttemptTransactionRepository(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isSerializationConflict || attempt === 2) throw error;
      }
    }

    throw new Error('Serializable transaction retry loop ended unexpectedly.');
  }

  clear(keyHashes: string[]): Promise<{ count: number }> {
    return this.prisma.loginAttempt.deleteMany({
      where: { keyHash: { in: keyHashes } },
    });
  }
}
