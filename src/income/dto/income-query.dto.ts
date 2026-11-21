import { IsDateString, IsOptional } from 'class-validator';

export class IncomeQueryDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'from debe ser una fecha ISO válida.' })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'to debe ser una fecha ISO válida.' })
  to?: string;
}
