import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'bookingId debe ser un UUID válido.' })
  bookingId!: string;

  @ApiProperty({ example: '4242', minLength: 4, maxLength: 4 })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'last4Digits debe contener exactamente cuatro dígitos.' })
  last4Digits!: string;
}
