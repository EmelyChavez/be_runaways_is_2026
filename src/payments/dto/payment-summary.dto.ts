import { ApiProperty } from '@nestjs/swagger';

export class PaymentSummaryDto {
  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty()
  propertyTitle!: string;

  @ApiProperty({ example: '2026-11-20', format: 'date' })
  startDate!: string;

  @ApiProperty({ example: '2026-11-22', format: 'date' })
  endDate!: string;

  @ApiProperty({ example: 3 })
  days!: number;

  @ApiProperty({ example: '50.00' })
  pricePerDay!: string;

  @ApiProperty({ example: '150.00' })
  rentalAmount!: string;

  @ApiProperty({ example: '100.00' })
  depositAmount!: string;

  @ApiProperty({ example: '250.00' })
  totalAmount!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}
