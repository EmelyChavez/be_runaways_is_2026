import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { IncomeController } from '@Income/controllers';
import { IncomeRepository } from '@Income/repositories';
import { IncomeService } from '@Income/services';

@Module({
  imports: [PrismaModule],
  controllers: [IncomeController],
  providers: [IncomeRepository, IncomeService],
})
export class IncomeModule {}
