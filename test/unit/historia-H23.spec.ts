import { jest } from '@jest/globals';
import 'reflect-metadata';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role, NotificationStatus, OriginModule } from '../../src/generated/prisma/client.js';
import { NotificationQueryDto } from '../../src/notifications/dto/notification-query.dto.js';
import { NotificationsRepository } from '../../src/notifications/repositories/notifications.repository.js';
import { NotificationsService } from '../../src/notifications/services/notifications.service.js';

describe("H23. Consultar e interactuar con la bandeja de notificaciones", () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const notificationId = '33333333-3333-4333-8333-333333333333';
  const createdAt = new Date('2026-11-15T12:00:00.000Z');
  const olderAt = new Date('2026-11-14T12:00:00.000Z');
  const notification = (overrides: Record<string, unknown> = {}) => ({
    id: notificationId,
    recipientId: userId,
    title: 'Reserva recibida',
    message: 'Tienes una nueva solicitud.',
    createdAt,
    originModule: OriginModule.RESERVATIONS,
    status: NotificationStatus.UNREAD,
    ...overrides,
  });

  const repository = {
    listForRecipient: jest.fn<(...args: any[]) => any>(),
    countForRecipient: jest.fn<(...args: any[]) => any>(),
    countUnread: jest.fn<(...args: any[]) => any>(),
    findById: jest.fn<(...args: any[]) => any>(),
    markRead: jest.fn<(...args: any[]) => any>(),
    markAllRead: jest.fn<(...args: any[]) => any>(),
  };
  let service: NotificationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository.listForRecipient.mockResolvedValue([notification(), notification({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Mensaje recibido',
      createdAt: olderAt,
      status: NotificationStatus.READ,
      originModule: OriginModule.MESSAGING,
    })]);
    repository.countForRecipient.mockResolvedValue(12);
    repository.countUnread.mockResolvedValue(2);
    repository.findById.mockResolvedValue(notification());
    repository.markRead.mockResolvedValue({ count: 1 });
    repository.markAllRead.mockResolvedValue({ count: 2 });
    service = new NotificationsService(repository as never);
  });

  it("AC1: devuelve las notificaciones propias en orden cronológico descendente", async () => {
    const result = await service.list(userId, 1, 10);

    expect(repository.listForRecipient).toHaveBeenCalledWith(userId, 0, 10);
    expect(result.data[0].createdAt.getTime()).toBeGreaterThan(result.data[1].createdAt.getTime());
  });

  it("AC2: incluye título, mensaje, fecha, módulo de origen, estado y datos de paginación", async () => {
    const result = await service.list(userId, 1, 10);

    expect(result).toMatchObject({ total: 12, page: 1, limit: 10, totalPages: 2 });
    expect(result.data[0]).toMatchObject({
      title: 'Reserva recibida',
      message: 'Tienes una nueva solicitud.',
      createdAt,
      originModule: OriginModule.RESERVATIONS,
      status: NotificationStatus.UNREAD,
    });
  });

  it("AC3: usa una página de 10 registros por defecto", async () => {
    const query = new NotificationQueryDto();
    const result = await service.list(userId, query.page, query.limit);

    expect(query).toMatchObject({ page: 1, limit: 10 });
    expect(repository.listForRecipient).toHaveBeenCalledWith(userId, 0, 10);
    expect(result.limit).toBe(10);
  });

  it("AC3: consulta la página siguiente sin repetir registros de la anterior", async () => {
    await service.list(userId, 2, 10);

    expect(repository.listForRecipient).toHaveBeenCalledWith(userId, 10, 10);
  });

  it("AC7: devuelve el contador de notificaciones UNREAD del usuario", async () => {
    await expect(service.unreadCount(userId)).resolves.toEqual({ unreadCount: 2 });
    expect(repository.countUnread).toHaveBeenCalledWith(userId);
  });

  it("AC4: marca una notificación propia como READ y reduce el contador en uno", async () => {
    repository.findById
      .mockResolvedValueOnce(notification())
      .mockResolvedValueOnce(notification({ status: NotificationStatus.READ }));
    repository.countUnread.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const before = await service.unreadCount(userId);
    const updated = await service.markRead(userId, notificationId);
    const after = await service.unreadCount(userId);

    expect(updated?.status).toBe(NotificationStatus.READ);
    expect(after.unreadCount).toBe(before.unreadCount - 1);
    expect(repository.markRead).toHaveBeenCalledWith(notificationId, userId);
  });

  it("AC5: marca en lote las notificaciones pendientes propias", async () => {
    await expect(service.markAllRead(userId)).resolves.toEqual({ updatedCount: 2 });
    expect(repository.markAllRead).toHaveBeenCalledWith(userId);
  });

  it("AC6: devuelve una lista vacía y total cero cuando no hay notificaciones", async () => {
    repository.listForRecipient.mockResolvedValue([]);
    repository.countForRecipient.mockResolvedValue(0);

    await expect(service.list(userId, 1, 10)).resolves.toMatchObject({
      data: [], total: 0, page: 1, limit: 10, totalPages: 0,
    });
  });

  it("AC1: permite la bandeja a TENANT y OWNER autenticados", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.TENANT, Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    for (const role of [Role.TENANT, Role.OWNER]) {
      const context = {
        getHandler: jest.fn<(...args: any[]) => any>(),
        getClass: jest.fn<(...args: any[]) => any>(),
        switchToHttp: () => ({ getRequest: () => ({ user: { id: userId, role } }) }),
      };
      expect(guard.canActivate(context as never)).toBe(true);
    }
  });

  it("AC8: rechaza al rol ADMIN con respuesta 403", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.TENANT, Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: userId, role: Role.ADMIN } }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it("AC3: rechaza una página cero o negativa", async () => {
    for (const page of [0, -1]) {
      const dto = plainToInstance(NotificationQueryDto, { page });
      expect(await validate(dto)).not.toHaveLength(0);
    }
  });

  it("AC7: rechaza límites no enteros, menores que 1 o mayores que 100", async () => {
    for (const limit of [0, 101, 1.5, 'abc']) {
      const dto = plainToInstance(NotificationQueryDto, { limit });
      expect(await validate(dto)).not.toHaveLength(0);
    }
  });

  it("AC7: impide marcar una notificación ajena y responde 403", async () => {
    repository.findById.mockResolvedValue(notification({ recipientId: otherUserId }));

    await expect(service.markRead(userId, notificationId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.markRead).not.toHaveBeenCalled();
  });

  it("AC8: responde 404 al marcar una notificación inexistente", async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.markRead(userId, notificationId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.markRead).not.toHaveBeenCalled();
  });

  it("AC7: responde 401 si se intenta consultar sin sesión", async () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue(false) };
    const guard = new JwtAuthGuard(
      reflector as never,
      { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
      { findById: jest.fn<(...args: any[]) => any>() } as never,
    );
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("AC7: filtra por usuario y ordena en Prisma al consultar el repositorio", async () => {
    const findMany = jest.fn<(...args: any[]) => any>().mockResolvedValue([notification()]);
    const prisma = { notification: { findMany } };
    const prismaRepository = new NotificationsRepository(prisma as never);

    await prismaRepository.listForRecipient(userId, 0, 10);

    expect(findMany).toHaveBeenCalledWith({
      where: { recipientId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
  });
});
