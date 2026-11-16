import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@Auth/decorators';
import type { User } from '@PrismaClient';
import { NotificationQueryDto } from '../dto/index.js';
import { NotificationsService } from '../services/index.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Consulta la bandeja de notificaciones del usuario actual' })
  @ApiOkResponse({ description: 'Notificaciones paginadas, de la más reciente a la más antigua.' })
  @ApiBadRequestResponse({ description: 'Página o límite inválido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  list(@CurrentUser() user: User, @Query() query: NotificationQueryDto) {
    return this.notificationsService.list(user.id, query.page, query.limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Consulta el contador de notificaciones no leídas' })
  @ApiOkResponse({ schema: { example: { unreadCount: 3 } } })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  unreadCount(@CurrentUser() user: User) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marca todas las notificaciones pendientes del usuario como leídas' })
  @ApiOkResponse({ schema: { example: { updatedCount: 3 } } })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  markAllRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca una notificación propia como leída' })
  @ApiOkResponse({ description: 'Notificación actualizada a READ.' })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'La notificación pertenece a otro usuario.' })
  @ApiNotFoundResponse({ description: 'La notificación no existe.' })
  markRead(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }
}
