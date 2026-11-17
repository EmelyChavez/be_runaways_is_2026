import { Module } from '@nestjs/common';
import { NotificationsModule } from '@Notifications';
import { PrismaModule } from '@Prisma';
import { BookingTransactionsController, DepositDecisionsController, PaymentsController } from '@Payments/controllers';
import { DepositsRepository, PaymentsRepository } from '@Payments/repositories';
import { DepositDecisionsService, PaymentsService } from '@Payments/services';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PaymentsController, BookingTransactionsController, DepositDecisionsController],
  providers: [PaymentsRepository, PaymentsService, DepositsRepository, DepositDecisionsService],
})
export class PaymentsModule {}
