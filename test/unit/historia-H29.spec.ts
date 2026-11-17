import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role, PropertyStatus, BookingStatus, DepositStatus } from '../../src/generated/prisma/client.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { BookingsController } from '../../src/bookings/controllers/bookings.controller.js';
import { PaymentsController } from '../../src/payments/controllers/payments.controller.js';
import { ChangeRoleDto } from '../../src/profile/dto/change-role.dto.js';
import { ProfileController } from '../../src/profile/controllers/profile.controller.js';
import { ProfileRoleService } from '../../src/profile/services/profile.service.js';

describe('H29: consulta de perfil y cambio de rol', () => {
  const findByUserId = vi.fn();
  const getReviews = vi.fn();
  const inSerializableTransaction = vi.fn();
  const findUserWithProfile = vi.fn();
  const hasBookingWithStatuses = vi.fn();
  const hasDepositWithState = vi.fn();
  const pauseProperties = vi.fn();
  const updateUserRole = vi.fn();
  const issueTokenPair = vi.fn();
  const tx = { findUserWithProfile, hasBookingWithStatuses, hasDepositWithState, pauseProperties, updateUserRole };
  let service: ProfileRoleService;

  const tenantId = 'tenant-uuid';
  const timestamp = new Date('2026-11-16T12:00:00.000Z');
  const tenantUser = { id: tenantId, name: 'Ana', email: 'ana@example.com', role: Role.TENANT, updatedAt: timestamp, isActive: true, profile: { isVerified: true } };
  const tokenPair = { accessToken: 'access-new', refreshToken: 'refresh-new', expiresIn: 900 };

  beforeEach(() => {
    vi.clearAllMocks();
    findByUserId.mockResolvedValue({
      id: tenantId, name: 'Ana', email: 'ana@example.com', role: Role.TENANT,
      profile: { isVerified: true, identityDocument: { documentType: 'DUI', documentNumber: '01234567-8', documentStatus: 'APPROVED' } },
    });
    getReviews.mockResolvedValue({ _avg: { userRating: 4.26 }, _count: { _all: 5 } });
    inSerializableTransaction.mockImplementation((operation) => operation(tx));
    findUserWithProfile.mockResolvedValue(tenantUser);
    hasBookingWithStatuses.mockResolvedValue(false);
    hasDepositWithState.mockResolvedValue(false);
    pauseProperties.mockResolvedValue({ count: 1 });
    updateUserRole.mockImplementation(async (_id, role) => ({ ...tenantUser, role, updatedAt: timestamp }));
    issueTokenPair.mockResolvedValue(tokenPair);
    service = new ProfileRoleService(
      { inSerializableTransaction } as never,
      { findByUserId, getReviews } as never,
      { issueTokenPair } as never,
    );
  });

  it('H29-U01 devuelve el perfil de la sesión y enmascara el documento', async () => {
    const result = await service.getMyProfile(tenantId);
    expect(findByUserId).toHaveBeenCalledWith(tenantId);
    expect(result).toMatchObject({ userId: tenantId, name: 'Ana', email: 'ana@example.com', role: Role.TENANT, isVerified: true });
    expect(result.document).toEqual({ type: 'DUI', number: '••••••67-8', status: 'APPROVED' });
  });

  it('H29-U02 devuelve document null si no existe documento', async () => {
    findByUserId.mockResolvedValueOnce({ ...await findByUserId(), profile: { isVerified: false, identityDocument: null } });
    const result = await service.getMyProfile(tenantId);
    expect(result.document).toBeNull();
  });

  it('H29-U03 calcula el promedio recibido como OWNER con reseñas RENTER_TO_PROPERTY', async () => {
    findByUserId.mockResolvedValueOnce({ ...await findByUserId(), role: Role.OWNER });
    const result = await service.getMyProfile(tenantId);
    expect(getReviews).toHaveBeenCalledWith(tenantId, 'RENTER_TO_PROPERTY');
    expect(result.rating).toEqual({ average: 4.3, count: 5 });
  });

  it('H29-U04 calcula el promedio recibido como TENANT con reseñas OWNER_TO_RENTER', async () => {
    const result = await service.getMyProfile(tenantId);
    expect(getReviews).toHaveBeenCalledWith(tenantId, 'OWNER_TO_RENTER');
    expect(result.rating).toEqual({ average: 4.3, count: 5 });
  });

  it('H29-U05 redondea el promedio a un decimal y devuelve el conteo', async () => {
    getReviews.mockResolvedValueOnce({ _avg: { userRating: 3.84 }, _count: { _all: 7 } });
    expect((await service.getMyProfile(tenantId)).rating).toEqual({ average: 3.8, count: 7 });
  });

  it('H29-U06 devuelve promedio null y conteo cero cuando no hay reseñas', async () => {
    getReviews.mockResolvedValueOnce({ _avg: { userRating: null }, _count: { _all: 0 } });
    expect((await service.getMyProfile(tenantId)).rating).toEqual({ average: null, count: 0 });
  });

  it('H29-U07 cambia TENANT verificado a OWNER y entrega la nueva sesión', async () => {
    const result = await service.changeRole(tenantId, Role.OWNER);
    expect(updateUserRole).toHaveBeenCalledWith(tenantId, Role.OWNER);
    expect(issueTokenPair).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ userId: tenantId, previousRole: Role.TENANT, role: Role.OWNER, accessToken: tokenPair.accessToken, refreshToken: tokenPair.refreshToken });
  });

  it('H29-U08 cambia OWNER a TENANT y pausa solo los bienes AVAILABLE', async () => {
    findUserWithProfile.mockResolvedValueOnce({ ...tenantUser, role: Role.OWNER });
    const result = await service.changeRole(tenantId, Role.TENANT);
    expect(pauseProperties).toHaveBeenCalledWith(tenantId, PropertyStatus.AVAILABLE, PropertyStatus.PAUSED);
    expect(updateUserRole).toHaveBeenCalledWith(tenantId, Role.TENANT);
    expect(inSerializableTransaction).toHaveBeenCalledOnce();
    expect(result.role).toBe(Role.TENANT);
  });

  it('H29-U09 no pausa bienes ya PAUSED o DELETED', async () => {
    findUserWithProfile.mockResolvedValueOnce({ ...tenantUser, role: Role.OWNER });
    await service.changeRole(tenantId, Role.TENANT);
    expect(pauseProperties).toHaveBeenCalledWith(tenantId, PropertyStatus.AVAILABLE, PropertyStatus.PAUSED);
  });

  it.each([BookingStatus.PENDING, BookingStatus.PAID])('H29-U10/U11 bloquea cambio por reserva %s del arrendatario', async (status) => {
    hasBookingWithStatuses.mockResolvedValueOnce(true);
    await expect(service.changeRole(tenantId, Role.OWNER)).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'ROLE_CHANGE_BLOCKED' }) });
    expect(hasBookingWithStatuses).toHaveBeenCalledWith(tenantId, [BookingStatus.PENDING, BookingStatus.PAID]);
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it.each([BookingStatus.PENDING, BookingStatus.PAID])('H29-U12/U13 bloquea cambio por reserva %s sobre bien propio', async (status) => {
    findUserWithProfile.mockResolvedValueOnce({ ...tenantUser, role: Role.OWNER });
    hasBookingWithStatuses.mockResolvedValueOnce(true);
    await expect(service.changeRole(tenantId, Role.TENANT)).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'ROLE_CHANGE_BLOCKED' }) });
    expect(hasBookingWithStatuses).toHaveBeenCalledWith(tenantId, [BookingStatus.PENDING, BookingStatus.PAID]);
    expect(pauseProperties).not.toHaveBeenCalled();
  });

  it('H29-U14 bloquea cambio si un depósito está pendiente', async () => {
    hasDepositWithState.mockResolvedValueOnce(true);
    await expect(service.changeRole(tenantId, Role.OWNER)).rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'ROLE_CHANGE_BLOCKED' }) });
    expect(hasDepositWithState).toHaveBeenCalledWith(tenantId, DepositStatus.PENDING);
  });

  it('H29-U15 rechaza solicitar el rol actual', async () => {
    await expect(service.changeRole(tenantId, Role.TENANT)).rejects.toBeInstanceOf(ConflictException);
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('H29-U16 rechaza cambio de rol para ADMIN', async () => {
    findUserWithProfile.mockResolvedValueOnce({ ...tenantUser, role: Role.ADMIN });
    await expect(service.changeRole(tenantId, Role.TENANT)).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('H29-U17 rechaza solicitudes sin sesión con 401', async () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: () => false } as never, {} as never, {} as never);
    const context = { getHandler: () => vi.fn(), getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as never;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('H29-U18 valida que el rol solicitado sea TENANT u OWNER', async () => {
    const invalid = plainToInstance(ChangeRoleDto, { role: Role.ADMIN });
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('H29-U19 requiere verificación para pasar de TENANT a OWNER', async () => {
    findUserWithProfile.mockResolvedValueOnce({ ...tenantUser, profile: { isVerified: false } });
    await expect(service.changeRole(tenantId, Role.OWNER)).rejects.toMatchObject({ status: 403, response: expect.objectContaining({ code: 'ACCOUNT_NOT_VERIFIED' }) });
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('H29-U20 OWNER puede publicar/gestionar y no puede reservar ni pagar', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.create)).toContain(Role.OWNER);
    expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.updateStatus)).toContain(Role.OWNER);
    expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.create)).not.toContain(Role.OWNER);
    expect(Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.pay)).not.toContain(Role.OWNER);
  });

  it('H29-U21 TENANT puede reservar y pagar, pero no publicar ni gestionar bienes', () => {
    expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.create)).toContain(Role.TENANT);
    expect(Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.pay)).toContain(Role.TENANT);
    expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.create)).not.toContain(Role.TENANT);
    expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.updateStatus)).not.toContain(Role.TENANT);
  });
});
