import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
import {
  BookingQueryDto,
  CreateBookingDto,
  OwnerBookingQueryDto,
} from '@Bookings/dto';
import { BookingsService } from '@Bookings/services';
import { CreateDepositDecisionDto, DepositDecisionResponseDto } from '@Payments/dto';
import { DepositDecisionsService } from '@Payments/services';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly depositDecisionsService: DepositDecisionsService,
  ) {}

  @Post()
  @Roles(Role.TENANT)
  @ApiCreatedResponse({ description: 'Reserva PENDING creada con un plazo de pago de 24 horas.' })
  @ApiBadRequestResponse({ description: 'Fechas inválidas, fuera del horizonte o periodo superior a 30 días.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo TENANT verificado puede crear reservas.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no está disponible.' })
  async create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Get('mine')
  @Roles(Role.TENANT)
  @ApiOkResponse({ description: 'Reservas del arrendatario autenticado, paginadas.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un TENANT puede consultar sus reservas.' })
  listMine(@CurrentUser() user: User, @Query() query: BookingQueryDto) {
    return this.bookingsService.listMine(user.id, query);
  }

  @Post(':id/deposit/decision')
  @Roles(Role.OWNER)
  @ApiOkResponse({ type: DepositDecisionResponseDto, description: 'Decisión de devolución o retención aplicada al depósito.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos, monto no permitido o motivo fuera de longitud.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo el OWNER puede decidir el depósito.' })
  @ApiNotFoundResponse({ description: 'El depósito no existe o no pertenece al arrendador.' })
  @ApiConflictResponse({ description: 'La reserva no está finalizada o el depósito ya fue decidido.' })
  decideDeposit(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CreateDepositDecisionDto,
  ): Promise<DepositDecisionResponseDto> {
    return this.depositDecisionsService.decide(user.id, bookingId, dto);
  }
}

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('owner/bookings')
export class OwnerBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @Roles(Role.OWNER)
  @ApiOkResponse({ description: 'Reservas de los bienes del arrendador autenticado, con el nombre del arrendatario.' })
  @ApiBadRequestResponse({ description: 'Filtros de consulta inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede consultar reservas de sus bienes.' })
  listForOwner(@CurrentUser() user: User, @Query() query: OwnerBookingQueryDto) {
    return this.bookingsService.listForOwner(user.id, query);
  }
}

