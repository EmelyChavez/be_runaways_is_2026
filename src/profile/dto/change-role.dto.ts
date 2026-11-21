import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '@PrismaClient';

const CHANGEABLE_ROLES = [Role.TENANT, Role.OWNER] as const;

export class ChangeRoleDto {
  @ApiProperty({ enum: CHANGEABLE_ROLES, example: Role.OWNER })
  @IsIn(CHANGEABLE_ROLES, {
    message: 'El rol debe ser TENANT o OWNER.',
  })
  role!: (typeof CHANGEABLE_ROLES)[number];
}
