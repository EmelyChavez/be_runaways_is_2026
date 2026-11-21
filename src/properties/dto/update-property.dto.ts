import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CreatePropertyRequestDto } from './create-property.dto.js';

export class UpdatePropertyRequestDto extends CreatePropertyRequestDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'URLs actuales de imágenes que deben quitarse del bien.',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesToRemove?: string[];
}
