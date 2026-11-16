import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@PrismaClient';
import { IncomeQueryDto, IncomeReportResponseDto } from '@Income/dto';
import { IncomeRepository } from '@Income/repositories';

@Injectable()
export class IncomeService {
  constructor(private readonly incomeRepository: IncomeRepository) {}

  async getReport(ownerId: string, query: IncomeQueryDto): Promise<IncomeReportResponseDto> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    // Treat date-only `to` values as inclusive through the end of that day.
    if (to && query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
      to.setUTCHours(23, 59, 59, 999);
    }

    if (from && to && to < from) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La fecha final no puede ser anterior a la fecha inicial.',
      });
    }

    const [rentals, deposits] = await Promise.all([
      this.incomeRepository.rentalIncome(ownerId, from, to),
      this.incomeRepository.retainedDepositIncome(ownerId, from, to),
    ]);
    const rental = rentals._sum.rentalAmount ?? 0;
    const retained = deposits._sum.retainedAmount ?? 0;
    const total = new Prisma.Decimal(rental).plus(retained);

    return new IncomeReportResponseDto({
      from: query.from ?? null,
      to: query.to ?? null,
      rentalIncome: rental.toFixed(2),
      retainedDepositIncome: retained.toFixed(2),
      totalIncome: total.toFixed(2),
    });
  }
}
