import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { LoginAttemptRepository } from '@Auth/repositories';
import type { EnvConfig } from '@Config';

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
      throw new HttpException(
        'Demasiados intentos. Intenta nuevamente en 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string): Promise<boolean> {
    return this.loginAttemptRepository.recordFailure(
      this.getKeyHashes(email),
    );
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
}
