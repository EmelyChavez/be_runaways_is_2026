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
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function currentElSalvadorDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

@ValidatorConstraint({ name: 'isoCalendarDate', async: false })
class IsoCalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === undefined || isCalendarDate(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} debe ser una fecha válida con formato YYYY-MM-DD.`;
  }
}

@ValidatorConstraint({ name: 'dateRange', async: false })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { startDate, endDate } = args.object as PropertyCatalogQueryDto;
    if (startDate === undefined && endDate === undefined) return true;
    if (startDate === undefined || endDate === undefined) return false;
    if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return true;
    if (startDate < currentElSalvadorDate() || endDate < startDate) return false;

    const start = Date.parse(`${startDate}T00:00:00.000Z`);
    const end = Date.parse(`${endDate}T00:00:00.000Z`);
    const inclusiveDays = (end - start) / MILLISECONDS_PER_DAY + 1;
    if (inclusiveDays > 30) return false;

    const horizon = new Date(
      Date.parse(`${currentElSalvadorDate()}T00:00:00.000Z`) + 90 * MILLISECONDS_PER_DAY,
    ).toISOString().slice(0, 10);
    return endDate <= horizon;
  }

  defaultMessage(args: ValidationArguments): string {
    const { startDate, endDate } = args.object as PropertyCatalogQueryDto;
    if (startDate === undefined || endDate === undefined) {
      return 'startDate y endDate deben enviarse juntos.';
    }
    if (isCalendarDate(startDate) && startDate < currentElSalvadorDate()) {
      return 'No se permiten fechas anteriores a hoy.';
    }
    if (isCalendarDate(startDate) && isCalendarDate(endDate) && endDate < startDate) {
      return 'endDate no puede ser anterior a startDate.';
    }
    if (
      isCalendarDate(startDate) &&
      isCalendarDate(endDate) &&
      (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) /
        MILLISECONDS_PER_DAY +
        1 >
        30
    ) {
      return 'El rango de fechas no puede superar 30 días, contando el inicio y el fin.';
    }
    return 'Las fechas no pueden ser posteriores a los próximos 90 días.';
  }
}

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

  @ApiPropertyOptional({
    description: 'Fecha de inicio del periodo en horario de El Salvador. Debe enviarse junto con la fecha de fin.',
    example: '2026-11-20',
    format: 'date',
  })
  @Validate(IsoCalendarDateConstraint)
  @Validate(DateRangeConstraint)
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del periodo en horario de El Salvador. Debe enviarse junto con la fecha de inicio.',
    example: '2026-11-25',
    format: 'date',
  })
  @Validate(IsoCalendarDateConstraint)
  @Validate(DateRangeConstraint)
  endDate?: string;
}
