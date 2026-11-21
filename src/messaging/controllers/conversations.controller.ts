import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';
import { Role } from '@PrismaClient';
import {
  ConversationResponseDto,
  ConversationSummaryDto,
  MessageResponseDto,
  SendMessageDto,
  StartConversationDto,
} from '@Messaging/dto';
import { MessagingService } from '@Messaging/services';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  @Roles(Role.TENANT)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ConversationResponseDto, description: 'Devuelve el hilo existente o inicia uno para el bien.' })
  @ApiBadRequestResponse({ description: 'El identificador del bien no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo TENANT puede iniciar una conversación.' })
  @ApiNotFoundResponse({ description: 'El bien no existe.' })
  @ApiConflictResponse({ description: 'No se permite iniciar una conversación con uno mismo.' })
  start(
    @CurrentUser() user: User,
    @Body() dto: StartConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.messagingService.startConversation(user.id, dto.propertyId);
  }

  @Get()
  @Roles(Role.TENANT, Role.OWNER)
  @ApiOkResponse({ type: ConversationSummaryDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  list(@CurrentUser() user: User): Promise<ConversationSummaryDto[]> {
    return this.messagingService.listConversations(user.id);
  }

  @Get(':id/messages')
  @Roles(Role.TENANT, Role.OWNER)
  @ApiOkResponse({ type: MessageResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'El identificador del hilo no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no participa en el hilo.' })
  @ApiNotFoundResponse({ description: 'El hilo no existe.' })
  listMessages(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) conversationId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagingService.listMessages(user.id, conversationId);
  }

  @Post(':id/messages')
  @Roles(Role.TENANT, Role.OWNER)
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'El contenido debe tener entre 1 y 500 caracteres.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'El usuario no participa en el hilo.' })
  @ApiNotFoundResponse({ description: 'El hilo no existe.' })
  @ApiConflictResponse({ description: 'No se permite enviarse mensajes a uno mismo.' })
  sendMessage(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagingService.sendMessage(user.id, conversationId, dto.content);
  }
}
