import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
  CreatePaymentDto,
  PaymentReceiptDto,
  PaymentSummaryDto,
  TransactionHistoryResponseDto,
} from '@Payments/dto';
import { PaymentsService } from '@Payments/services';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':bookingId/summary')
  @Roles(Role.TENANT)
  @ApiOkResponse({ type: PaymentSummaryDto, description: 'Detalle de cobros de una reserva pendiente.' })
  @ApiBadRequestResponse({ description: 'El identificador debe ser UUID.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo TENANT puede consultar la pantalla de pago.' })
  @ApiNotFoundResponse({ description: 'La reserva no existe o no pertenece al arrendatario.' })
  @ApiConflictResponse({ description: 'La reserva ya fue pagada, está cancelada o venció.' })
  getSummary(
    @CurrentUser() user: User,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ): Promise<PaymentSummaryDto> {
    return this.paymentsService.getSummary(user.id, bookingId);
  }

  @Post()
  @Roles(Role.TENANT)
  @ApiCreatedResponse({ type: PaymentReceiptDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o fondos insuficientes.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo TENANT puede pagar; el bien podría requerir cuenta verificada.' })
  @ApiNotFoundResponse({ description: 'La reserva no existe o no pertenece al arrendatario.' })
  @ApiConflictResponse({ description: 'La reserva está cancelada, venció o ya fue pagada.' })
  pay(@CurrentUser() user: User, @Body() dto: CreatePaymentDto): Promise<PaymentReceiptDto> {
    return this.paymentsService.pay(user.id, dto);
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('bookings')
export class BookingTransactionsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':bookingId/transactions')
  @Roles(Role.TENANT, Role.OWNER)
  @ApiOkResponse({ type: TransactionHistoryResponseDto, description: 'Movimientos de la reserva para sus participantes.' })
  @ApiBadRequestResponse({ description: 'El identificador debe ser UUID.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo los participantes autenticados pueden consultar movimientos.' })
  @ApiNotFoundResponse({ description: 'La reserva no existe o no pertenece al usuario.' })
  getTransactions(
    @CurrentUser() user: User,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.paymentsService.getTransactionHistory(user.id, bookingId);
  }
}
