import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRenterReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt({ message: 'userRating debe ser un número entero.' })
  @Min(1, { message: 'userRating debe estar entre 1 y 5.' })
  @Max(5, { message: 'userRating debe estar entre 1 y 5.' })
  userRating!: number;

  @ApiPropertyOptional({ maxLength: 200, example: 'Fue puntual y cuidó bien el equipo.' })
  @IsOptional()
  @IsString({ message: 'comment debe ser texto.' })
  @MaxLength(200, { message: 'comment no puede superar 200 caracteres.' })
  comment?: string;
}
