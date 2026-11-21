import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityBlockResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ example: '2026-11-20', format: 'date' })
  startDate!: string;

  @ApiProperty({ example: '2026-11-22', format: 'date' })
  endDate!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static fromEntity(block: {
    id: string;
    propertyId: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
  }): AvailabilityBlockResponseDto {
    return {
      id: block.id,
      propertyId: block.propertyId,
      startDate: block.startDate.toISOString().slice(0, 10),
      endDate: block.endDate.toISOString().slice(0, 10),
      createdAt: block.createdAt.toISOString(),
    };
  }
}
