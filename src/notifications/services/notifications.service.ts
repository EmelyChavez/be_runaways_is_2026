import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationEventType,
  OriginModule,
  NotificationStatus,
} from '../../generated/prisma/client.js';
import { NotificationsRepository } from '../repositories/notifications.repository.js';
import { notificationTemplates } from './notification-templates.js';

export interface EmitInput {
  recipientId: string;
  eventType: NotificationEventType;
  originModule: OriginModule;
  referenceId?: string | null;
  templateData?: Record<string, string>;
  title?: string;
  message?: string;
}

const TITLE_MAX = 100;
const MESSAGE_MAX = 250;

/**
 * Facade: los módulos llaman únicamente a `emit`. Plantillas, validaciones
 * y persistencia quedan ocultas detrás de este método.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  async emit(input: EmitInput) {
    if (!input.recipientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.recipientId)) {
      throw new BadRequestException('destinatario_id es obligatorio');
    }
    if (!Object.values(OriginModule).includes(input.originModule)) {
      throw new BadRequestException('modulo_origen no existe');
    }
    if (!Object.values(NotificationEventType).includes(input.eventType)) {
      throw new BadRequestException('evento_tipo no existe');
    }

    if (input.referenceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.referenceId)) {
      throw new BadRequestException('referencia_opcional debe ser un UUID');
    }

    const template = notificationTemplates[input.eventType];
    const { title, message } = template
      ? template(input.templateData ?? {})
      : { title: input.title ?? '', message: input.message ?? '' };

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (cleanTitle.length === 0 || cleanTitle.length > TITLE_MAX) {
      throw new BadRequestException(`título inválido (1 a ${TITLE_MAX} caracteres)`);
    }
    if (cleanMessage.length === 0 || cleanMessage.length > MESSAGE_MAX) {
      throw new BadRequestException(`mensaje inválido (1 a ${MESSAGE_MAX} caracteres)`);
    }

    if (!await this.repo.recipientExists(input.recipientId)) {
      throw new NotFoundException({ code: 'RECIPIENT_NOT_FOUND', message: 'El destinatario no existe.' });
    }

    return this.repo.create({
      recipientId: input.recipientId,
      eventType: input.eventType,
      originModule: input.originModule,
      title: cleanTitle,
      message: cleanMessage,
      referenceId: input.referenceId ?? null,
      status: NotificationStatus.UNREAD,
    });
  }
}
