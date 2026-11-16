import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class CreateAvailabilityBlockDto {
  @ApiProperty({ example: '2026-11-20', format: 'date' })
  @IsDateString({ strict: true }, { message: 'startDate debe ser una fecha válida con formato YYYY-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ example: '2026-11-22', format: 'date' })
  @IsDateString({ strict: true }, { message: 'endDate debe ser una fecha válida con formato YYYY-MM-DD.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate!: string;
}
