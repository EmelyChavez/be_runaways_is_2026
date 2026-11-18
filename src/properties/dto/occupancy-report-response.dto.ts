import { ApiProperty } from '@nestjs/swagger';
import { PropertyStatus } from '@PrismaClient';

export class PropertyOccupancyDto {
  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: PropertyStatus })
  status!: PropertyStatus;

  @ApiProperty({ minimum: 0 })
  occupiedDays!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 42.9 })
  occupancyRate!: number;
}

export class OccupancyReportResponseDto {
  @ApiProperty({ format: 'date', example: '2026-10-20' })
  from!: string;

  @ApiProperty({ format: 'date', example: '2026-11-18' })
  to!: string;

  @ApiProperty({ minimum: 1, maximum: 365 })
  periodDays!: number;

  @ApiProperty({ type: [PropertyOccupancyDto] })
  data!: PropertyOccupancyDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  constructor(data: OccupancyReportResponseDto) {
    Object.assign(this, data);
  }
}
