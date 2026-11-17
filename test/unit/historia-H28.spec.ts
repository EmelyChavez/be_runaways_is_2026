import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '../../src/generated/prisma/client.js';
import { AuthController } from '../../src/auth/controllers/auth.controller.js';
import { LoginDto } from '../../src/auth/dto/login.dto.js';
import { RefreshTokenDto } from '../../src/auth/dto/refresh-token.dto.js';
import { RegisterDto } from '../../src/auth/dto/register.dto.js';
import { AuthResponseDto } from '../../src/auth/dto/auth-response.dto.js';
import { RegisterResponseDto } from '../../src/auth/dto/register-response.dto.js';
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { AuthService } from '../../src/auth/services/auth.service.js';
import { LoginRateLimitService } from '../../src/auth/services/login-rate-limit.service.js';
import { TokenService } from '../../src/auth/services/token.service.js';
import { UserRepository } from '../../src/users/repositories/user.repository.js';
import { UsersService } from '../../src/users/services/users.service.js';
import { EmailAlreadyTakenError } from '../../src/users/errors/email-already-taken.error.js';

describe('H28: registro, inicio, renovación y cierre de sesión', () => {
  const prismaCreate = vi.fn();
  const repositoryCreate = vi.fn();
  const findByEmail = vi.fn();
  const verifyPassword = vi.fn();
  const assertAllowed = vi.fn();
  const recordFailure = vi.fn();
  const clear = vi.fn();
  const issueTokenPair = vi.fn();
  const rotate = vi.fn();
  const revoke = vi.fn();
  let authService: AuthService;

  const user = {
    id: 'user-uuid', name: 'Ana', email: 'ana@example.com', role: Role.TENANT,
    isActive: true, createdAt: new Date('2026-11-16T12:00:00.000Z'),
    passwordHash: 'secret-hash',
  };
  const tokens = { accessToken: 'access.jwt', refreshToken: 'refresh-token', expiresIn: 900 };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaCreate.mockResolvedValue(user);
    repositoryCreate.mockResolvedValue(user);
    findByEmail.mockResolvedValue(user);
    verifyPassword.mockResolvedValue(true);
    assertAllowed.mockResolvedValue(undefined);
    recordFailure.mockResolvedValue(false);
    clear.mockResolvedValue(undefined);
    issueTokenPair.mockResolvedValue(tokens);
    rotate.mockResolvedValue({ user, tokens });
    revoke.mockResolvedValue(undefined);
    authService = new AuthService(
      { create: repositoryCreate, findByEmail, verifyPassword } as never,
      { issueTokenPair, rotate, revoke } as never,
      { assertAllowed, recordFailure, clear } as never,
    );
  });

  it('H28-U01 registra usuario con perfil 1:1 y rol TENANT', async () => {
    const repository = new UserRepository({ user: { create: prismaCreate } } as never);
    await repository.create({ email: 'ana@example.com', passwordHash: 'hash', name: 'Ana' });
    expect(prismaCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: 'ana@example.com', role: Role.TENANT, profile: { create: {} },
    }) });
  });

  it('H28-U02 normaliza el correo al registrar', async () => {
    const repository = new UserRepository({ user: { create: prismaCreate } } as never);
    await repository.create({ email: '  ANA@EXAMPLE.COM ', passwordHash: 'hash', name: 'Ana' });
    expect(prismaCreate.mock.calls[0][0].data.email).toBe('ana@example.com');
  });

  it('H28-U03 acepta contraseña que cumple largo y complejidad requerida', async () => {
    const dto = plainToInstance(RegisterDto, { name: 'Ana', email: 'ana@example.com', password: 'StrongPass1!' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('H28-U04 el login válido entrega el par de tokens', async () => {
    const result = await authService.login({ email: 'ana@example.com', password: 'StrongPass1!' } as LoginDto);
    expect(result).toEqual({ user, tokens });
    expect(issueTokenPair).toHaveBeenCalledWith(user);
    expect(AuthResponseDto.from(user as never, tokens)).toMatchObject({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: 900 });
  });

  it('H28-U05 emite access de 15 minutos y refresh de 7 días', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
    const create = vi.fn().mockResolvedValue({});
    const jwt = {
      signAsync: vi.fn().mockResolvedValue('signed-access'),
      verifyAsync: vi.fn().mockResolvedValue({ sub: user.id, email: user.email, role: user.role, iat: Date.now() / 1000, exp: Date.now() / 1000 + 900 }),
    };
    const tokenService = new TokenService({ create } as never, jwt as never, { get: () => 7 } as never);
    const result = await tokenService.issueTokenPair(user as never);
    expect(result.expiresIn).toBe(900);
    expect(create.mock.calls[0][0].expiresAt.getTime() - Date.now()).toBe(7 * 24 * 60 * 60 * 1000);
    vi.useRealTimers();
  });

  it('H28-U06 rota refresh token y entrega tokens nuevos', async () => {
    const now = Date.now();
    const stored = { id: 'refresh-id', tokenHash: 'hash', userId: user.id, expiresAt: new Date(now + 100_000), revokedAt: null, user };
    const findByTokenHashWithUser = vi.fn().mockResolvedValue(stored);
    const revokeById = vi.fn().mockResolvedValue({ ...stored, revokedAt: new Date() });
    const create = vi.fn().mockResolvedValue({});
    const jwt = {
      signAsync: vi.fn().mockResolvedValue('new-access'),
      verifyAsync: vi.fn().mockResolvedValue({ sub: user.id, email: user.email, role: user.role, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 900 }),
    };
    const service = new TokenService({ findByTokenHashWithUser, revokeById, create } as never, jwt as never, { get: () => 7 } as never);
    const result = await service.rotate('old-refresh');
    expect(revokeById).toHaveBeenCalledWith('refresh-id');
    expect(result.user).toBe(user);
    expect(result.tokens).toMatchObject({ accessToken: 'new-access', expiresIn: 900 });
    expect(create).toHaveBeenCalledOnce();
  });

  it('H28-U07 /auth/me devuelve el usuario de la sesión', () => {
    const result = AuthController.prototype.me.call({} as never, user as never);
    expect(result).toMatchObject({ id: user.id, email: user.email, role: Role.TENANT });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('H28-U08 logout público requiere refresh token y devuelve sin cuerpo', async () => {
    const controller = new AuthController(authService);
    await expect(controller.logout({ refreshToken: 'refresh-token' })).resolves.toBeUndefined();
    expect(revoke).toHaveBeenCalledWith('refresh-token');
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.logout)).toBe(true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.logout)).toBe(204);
  });

  it('H28-U09 login correcto limpia intentos fallidos', async () => {
    await authService.login({ email: 'ana@example.com', password: 'correcta' } as LoginDto);
    expect(clear).toHaveBeenCalledWith('ana@example.com');
  });

  it('H28-U10 las respuestas de registro y login no exponen contraseña ni hash', () => {
    expect(RegisterResponseDto.fromEntity(user as never)).not.toHaveProperty('passwordHash');
    expect(RegisterResponseDto.fromEntity(user as never)).not.toHaveProperty('password');
    const response = AuthResponseDto.from(user as never, tokens);
    expect(response.user).not.toHaveProperty('passwordHash');
    expect(response.user).not.toHaveProperty('password');
  });

  it.each([
    ['H28-U13', 'role', Role.ADMIN],
    ['H28-U14', 'unexpected', 'value'],
  ])('%s rechaza propiedad de registro no permitida', async (_id, field, value) => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ name: 'Ana', email: 'ana@example.com', password: 'StrongPass1!', [field]: value }, { type: 'body', metatype: RegisterDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('H28-U15 traduce correo duplicado a 409', async () => {
    const service = new UsersService({ create: vi.fn().mockRejectedValue(new EmailAlreadyTakenError('ana@example.com')) } as never, { get: () => 12 } as never);
    await expect(service.create({ email: 'ana@example.com', name: 'Ana', password: 'StrongPass1!' } as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['H28-U16', 'Short1!'],
    ['H28-U17', `A${'b'.repeat(71)}1!`],
  ])('%s rechaza contraseña fuera del largo permitido', async (_id, password) => {
    const dto = plainToInstance(RegisterDto, { name: 'Ana', email: 'ana@example.com', password });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it.each([
    ['H28-U18', 'STRONGPASS1!'],
    ['H28-U19', 'strongpass1!'],
    ['H28-U20', 'StrongPass!'],
    ['H28-U21', 'StrongPass1'],
  ])('%s rechaza contraseña sin el requisito de complejidad', async (_id, password) => {
    const dto = plainToInstance(RegisterDto, { name: 'Ana', email: 'ana@example.com', password });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('H28-U22 devuelve error genérico 401 para contraseña incorrecta', async () => {
    verifyPassword.mockResolvedValueOnce(false);
    await expect(authService.login({ email: 'ana@example.com', password: 'WrongPass1!' } as LoginDto)).rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos' });
  });

  it('H28-U23 devuelve el mismo error genérico para correo inexistente', async () => {
    findByEmail.mockResolvedValueOnce(null);
    await expect(authService.login({ email: 'missing@example.com', password: 'WrongPass1!' } as LoginDto))
      .rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos' });
  });

  it('H28-U24 cuenta deshabilitada y contraseña incorrecta conserva el 401 genérico', async () => {
    findByEmail.mockResolvedValueOnce({ ...user, isActive: false });
    verifyPassword.mockResolvedValueOnce(false);
    await expect(authService.login({ email: 'ana@example.com', password: 'WrongPass1!' } as LoginDto)).rejects.toMatchObject({ status: 401, message: 'Correo o contraseña incorrectos' });
  });

  it('H28-U25 cuenta deshabilitada y contraseña correcta responde 403', async () => {
    findByEmail.mockResolvedValueOnce({ ...user, isActive: false });
    await expect(authService.login({ email: 'ana@example.com', password: 'StrongPass1!' } as LoginDto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('H28-U26 limita por correo normalizado y bloquea tras cinco fallos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
    const attempts = new Map<string, { count: number; startedAt: Date; lockedUntil: Date | null }>();
    const isLocked = vi.fn(async (hashes: string[], now = new Date()) => hashes.some((hash) => {
      const value = attempts.get(hash);
      return Boolean(value?.lockedUntil && value.lockedUntil > now);
    }));
    const txRepo = {
      deleteExpired: vi.fn(),
      recordFailure: vi.fn((hash: string, now: Date) => {
        const current = attempts.get(hash) ?? { count: 0, startedAt: now, lockedUntil: null };
        current.count += 1;
        attempts.set(hash, current);
        return Promise.resolve({ attempts: current.count, windowStartedAt: current.startedAt });
      }),
      resetWindow: vi.fn((hash: string, now: Date) => {
        const next = { count: 1, startedAt: now, lockedUntil: null };
        attempts.set(hash, next);
        return Promise.resolve({ attempts: 1, windowStartedAt: now });
      }),
      setLock: vi.fn((hash: string, until: Date) => {
        const current = attempts.get(hash)!;
        current.lockedUntil = until;
        return Promise.resolve(undefined);
      }),
      isLocked,
    };
    const repository = {
      isLocked,
      inTransaction: vi.fn((operation) => operation(txRepo)),
    };
    const limit = new LoginRateLimitService(repository as never, { get: () => 'a'.repeat(32) } as never);
    for (const email of ['Demo@example.com', ' demo@example.com ', 'DEMO@EXAMPLE.COM', 'demo@example.com']) {
      expect(await limit.recordFailure(email)).toBe(false);
    }
    expect(await limit.recordFailure('demo@example.com')).toBe(true);
    await expect(limit.assertAllowed(' DEMO@example.com ')).rejects.toMatchObject({ status: 429 });
    expect(new Set(txRepo.recordFailure.mock.calls.map(([hash]) => hash)).size).toBe(1);
    vi.useRealTimers();
  });

  it('H28-U11 permite intentar login cuando vence el bloqueo de 15 minutos', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
    const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    const isLocked = vi.fn(async (_hashes: string[], now = new Date()) => lockUntil > now);
    const limit = new LoginRateLimitService({ isLocked } as never, { get: () => 'a'.repeat(32) } as never);
    await expect(limit.assertAllowed('ana@example.com')).rejects.toMatchObject({ status: 429 });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    await expect(limit.assertAllowed('ana@example.com')).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('H28-U27 /auth/me sin sesión responde 401', async () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: () => false } as never, {} as never, {} as never);
    const context = { getHandler: () => vi.fn(), getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as never;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('H28-U28 una sesión válida sin rol permitido recibe 403', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
    const context = { getHandler: () => vi.fn(), getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.TENANT } }) }) } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it.each([
    ['H28-U29', null],
    ['H28-U30', { id: 'expired', revokedAt: null, expiresAt: new Date(0), user }],
    ['H28-U31', { id: 'reused', userId: user.id, revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), user }],
  ])('%s rechaza refresh token inválido, expirado o reutilizado', async (_id, stored) => {
    const findByTokenHashWithUser = vi.fn().mockResolvedValue(stored);
    const revokeAllForUser = vi.fn().mockResolvedValue(1);
    const service = new TokenService({ findByTokenHashWithUser, revokeAllForUser } as never, {} as never, { get: () => 7 } as never);
    await expect(service.rotate('refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    if (stored?.revokedAt) expect(revokeAllForUser).toHaveBeenCalledWith(user.id);
  });

  it('H28-U12 nunca permite asignar ADMIN al registrar', async () => {
    const repository = new UserRepository({ user: { create: prismaCreate } } as never);
    await repository.create({ email: 'ana@example.com', passwordHash: 'hash', name: 'Ana' });
    expect(prismaCreate.mock.calls[0][0].data.role).toBe(Role.TENANT);
  });

  it('H28-U32 logout sin refresh token en el cuerpo es inválido', async () => {
    const dto = plainToInstance(RefreshTokenDto, {});
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
