import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PropertyCategory } from '@PrismaClient';

const POSITIVE_MONEY = /^(?=.*[1-9])\d{1,8}(?:\.\d{1,2})?$/;
const NON_NEGATIVE_MONEY = /^\d{1,8}(?:\.\d{1,2})?$/;

export class CreatePropertyRequestDto {
  @ApiProperty({ example: 'Cámara profesional', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @ApiProperty({ example: 'Cámara en excelente estado, incluye lente y estuche.', minLength: 30 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(30, { message: 'La descripción debe tener al menos 30 caracteres.' })
  description!: string;

  @ApiProperty({ enum: PropertyCategory })
  @IsEnum(PropertyCategory)
  category!: PropertyCategory;

  @ApiProperty({ example: 'San Salvador' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  department!: string;

  @ApiProperty({ example: 'San Salvador' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  municipality!: string;

  @ApiProperty({ example: 'Colonia Escalón, calle...' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  address!: string;

  @ApiProperty({ example: '45.00', description: 'Monto USD con hasta dos decimales.' })
  @IsString()
  @Matches(POSITIVE_MONEY, { message: 'El precio por día debe ser mayor que cero y tener hasta dos decimales.' })
  pricePerDay!: string;

  @ApiProperty({ example: '100.00', description: 'Monto USD con hasta dos decimales.' })
  @IsString()
  @Matches(NON_NEGATIVE_MONEY, { message: 'El depósito debe ser un monto no negativo con hasta dos decimales.' })
  securityDeposit!: string;

  @ApiProperty({
    type: 'array',
    minItems: 1,
    maxItems: 5,
    items: { type: 'string', format: 'binary' },
    description: 'Entre una y cinco imágenes JPG o PNG de hasta 5 MB cada una.',
  })
  @IsOptional()
  @IsArray()
  images?: string[];
}
