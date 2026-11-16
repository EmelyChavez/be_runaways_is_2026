import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsRepository } from './repositories/index.js';
import { NotificationsService } from './services/index.js';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsRepository, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
