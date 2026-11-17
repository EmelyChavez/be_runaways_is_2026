import { ApiProperty } from '@nestjs/swagger';
import { DepositStatus } from '@PrismaClient';

export class DepositDecisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ enum: DepositStatus })
  state!: DepositStatus;

  @ApiProperty({ example: '100.00' })
  amount!: string;

  @ApiProperty({ example: '25.00' })
  retainedAmount!: string;

  @ApiProperty({ example: '75.00' })
  returnedAmount!: string;

  @ApiProperty({ format: 'date-time' })
  decidedAt!: string;
}
