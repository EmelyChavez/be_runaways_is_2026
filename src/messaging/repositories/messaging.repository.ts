import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';

@Injectable()
export class MessagingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProperty(propertyId: string) {
    return this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true },
    });
  }

  startOrGetConversation(propertyId: string, tenantId: string) {
    return this.prisma.conversation.upsert({
      where: { propertyId_tenantId: { propertyId, tenantId } },
      create: { propertyId, tenantId },
      update: {},
      select: { id: true, propertyId: true, tenantId: true, createdAt: true },
    });
  }

  listForUser(userId: string) {
    return this.prisma.conversation.findMany({
      where: { OR: [{ tenantId: userId }, { property: { ownerId: userId } }] },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        propertyId: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
        property: {
          select: {
            title: true,
            owner: { select: { id: true, name: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { createdAt: true },
        },
        _count: {
          select: {
            messages: {
              where: { senderId: { not: userId }, isRead: false },
            },
          },
        },
        createdAt: true,
      },
    });
  }

  findConversationParticipants(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        tenantId: true,
        property: {
          select: {
            title: true,
            ownerId: true,
          },
        },
      },
    });
  }

  markIncomingMessagesRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }

  listMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, senderId: true, content: true, isRead: true, createdAt: true },
    });
  }

  createMessage(conversationId: string, senderId: string, content: string) {
    return this.prisma.$transaction(async (transaction) => {
      const message = await transaction.message.create({
        data: { conversationId, senderId, content },
        select: { id: true, senderId: true, content: true, isRead: true, createdAt: true },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: message.createdAt },
      });
      return message;
    });
  }
}
