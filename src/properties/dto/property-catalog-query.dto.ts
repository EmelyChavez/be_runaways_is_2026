import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyCategory } from '@PrismaClient';

const POSITIVE_PRICE = /^(?=.*[1-9])\d{1,4}(?:\.\d{1,2})?$/;
const DECIMAL_PRICE = /^(\d{1,4})(?:\.(\d{1,2}))?$/;

function toCents(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = DECIMAL_PRICE.exec(value);
  if (!match) return undefined;

  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

@ValidatorConstraint({ name: 'priceRange', async: false })
class PriceRangeConstraint implements ValidatorConstraintInterface {
  validate(maxPrice: unknown, args: ValidationArguments): boolean {
    const minPrice = (args.object as PropertyCatalogQueryDto).minPrice;
    const minCents = toCents(minPrice);
    const maxCents = toCents(maxPrice);

    return minCents === undefined || maxCents === undefined || minCents <= maxCents;
  }

  defaultMessage(): string {
    return 'El precio mínimo no puede ser mayor que el precio máximo.';
  }
}

export class PropertyCatalogQueryDto {
  @ApiPropertyOptional({ description: 'Página del catálogo', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1.' })
  page = 1;

  @ApiPropertyOptional({ description: 'Texto a buscar en título, descripción y ubicación', minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'q debe ser texto.' })
  @MinLength(2, { message: 'q debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'q no puede superar 100 caracteres.' })
  q?: string;

  @ApiPropertyOptional({ description: 'Departamento del bien' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'department debe ser texto.' })
  department?: string;

  @ApiPropertyOptional({ description: 'Municipio del bien' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'municipality debe ser texto.' })
  municipality?: string;

  @ApiPropertyOptional({ enum: PropertyCategory, description: 'Categoría del bien' })
  @IsOptional()
  @IsEnum(PropertyCategory, { message: 'category debe ser PROPERTY o EQUIPMENT.' })
  category?: PropertyCategory;

  @ApiPropertyOptional({ description: 'Si es true, devuelve bienes con depósito de garantía igual a cero' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'noDeposit debe ser true o false.' })
  noDeposit?: boolean;

  @ApiPropertyOptional({
    type: Number,
    description: 'Precio mínimo por día en USD. Debe estar entre 0.01 y 9999.99.',
    example: '25.00',
    minimum: 0.01,
    maximum: 9999.99,
  })
  @IsOptional()
  @Matches(POSITIVE_PRICE, {
    message: 'minPrice debe ser un decimal positivo entre 0.01 y 9999.99 con hasta dos decimales.',
  })
  minPrice?: string;

  @ApiPropertyOptional({
    type: Number,
    description: 'Precio máximo por día en USD. Debe estar entre 0.01 y 9999.99.',
    example: '100.00',
    minimum: 0.01,
    maximum: 9999.99,
  })
  @IsOptional()
  @Matches(POSITIVE_PRICE, {
    message: 'maxPrice debe ser un decimal positivo entre 0.01 y 9999.99 con hasta dos decimales.',
  })
  @Validate(PriceRangeConstraint)
  maxPrice?: string;
}
