import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { UsersService } from '@Users/services';
import { TokenService } from './token.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
import type { LoginDto } from '@Auth/dto';
import type { RegisterDto } from '@Auth/dto';
import type { TokenPair } from '@Auth/types';
import type { User } from '@PrismaClient';

/**
 * Hash descartable con el que se compara cuando el email no existe.
 *
 * Sin esto, un login contra un email no registrado respondería muchísimo más
 * rápido que uno contra una cuenta real (no habría bcrypt de por medio), y esa
 * diferencia de tiempo permite enumerar qué emails están registrados.
 * Corresponde a un valor aleatorio; nunca va a matchear.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7ttRFZIqjvBeT3M1kRDRm1gy9cKr9Wy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly loginRateLimitService: LoginRateLimitService,
  ) {}

  register(dto: RegisterDto): Promise<User> {
    return this.usersService.create(dto);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: User; tokens: TokenPair }> {
    const email = dto.email.trim().toLowerCase();
    await this.loginRateLimitService.assertAllowed(email);

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      const isLocked = await this.loginRateLimitService.recordFailure(email);
      if (isLocked) {
        throw new HttpException(
          'Demasiados intentos. Intenta nuevamente en 15 minutos.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const passwordMatches = await this.usersService.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      const isLocked = await this.loginRateLimitService.recordFailure(email);
      if (isLocked) {
        throw new HttpException(
          'Demasiados intentos. Intenta nuevamente en 15 minutos.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    await this.loginRateLimitService.clear(email);

    if (!user.isActive) {
      throw new ForbiddenException('La cuenta está deshabilitada.');
    }

    return { user, tokens: await this.tokenService.issueTokenPair(user) };
  }

  refresh(refreshToken: string): Promise<{ user: User; tokens: TokenPair }> {
    return this.tokenService.rotate(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokenService.revoke(refreshToken);
  }
}
