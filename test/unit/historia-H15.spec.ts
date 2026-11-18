import 'reflect-metadata';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role } from '../../src/generated/prisma/client.js';
import { ConversationsController } from '../../src/messaging/controllers/conversations.controller.js';
import { SendMessageDto } from '../../src/messaging/dto/send-message.dto.js';
import { MessagingRepository } from '../../src/messaging/repositories/messaging.repository.js';
import { MessagingService } from '../../src/messaging/services/messaging.service.js';

describe('H15: preguntar dudas sobre el alquiler', () => {
  const tenantId = 'e75428ba-0c10-4d31-b97b-f4a1b563983e';
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const outsiderId = 'c65c3dca-017d-47a4-b445-9d8e6a51b4f7';
  const propertyId = '19be8fb4-81e2-4c84-9ad9-65524817b5ea';
  const conversationId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const createdAt = new Date('2026-11-16T12:34:56.789Z');

  const makeConversationAccess = (overrides: Record<string, unknown> = {}) => ({
    id: conversationId,
    tenantId,
    property: { title: 'Casa de campo', ownerId },
    ...overrides,
  });

  const makeMessage = (overrides: Record<string, unknown> = {}) => ({
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    senderId: tenantId,
    content: '¿El bien está disponible?',
    isRead: false,
    createdAt,
    ...overrides,
  });

  const makeContext = (handler: Function, role?: Role) => ({
    getHandler: () => handler,
    getClass: () => ConversationsController,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: role === Role.TENANT ? tenantId : ownerId, role } : undefined }) }),
  }) as never;

  const getHandler = (name: string): Function =>
    Object.getOwnPropertyDescriptor(ConversationsController.prototype, name)?.value as Function;

  const makeService = (repository: Record<string, unknown>, emit = vi.fn().mockResolvedValue({ id: 'notice-id' })) => ({
    service: new MessagingService(repository as never, { emit } as never),
    emit,
  });

  it('H15-U01 TENANT inicia o recupera el hilo asociado al bien', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: propertyId, ownerId });
    const upsert = vi.fn().mockResolvedValue({
      id: conversationId,
      propertyId,
      tenantId,
      createdAt,
    });
    const repository = new MessagingRepository({
      property: { findUnique },
      conversation: { upsert },
    } as never);
    const { service } = makeService(repository);

    const result = await service.startConversation(tenantId, propertyId);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: propertyId },
      select: { id: true, ownerId: true },
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { propertyId_tenantId: { propertyId, tenantId } },
      create: { propertyId, tenantId },
      update: {},
    }));
    expect(result).toEqual({ id: conversationId, propertyId, tenantId, createdAt: createdAt.toISOString() });
  });

  it('H15-U02 lista solo hilos propios con participante, no leídos y última fecha en orden reciente', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: conversationId,
      propertyId,
      tenantId,
      tenant: { id: tenantId, name: 'Arrendatario' },
      property: { title: 'Casa de campo', owner: { id: ownerId, name: 'Arrendador' } },
      messages: [{ createdAt }],
      _count: { messages: 2 },
      createdAt,
    }]);
    const repository = new MessagingRepository({
      conversation: { findMany },
    } as never);
    const { service } = makeService(repository);

    const result = await service.listConversations(tenantId);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ tenantId }, { property: { ownerId: tenantId } }] },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }));
    expect(result).toEqual([{
      id: conversationId,
      propertyId,
      propertyTitle: 'Casa de campo',
      participantId: ownerId,
      participantName: 'Arrendador',
      unreadCount: 2,
      lastMessageAt: createdAt.toISOString(),
    }]);
  });

  it('H15-U03 devuelve mensajes cronológicos y marca como leídos los recibidos', async () => {
    const older = new Date('2026-11-16T12:00:00.000Z');
    const newer = new Date('2026-11-16T12:30:00.000Z');
    const findUnique = vi.fn().mockResolvedValue(makeConversationAccess());
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findMany = vi.fn().mockResolvedValue([
      makeMessage({ id: 'message-old', senderId: ownerId, createdAt: older, isRead: true }),
      makeMessage({ id: 'message-new', senderId: tenantId, createdAt: newer }),
    ]);
    const repository = new MessagingRepository({
      conversation: { findUnique },
      message: { updateMany, findMany },
    } as never);
    const { service } = makeService(repository);

    const result = await service.listMessages(tenantId, conversationId);

    expect(updateMany).toHaveBeenCalledWith({
      where: { conversationId, senderId: { not: tenantId }, isRead: false },
      data: { isRead: true },
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
    expect(result.map(({ id }) => id)).toEqual(['message-old', 'message-new']);
    expect(result[0].createdAt).toBe(older.toISOString());
  });

  it('H15-U04 guarda el mensaje del TENANT y notifica al OWNER del bien', async () => {
    const findConversationParticipants = vi.fn().mockResolvedValue(makeConversationAccess());
    const createMessage = vi.fn().mockResolvedValue(makeMessage());
    const emit = vi.fn().mockResolvedValue({ id: 'notice-id' });
    const { service } = makeService({ findConversationParticipants, createMessage }, emit);

    const result = await service.sendMessage(tenantId, conversationId, '¿El bien está disponible?');

    expect(createMessage).toHaveBeenCalledWith(conversationId, tenantId, '¿El bien está disponible?');
    expect(result).toEqual({ ...makeMessage(), createdAt: createdAt.toISOString() });
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: ownerId,
      eventType: 'MESSAGE_NEW',
      originModule: 'MESSAGING',
      referenceId: conversationId,
      templateData: { propertyName: 'Casa de campo' },
    }));
  });

  it('H15-U05 guarda la respuesta del OWNER y notifica al TENANT', async () => {
    const findConversationParticipants = vi.fn().mockResolvedValue(makeConversationAccess());
    const createMessage = vi.fn().mockResolvedValue(makeMessage({ senderId: ownerId, content: 'Sí, está disponible.' }));
    const emit = vi.fn().mockResolvedValue({ id: 'notice-id' });
    const { service } = makeService({ findConversationParticipants, createMessage }, emit);

    const result = await service.sendMessage(ownerId, conversationId, 'Sí, está disponible.');

    expect(createMessage).toHaveBeenCalledWith(conversationId, ownerId, 'Sí, está disponible.');
    expect(result.senderId).toBe(ownerId);
    expect(result.createdAt).toBe(createdAt.toISOString());
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: tenantId,
      eventType: 'MESSAGE_NEW',
      originModule: 'MESSAGING',
    }));
  });

  it('H15-U06 acepta mensajes con longitud mínima y máxima', async () => {
    for (const content of ['x', 'x'.repeat(500)]) {
      const dto = plainToInstance(SendMessageDto, { content });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('H15-U07 rechaza contenido vacío, en blanco o mayor de 500 caracteres', async () => {
    for (const content of ['', '   ', 'x'.repeat(501)]) {
      const dto = plainToInstance(SendMessageDto, { content });
      expect(await validate(dto)).not.toHaveLength(0);
    }
  });

  it('H15-U08 rechaza el autoenvío al iniciar o enviar un mensaje', async () => {
    const findProperty = vi.fn().mockResolvedValue({ id: propertyId, ownerId: tenantId });
    const startOrGetConversation = vi.fn();
    const findConversationParticipants = vi.fn().mockResolvedValue(makeConversationAccess({
      tenantId,
      property: { title: 'Mi bien', ownerId: tenantId },
    }));
    const createMessage = vi.fn();
    const emit = vi.fn();
    const { service } = makeService({ findProperty, startOrGetConversation, findConversationParticipants, createMessage }, emit);

    await expect(service.startConversation(tenantId, propertyId)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.sendMessage(tenantId, conversationId, 'Mensaje propio')).rejects.toBeInstanceOf(ConflictException);

    expect(startOrGetConversation).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('H15-U09 impide a terceros leer o enviar mensajes en un hilo', async () => {
    const findConversationParticipants = vi.fn().mockResolvedValue(makeConversationAccess());
    const markIncomingMessagesRead = vi.fn();
    const listMessages = vi.fn();
    const createMessage = vi.fn();
    const emit = vi.fn();
    const { service } = makeService({
      findConversationParticipants,
      markIncomingMessagesRead,
      listMessages,
      createMessage,
    }, emit);

    await expect(service.listMessages(outsiderId, conversationId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage(outsiderId, conversationId, 'Mensaje ajeno')).rejects.toBeInstanceOf(ForbiddenException);

    expect(markIncomingMessagesRead).not.toHaveBeenCalled();
    expect(listMessages).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('H15-U10 responde 404 para un bien o hilo inexistente', async () => {
    const findProperty = vi.fn().mockResolvedValue(null);
    const findConversationParticipants = vi.fn().mockResolvedValue(null);
    const { service } = makeService({ findProperty, findConversationParticipants });

    await expect(service.startConversation(tenantId, propertyId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listMessages(tenantId, conversationId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('H15-U11 aplica roles por ruta y rechaza ADMIN o una solicitud sin sesión', async () => {
    const startHandler = getHandler('start');
    const listHandler = getHandler('list');
    const readHandler = getHandler('listMessages');
    const sendHandler = getHandler('sendMessage');
    const reflector = {
      getAllAndOverride: (key: string, targets: Function[]) => Reflect.getMetadata(key, targets[0]),
    };
    const rolesGuard = new RolesGuard(reflector as never);

    expect(Reflect.getMetadata(ROLES_KEY, startHandler)).toEqual([Role.TENANT]);
    expect(Reflect.getMetadata(ROLES_KEY, listHandler)).toEqual([Role.TENANT, Role.OWNER]);
    expect(Reflect.getMetadata(ROLES_KEY, readHandler)).toEqual([Role.TENANT, Role.OWNER]);
    expect(Reflect.getMetadata(ROLES_KEY, sendHandler)).toEqual([Role.TENANT, Role.OWNER]);
    expect(rolesGuard.canActivate(makeContext(startHandler, Role.TENANT))).toBe(true);
    expect(rolesGuard.canActivate(makeContext(listHandler, Role.OWNER))).toBe(true);

    for (const [handler, role] of [
      [startHandler, Role.OWNER],
      [startHandler, Role.ADMIN],
      [listHandler, Role.ADMIN],
      [readHandler, Role.ADMIN],
      [sendHandler, Role.ADMIN],
    ] as const) {
      expect(() => rolesGuard.canActivate(makeContext(handler, role))).toThrow(expect.objectContaining({ status: 403 }));
    }
    expect(() => rolesGuard.canActivate(makeContext(listHandler))).toThrow(expect.objectContaining({ status: 401 }));

    const jwtGuard = new JwtAuthGuard(
      { getAllAndOverride: () => false } as never,
      { verifyAsync: vi.fn() } as never,
      { findById: vi.fn() } as never,
    );
    const context = {
      getHandler: () => listHandler,
      getClass: () => ConversationsController,
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as never;
    await expect(jwtGuard.canActivate(context)).rejects.toMatchObject({ status: 401 });

  });
});
