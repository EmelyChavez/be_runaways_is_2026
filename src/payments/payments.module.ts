import { Module } from '@nestjs/common';
import { NotificationsModule } from '@Notifications';
import { PrismaModule } from '@Prisma';
import { BookingTransactionsController, PaymentsController } from '@Payments/controllers';
import { PaymentsRepository } from '@Payments/repositories';
import { PaymentsService } from '@Payments/services';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PaymentsController, BookingTransactionsController],
  providers: [PaymentsRepository, PaymentsService],
})
export class PaymentsModule {}
