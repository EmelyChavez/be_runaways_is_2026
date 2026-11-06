import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from '@Users/services';
import { UserResponseDto } from '@Users/dto';
import { RegisterDto } from '@Auth/dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Creación secundaria de usuarios protegida por el guard global.
   */
  @Post()
  @ApiOperation({ summary: 'Crea un usuario desde una sesión autenticada' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'El nombre de usuario ya está en uso.' })
  async create(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(dto);
    return UserResponseDto.fromEntity(user);
  }
}
