import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Matches,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
