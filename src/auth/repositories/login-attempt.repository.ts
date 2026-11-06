import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const RETENTION_MS = FAILURE_WINDOW_MS + LOCKOUT_MS;
const MAX_FAILURES = 5;

@Injectable()
export class LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isLocked(keyHashes: string[], now = new Date()): Promise<boolean> {
    const attempt = await this.prisma.loginAttempt.findFirst({
      where: {
        keyHash: { in: keyHashes },
        lockedUntil: { gt: now },
      },
      select: { keyHash: true },
    });
    return attempt !== null;
  }

  async recordFailure(keyHashes: string[], now = new Date()): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.loginAttempt.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      for (const keyHash of keyHashes) {
        let attempt = await transaction.loginAttempt.upsert({
          where: { keyHash },
          create: {
            keyHash,
            attempts: 1,
            windowStartedAt: now,
            expiresAt: new Date(now.getTime() + RETENTION_MS),
          },
          update: {
            attempts: { increment: 1 },
            expiresAt: new Date(now.getTime() + RETENTION_MS),
          },
        });

        if (now.getTime() - attempt.windowStartedAt.getTime() >= FAILURE_WINDOW_MS) {
          attempt = await transaction.loginAttempt.update({
            where: { keyHash },
            data: {
              attempts: 1,
              windowStartedAt: now,
              lockedUntil: null,
              expiresAt: new Date(now.getTime() + RETENTION_MS),
            },
          });
        }

        if (attempt.attempts >= MAX_FAILURES) {
          await transaction.loginAttempt.update({
            where: { keyHash },
            data: {
              lockedUntil: new Date(now.getTime() + LOCKOUT_MS),
              expiresAt: new Date(now.getTime() + RETENTION_MS),
            },
          });
        }
      }

      const lockedBucket = await transaction.loginAttempt.findFirst({
        where: {
          keyHash: { in: keyHashes },
          lockedUntil: { gt: now },
        },
        select: { keyHash: true },
      });
      return lockedBucket !== null;
    });
  }

  clear(keyHashes: string[]): Promise<{ count: number }> {
    return this.prisma.loginAttempt.deleteMany({
      where: { keyHash: { in: keyHashes } },
    });
  }
}
