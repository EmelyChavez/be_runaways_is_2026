import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class OccupancyReportQueryDto {
  @ApiPropertyOptional({ example: '2026-10-20', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'from debe ser una fecha ISO válida.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from debe usar el formato YYYY-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-18', format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'to debe ser una fecha ISO válida.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to debe usar el formato YYYY-MM-DD.' })
  to?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order debe ser asc o desc.' })
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
