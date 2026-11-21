import { Module } from '@nestjs/common';
import { NotificationsModule } from '@Notifications';
import { PrismaModule } from '@Prisma';
import { ConversationsController } from '@Messaging/controllers';
import { MessagingRepository } from '@Messaging/repositories';
import { MessagingService } from '@Messaging/services';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ConversationsController],
  providers: [MessagingRepository, MessagingService],
})
export class MessagingModule {}
