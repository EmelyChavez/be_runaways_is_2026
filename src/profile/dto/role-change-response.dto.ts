import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@PrismaClient';
import type { TokenPair } from '@Auth/types';
import type { User } from '@PrismaClient';

export class RoleChangeResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: Role })
  previousRole!: Role;

  @ApiProperty({ enum: [Role.TENANT, Role.OWNER] })
  role!: Role;

  @ApiProperty({ type: String, format: 'date-time' })
  changedAt!: Date;

  @ApiProperty({ description: 'Nuevo JWT de acceso con el rol actualizado.' })
  accessToken!: string;

  @ApiProperty({ description: 'Nuevo refresh token de la sesión.' })
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  static from(
    user: User,
    previousRole: Role,
    tokens: TokenPair,
  ): RoleChangeResponseDto {
    return {
      userId: user.id,
      previousRole,
      role: user.role,
      changedAt: user.updatedAt,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }
}
