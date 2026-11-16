import { Module } from '@nestjs/common';
import { NotificationsModule } from '@Notifications';
import { PrismaModule } from '@Prisma';
import { BookingsController, OwnerBookingsController } from './controllers/bookings.controller.js';
import { BookingsRepository } from './repositories/bookings.repository.js';
import { BookingsService } from './services/bookings.service.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BookingsController, OwnerBookingsController],
  providers: [BookingsRepository, BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
