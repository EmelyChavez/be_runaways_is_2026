import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationEventType, OriginModule } from '@PrismaClient';
import { NotificationsService } from '@Notifications/services';
import { MessagingRepository } from '@Messaging/repositories';

@Injectable()
export class MessagingService {
  constructor(
    private readonly repository: MessagingRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startConversation(tenantId: string, propertyId: string) {
    const property = await this.repository.findProperty(propertyId);
    if (!property) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe.' });
    }
    if (property.ownerId === tenantId) {
      throw new ConflictException({ code: 'SELF_MESSAGE', message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    const conversation = await this.repository.startOrGetConversation(propertyId, tenantId);
    return { ...conversation, createdAt: conversation.createdAt.toISOString() };
  }

  async listConversations(userId: string) {
    const conversations = await this.repository.listForUser(userId);
    return conversations.map((conversation) => {
      const participant = conversation.tenant.id === userId
        ? conversation.property.owner
        : conversation.tenant;
      return {
        id: conversation.id,
        propertyId: conversation.propertyId,
        propertyTitle: conversation.property.title,
        participantId: participant.id,
        participantName: participant.name,
        unreadCount: conversation._count.messages,
        lastMessageAt: conversation.messages[0]?.createdAt.toISOString() ?? null,
      };
    });
  }

  async listMessages(userId: string, conversationId: string) {
    const conversation = await this.requireParticipant(userId, conversationId);
    await this.repository.markIncomingMessagesRead(conversation.id, userId);
    const messages = await this.repository.listMessages(conversation.id);
    return messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }));
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    const conversation = await this.requireParticipant(userId, conversationId);
    const recipientId = conversation.tenantId === userId
      ? conversation.property.ownerId
      : conversation.tenantId;

    if (recipientId === userId) {
      throw new ConflictException({ code: 'SELF_MESSAGE', message: 'No puedes enviarte mensajes a ti mismo.' });
    }

    const message = await this.repository.createMessage(conversationId, userId, content);
    await this.notificationsService.emit({
      recipientId,
      eventType: NotificationEventType.MESSAGE_NEW,
      originModule: OriginModule.MESSAGING,
      referenceId: conversationId,
      templateData: { propertyName: conversation.property.title },
      title: 'Nuevo mensaje recibido',
      message: `Tienes un nuevo mensaje sobre el bien "${conversation.property.title}".`,
    });

    return { ...message, createdAt: message.createdAt.toISOString() };
  }

  private async requireParticipant(userId: string, conversationId: string) {
    const conversation = await this.repository.findConversationParticipants(conversationId);
    if (!conversation) {
      throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'El hilo no existe.' });
    }

    const isParticipant = conversation.tenantId === userId || conversation.property.ownerId === userId;
    if (!isParticipant) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No tienes permiso para acceder a este hilo.' });
    }
    return conversation;
  }
}
