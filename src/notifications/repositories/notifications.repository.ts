import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '@Prisma/services';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.NotificationUncheckedCreateInput) {
    return this.prisma.notification.create({ data });
  }

  recipientExists(recipientId: string) {
    return this.prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
  }

  listForRecipient(recipientId: string, skip: number, take: number) {
    return this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
  }

  countForRecipient(recipientId: string) {
    return this.prisma.notification.count({ where: { recipientId } });
  }

  countUnread(recipientId: string) {
    return this.prisma.notification.count({ where: { recipientId, status: NotificationStatus.UNREAD } });
  }

  findById(id: string) {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  markRead(id: string, recipientId: string) {
    return this.prisma.notification.updateMany({
      where: { id, recipientId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ },
    });
  }

  markAllRead(recipientId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ },
    });
  }
}
