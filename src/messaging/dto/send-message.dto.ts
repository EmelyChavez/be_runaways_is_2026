import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 500, example: '¿El precio incluye el equipo de seguridad?' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/\S/, { message: 'content no puede estar vacío.' })
  content!: string;
}
