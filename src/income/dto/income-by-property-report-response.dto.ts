export interface PropertyIncomeDto {
  propertyId: string;
  title: string;
  category: string;
  rentalIncome: string;
  retainedDepositIncome: string;
  totalIncome: string;
}

export class IncomeByPropertyReportResponseDto {
  from!: string | null;
  to!: string | null;
  data!: PropertyIncomeDto[];
  rentalIncome!: string;
  retainedDepositIncome!: string;
  totalIncome!: string;
  total!: number;
  page!: number;
  pageSize!: number;

  constructor(data: IncomeByPropertyReportResponseDto) {
    Object.assign(this, data);
  }
}
