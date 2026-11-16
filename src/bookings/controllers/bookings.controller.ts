import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { BookingQueryDto, CreateBookingDto, OwnerBookingQueryDto } from '@Bookings/dto';
import { BookingsService } from '@Bookings/services';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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

