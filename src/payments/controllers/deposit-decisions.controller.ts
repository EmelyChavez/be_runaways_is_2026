import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import type { User } from '@PrismaClient';
import { Role } from '@PrismaClient';
import { CreateDepositDecisionDto, DepositDecisionResponseDto } from '@Payments/dto';
import { DepositDecisionsService } from '@Payments/services';

@ApiTags('deposits')
@ApiBearerAuth()
@Controller('bookings')
export class DepositDecisionsController {
  constructor(private readonly depositDecisionsService: DepositDecisionsService) {}

  @Post(':id/deposit/decision')
  @Roles(Role.OWNER)
  @ApiOkResponse({ type: DepositDecisionResponseDto, description: 'Decisión de devolución o retención aplicada al depósito.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos, monto no permitido o motivo fuera de longitud.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo el OWNER puede decidir el depósito.' })
  @ApiNotFoundResponse({ description: 'El depósito no existe o no pertenece al arrendador.' })
  @ApiConflictResponse({ description: 'La reserva no está finalizada o el depósito ya fue decidido.' })
  decide(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CreateDepositDecisionDto,
  ): Promise<DepositDecisionResponseDto> {
    return this.depositDecisionsService.decide(user.id, bookingId, dto);
  }
}
