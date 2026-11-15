import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
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
}
