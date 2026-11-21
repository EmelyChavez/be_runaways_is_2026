import { jest } from '@jest/globals';
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  NotificationEventType,
  NotificationStatus,
  OriginModule,
} from '../../src/generated/prisma/client.js';
import { NotificationsRepository } from '../../src/notifications/repositories/notifications.repository.js';
import { IdentityDocumentService } from '../../src/identity-document/services/identity-document.service.js';
import {
  NotificationsService,
  type EmitInput,
} from '../../src/notifications/services/notifications.service.js';

describe("H22. Servicio de emisión de notificaciones", () => {
  const recipientId = '11111111-1111-4111-8111-111111111111';
  const referenceId = '22222222-2222-4222-8222-222222222222';
  const createdAt = new Date('2026-11-15T12:00:00.000Z');
  const repository = {
    recipientExists: jest.fn<(...args: any[]) => any>(),
    create: jest.fn<(...args: any[]) => any>(),
  };
  let service: NotificationsService;

  const validInput = (overrides: Partial<EmitInput> = {}): EmitInput => ({
    recipientId,
    eventType: NotificationEventType.DOCUMENT_APPROVED,
    originModule: OriginModule.VERIFICATION,
    title: 'Título solicitado',
    message: 'Mensaje solicitado',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    repository.recipientExists.mockResolvedValue({ id: recipientId });
    repository.create.mockImplementation(async (data) => ({
      id: '33333333-3333-4333-8333-333333333333',
      ...data,
      createdAt,
      updatedAt: createdAt,
    }));
    service = new NotificationsService(repository as never);
  });

  it("AC2: crea una notificación UNREAD y devuelve el registro con la fecha de creación", async () => {
    const result = await service.emit(validInput({ referenceId }));

    expect(repository.recipientExists).toHaveBeenCalledWith(recipientId);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientId,
      eventType: NotificationEventType.DOCUMENT_APPROVED,
      originModule: OriginModule.VERIFICATION,
      referenceId,
      status: NotificationStatus.UNREAD,
      title: 'Documento aprobado',
    }));
    expect(result.status).toBe(NotificationStatus.UNREAD);
    expect(result.createdAt).toEqual(createdAt);
  });

  it("AC3: acepta los límites de 100 caracteres para título y 250 para mensaje", async () => {
    await expect(service.emit(validInput({
      title: 't'.repeat(100),
      message: 'm'.repeat(250),
    }))).resolves.toMatchObject({ status: NotificationStatus.UNREAD });
  });

  it("AC1: genera los textos unificados para todos los eventos definidos", async () => {
    const templateCases: Array<{
      eventType: NotificationEventType;
      templateData?: Record<string, string>;
      expectedTitle: string;
      expectedMessagePart: string;
    }> = [
      { eventType: NotificationEventType.RESERVATION_CREATED, templateData: { propertyName: 'Cámara' }, expectedTitle: 'Nueva solicitud de reserva', expectedMessagePart: 'Cámara' },
      { eventType: NotificationEventType.PAYMENT_CONFIRMED, templateData: { propertyName: 'Cámara' }, expectedTitle: 'Pago de reserva confirmado', expectedMessagePart: 'Cámara' },
      { eventType: NotificationEventType.RESERVATION_CANCELED_EXPIRED, templateData: { propertyName: 'Cámara' }, expectedTitle: 'Reserva cancelada', expectedMessagePart: 'Cámara' },
      { eventType: NotificationEventType.RESERVATION_FINISHED, templateData: { propertyName: 'Cámara' }, expectedTitle: 'Reserva finalizada', expectedMessagePart: 'Cámara' },
      { eventType: NotificationEventType.MESSAGE_NEW, templateData: { propertyName: 'Cámara' }, expectedTitle: 'Nuevo mensaje recibido', expectedMessagePart: 'Cámara' },
      { eventType: NotificationEventType.DEPOSIT_RETURNED, templateData: { amount: '45.00' }, expectedTitle: 'Depósito de garantía devuelto', expectedMessagePart: '$45.00' },
      { eventType: NotificationEventType.DEPOSIT_RETURNED_AUTO, templateData: { amount: '45.00' }, expectedTitle: 'Depósito de garantía devuelto', expectedMessagePart: '$45.00' },
      { eventType: NotificationEventType.DEPOSIT_RETAINED, templateData: { amount: '45.00' }, expectedTitle: 'Depósito de garantía retenido', expectedMessagePart: '$45.00' },
      { eventType: NotificationEventType.DOCUMENT_APPROVED, expectedTitle: 'Documento aprobado', expectedMessagePart: 'verificado' },
      { eventType: NotificationEventType.DOCUMENT_REJECTED, templateData: { reason: 'El documento no se ve claro' }, expectedTitle: 'Documento rechazado', expectedMessagePart: 'El documento no se ve claro' },
    ];

    for (const testCase of templateCases) {
      const result = await service.emit(validInput(testCase));
      expect(result.title).toBe(testCase.expectedTitle);
      expect(result.message).toContain(testCase.expectedMessagePart);
      expect(result.message).not.toBe('Mensaje solicitado');
    }
  });

  it("AC1: acepta todos los valores definidos para OriginModule", async () => {
    for (const originModule of Object.values(OriginModule)) {
      await expect(service.emit(validInput({ originModule }))).resolves.toMatchObject({
        originModule,
        status: NotificationStatus.UNREAD,
      });
    }
  });

  it("AC1: guarda null cuando no se proporciona la referencia opcional", async () => {
    await service.emit(validInput());

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ referenceId: null }));
  });

  it("AC1: el repository delega la creación a Prisma y devuelve el registro creado", async () => {
    const record = { id: 'notification-id', status: NotificationStatus.UNREAD, createdAt };
    const prismaCreate = jest.fn<(...args: any[]) => any>().mockResolvedValue(record);
    const prisma = { notification: { create: prismaCreate } };
    const prismaRepository = new NotificationsRepository(prisma as never);
    const data = { recipientId, status: NotificationStatus.UNREAD } as never;

    await expect(prismaRepository.create(data)).resolves.toEqual(record);
    expect(prismaCreate).toHaveBeenCalledWith({ data });
  });

  it("AC4: solicita la notificación DOCUMENT_APPROVED después de aprobar un documento", async () => {
    const documentRepository = {
      findDocumentForUser: jest.fn<(...args: any[]) => any>().mockResolvedValue({
        id: referenceId,
        documentStatus: 'PENDING',
      }),
      withReviewTransaction: jest.fn<(...args: any[]) => any>().mockImplementation(async (operation) => operation({
        reviewPending: jest.fn<(...args: any[]) => any>().mockResolvedValue({ count: 1 }),
        setProfileVerified: jest.fn<(...args: any[]) => any>(),
      })),
    };
    const emit = jest.fn<(...args: any[]) => any>().mockResolvedValue({});
    const documentService = new IdentityDocumentService(
      documentRepository as never,
      {} as never,
      { emit } as never,
    );

    await documentService.approveForAdmin(recipientId);

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      recipientId,
      eventType: NotificationEventType.DOCUMENT_APPROVED,
      originModule: OriginModule.VERIFICATION,
      referenceId,
    }));
  });

  it("AC4: solicita la notificación DOCUMENT_REJECTED con el motivo", async () => {
    const documentRepository = {
      findDocumentForUser: jest.fn<(...args: any[]) => any>().mockResolvedValue({
        id: referenceId,
        documentStatus: 'PENDING',
      }),
      withReviewTransaction: jest.fn<(...args: any[]) => any>().mockImplementation(async (operation) => operation({
        reviewPending: jest.fn<(...args: any[]) => any>().mockResolvedValue({ count: 1 }),
        setProfileVerified: jest.fn<(...args: any[]) => any>(),
      })),
    };
    const emit = jest.fn<(...args: any[]) => any>().mockResolvedValue({});
    const documentService = new IdentityDocumentService(
      documentRepository as never,
      {} as never,
      { emit } as never,
    );
    const reason = 'Documento no legible';

    await documentService.rejectForAdmin(recipientId, reason);

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      recipientId,
      eventType: NotificationEventType.DOCUMENT_REJECTED,
      originModule: OriginModule.VERIFICATION,
      referenceId,
      templateData: { reason },
    }));
  });

  it("AC1: rechaza la ausencia del destinatario con 400 sin persistir", async () => {
    const input = validInput();
    delete (input as Partial<EmitInput>).recipientId;

    await expect(service.emit(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC1: rechaza un destinatario con UUID inválido con 400", async () => {
    await expect(service.emit(validInput({ recipientId: 'not-a-uuid' })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC1: responde 404 cuando el destinatario no existe", async () => {
    repository.recipientExists.mockResolvedValue(null);

    await expect(service.emit(validInput())).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC1: rechaza un evento fuera de NotificationEventType con 400", async () => {
    await expect(service.emit(validInput({ eventType: 'UNKNOWN' as NotificationEventType })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC3: rechaza un título ausente o vacío con 400", async () => {
    const missingTitle = validInput();
    delete (missingTitle as Partial<EmitInput>).title;

    for (const input of [missingTitle, validInput({ title: '   ' })]) {
      await expect(service.emit(input)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC3: rechaza un título de más de 100 caracteres con 400", async () => {
    await expect(service.emit(validInput({ title: 't'.repeat(101) })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC3: rechaza un mensaje ausente o vacío con 400", async () => {
    const missingMessage = validInput();
    delete (missingMessage as Partial<EmitInput>).message;

    for (const input of [missingMessage, validInput({ message: '   ' })]) {
      await expect(service.emit(input)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC3: rechaza un mensaje de más de 250 caracteres con 400", async () => {
    await expect(service.emit(validInput({ message: 'm'.repeat(251) })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC1: rechaza un módulo de origen ausente o inválido con 400", async () => {
    const missingOrigin = validInput();
    delete (missingOrigin as Partial<EmitInput>).originModule;

    for (const input of [missingOrigin, validInput({ originModule: 'UNKNOWN' as OriginModule })]) {
      await expect(service.emit(input)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("AC1: rechaza una referencia opcional con UUID inválido con 400", async () => {
    await expect(service.emit(validInput({ referenceId: 'not-a-uuid' })))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
