import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { AvailabilityBlockResponseDto, CreateAvailabilityBlockDto } from '@Properties/dto';
import { PropertiesService } from '@Properties/services';
import { Role, type User } from '@PrismaClient';

@ApiTags('availability-blocks')
@ApiBearerAuth()
@Controller()
export class AvailabilityBlocksController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post('properties/:id/blocks')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Bloquea un periodo de un bien propio' })
  @ApiCreatedResponse({ type: AvailabilityBlockResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas inválidas o fuera del horizonte permitido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede bloquear fechas.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no pertenece al arrendador.' })
  @ApiConflictResponse({ description: 'Las fechas se traslapan con otro bloqueo o una reserva activa.' })
  async create(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateAvailabilityBlockDto,
  ): Promise<AvailabilityBlockResponseDto> {
    return this.propertiesService.createAvailabilityBlock(user.id, propertyId, dto);
  }

  @Get('properties/:id/blocks')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Lista los bloqueos vigentes de un bien propio' })
  @ApiOkResponse({ type: AvailabilityBlockResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede consultar bloqueos.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no pertenece al arrendador.' })
  async list(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) propertyId: string,
  ): Promise<AvailabilityBlockResponseDto[]> {
    return this.propertiesService.listAvailabilityBlocks(user.id, propertyId);
  }

  @Delete('blocks/:id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un bloqueo de un bien propio' })
  @ApiNoContentResponse({ description: 'Bloqueo eliminado.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede eliminar bloqueos.' })
  @ApiNotFoundResponse({ description: 'El bloqueo no existe o no pertenece a un bien del arrendador.' })
  async delete(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) blockId: string): Promise<void> {
    await this.propertiesService.deleteAvailabilityBlock(user.id, blockId);
  }
}
