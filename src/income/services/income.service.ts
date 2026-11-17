import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@PrismaClient';
import {
  IncomeByPropertyQueryDto,
  IncomeByPropertyReportResponseDto,
  IncomeQueryDto,
  IncomeReportResponseDto,
} from '@Income/dto';
import { IncomeRepository } from '@Income/repositories';

@Injectable()
export class IncomeService {
  constructor(private readonly incomeRepository: IncomeRepository) {}

  async getReport(ownerId: string, query: IncomeQueryDto): Promise<IncomeReportResponseDto> {
    const { from, to } = this.parseDateRange(query.from, query.to);

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

  async getReportByProperty(
    ownerId: string,
    query: IncomeByPropertyQueryDto,
  ): Promise<IncomeByPropertyReportResponseDto> {
    const { from, to } = this.parseDateRange(query.from, query.to);
    const { properties, payments, deposits } = await this.incomeRepository.incomeByProperty(
      ownerId,
      from,
      to,
    );
    const propertyTotals = new Map(properties.map((property) => [property.id, {
      propertyId: property.id,
      title: property.title,
      category: property.category,
      rental: new Prisma.Decimal(0),
      retained: new Prisma.Decimal(0),
    }]));

    for (const payment of payments) {
      const totals = propertyTotals.get(payment.booking.propertyId);
      if (totals) totals.rental = totals.rental.plus(payment.rentalAmount);
    }
    for (const deposit of deposits) {
      const totals = propertyTotals.get(deposit.booking.propertyId);
      if (totals) totals.retained = totals.retained.plus(deposit.retainedAmount);
    }

    const allProperties = [...propertyTotals.values()].map((property) => ({
      propertyId: property.propertyId,
      title: property.title,
      category: property.category,
      rental: property.rental,
      retained: property.retained,
      total: property.rental.plus(property.retained),
    }));
    const orderDirection = query.order === 'desc' ? -1 : 1;
    allProperties.sort((left, right) => {
      const incomeOrder = left.total.comparedTo(right.total);
      return incomeOrder === 0
        ? left.title.localeCompare(right.title) || left.propertyId.localeCompare(right.propertyId)
        : incomeOrder * orderDirection;
    });

    const rentalTotal = allProperties.reduce(
      (total, property) => total.plus(property.rental),
      new Prisma.Decimal(0),
    );
    const retainedTotal = allProperties.reduce(
      (total, property) => total.plus(property.retained),
      new Prisma.Decimal(0),
    );
    const startIndex = (query.page - 1) * query.pageSize;
    const data = allProperties.slice(startIndex, startIndex + query.pageSize).map((property) => ({
      propertyId: property.propertyId,
      title: property.title,
      category: property.category,
      rentalIncome: property.rental.toFixed(2),
      retainedDepositIncome: property.retained.toFixed(2),
      totalIncome: property.total.toFixed(2),
    }));

    return new IncomeByPropertyReportResponseDto({
      from: query.from ?? null,
      to: query.to ?? null,
      data,
      rentalIncome: rentalTotal.toFixed(2),
      retainedDepositIncome: retainedTotal.toFixed(2),
      totalIncome: rentalTotal.plus(retainedTotal).toFixed(2),
      total: allProperties.length,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  private parseDateRange(fromValue?: string, toValue?: string) {
    const from = fromValue ? new Date(fromValue) : undefined;
    const to = toValue ? new Date(toValue) : undefined;

    if (to && toValue && /^\d{4}-\d{2}-\d{2}$/.test(toValue)) {
      to.setUTCHours(23, 59, 59, 999);
    }

    if (from && to && to < from) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La fecha final no puede ser anterior a la fecha inicial.',
      });
    }

    return { from, to };
  }
}
