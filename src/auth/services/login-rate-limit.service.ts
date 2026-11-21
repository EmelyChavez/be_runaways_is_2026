import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { LoginAttemptRepository } from '@Auth/repositories';
import type { EnvConfig } from '@Config';

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const RETENTION_MS = FAILURE_WINDOW_MS + LOCKOUT_MS;
const MAX_FAILURES = 5;

@Injectable()
export class LoginRateLimitService {
  private readonly hashSecret: string;

  constructor(
    private readonly loginAttemptRepository: LoginAttemptRepository,
    configService: ConfigService<EnvConfig, true>,
  ) {
    this.hashSecret = configService.get('JWT_SECRET', { infer: true });
  }

  async assertAllowed(email: string): Promise<void> {
    const keyHashes = this.getKeyHashes(email);
    if (await this.loginAttemptRepository.isLocked(keyHashes)) {
      throw this.tooManyAttemptsException();
    }
  }

  async recordFailure(email: string): Promise<boolean> {
    const keyHashes = this.getKeyHashes(email);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RETENTION_MS);

    return this.loginAttemptRepository.inTransaction(async (repository) => {
      await repository.deleteExpired(now);

      for (const keyHash of keyHashes) {
        let attempt = await repository.recordFailure(keyHash, now, expiresAt);

        if (now.getTime() - attempt.windowStartedAt.getTime() >= FAILURE_WINDOW_MS) {
          attempt = await repository.resetWindow(keyHash, now, expiresAt);
        }

        if (attempt.attempts >= MAX_FAILURES) {
          await repository.setLock(
            keyHash,
            new Date(now.getTime() + LOCKOUT_MS),
            expiresAt,
          );
        }
      }

      return repository.isLocked(keyHashes, now);
    });
  }

  async clear(email: string): Promise<void> {
    await this.loginAttemptRepository.clear(
      this.getKeyHashes(email),
    );
  }

  private getKeyHashes(email: string): string[] {
    const normalizedEmail = email.trim().toLowerCase();
    return [this.hashIdentifier(`email:${normalizedEmail}`)];
  }

  private hashIdentifier(identifier: string): string {
    return createHmac('sha256', this.hashSecret).update(identifier).digest('hex');
  }

  private tooManyAttemptsException(): HttpException {
    return new HttpException(
      'Demasiados intentos. Intenta nuevamente en 15 minutos.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
