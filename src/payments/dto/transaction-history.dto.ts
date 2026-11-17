import { ApiProperty } from '@nestjs/swagger';

export class TransactionHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['COBRO'] })
  type!: 'COBRO';

  @ApiProperty({ example: '250.00' })
  amount!: string;

  @ApiProperty({ example: 'Cobro del alquiler y depósito de garantía.' })
  reason!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class TransactionHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ type: TransactionHistoryItemDto, isArray: true })
  data!: TransactionHistoryItemDto[];
}
