import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@PrismaClient';

export class RegisterResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana@example.com', format: 'email' })
  email!: string;

  @ApiProperty({ enum: ['TENANT', 'ADMIN', 'OWNER'], example: 'TENANT' })
  role!: string;

  @ApiProperty({ example: 'Ana' })
  name!: string;

  static fromEntity(user: User): RegisterResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
