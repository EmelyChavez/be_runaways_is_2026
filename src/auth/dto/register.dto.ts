import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsNormalizedEmail } from '@Common/decorators';

export class RegisterDto {
  // Preserve the previous behavior of ignoring client-supplied role values.
  @ApiHideProperty()
  @Allow()
  role?: unknown;

  @ApiProperty({ example: 'Ana', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'ana@example.com', format: 'email', maxLength: 254 })
  @IsNormalizedEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass1', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña no puede superar los 72 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir al menos una minúscula, una mayúscula y un número.',
  })
  password!: string;
}
