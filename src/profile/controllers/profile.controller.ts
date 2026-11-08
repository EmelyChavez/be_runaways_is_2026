import { Body, Controller, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Role } from '@PrismaClient';
import type { User } from '@PrismaClient';
import { ChangeRoleDto, RoleChangeResponseDto } from '@Profile/dto';
import { ProfileRoleService } from '@Profile/services';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileRoleService: ProfileRoleService) {}

  @Patch('role')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TENANT, Role.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambia el rol entre TENANT y OWNER' })
  @ApiOkResponse({ type: RoleChangeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sesión ausente o inválida.' })
  @ApiForbiddenResponse({ description: 'ADMIN no puede cambiar su rol; también puede requerirse verificación.' })
  @ApiConflictResponse({ description: 'El rol no cambió o existen reservas o depósitos que bloquean el cambio.' })
  changeRole(
    @CurrentUser() user: User,
    @Body() dto: ChangeRoleDto,
  ): Promise<RoleChangeResponseDto> {
    return this.profileRoleService.changeRole(user.id, dto.role);
  }
}
