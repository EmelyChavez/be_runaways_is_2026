export class IncomeReportResponseDto {
  from: string | null;
  to: string | null;
  rentalIncome: string;
  retainedDepositIncome: string;
  totalIncome: string;

  constructor(data: IncomeReportResponseDto) {
    Object.assign(this, data);
  }
}
