import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Role, type User } from '@PrismaClient';
import { OwnerRatingsQueryDto, OwnerRatingsReportResponseDto } from '../dto/index.js';
import { ReviewsService } from '../services/reviews.service.js';

@ApiTags('owner-reports')
@ApiBearerAuth()
@Controller('owner/reports')
export class OwnerRatingsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('ratings')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Consulta las calificaciones de los bienes del arrendador autenticado' })
  @ApiOkResponse({ type: OwnerRatingsReportResponseDto })
  @ApiBadRequestResponse({ description: 'Orden o paginación inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo OWNER puede consultar este reporte.' })
  getRatings(@CurrentUser() user: User, @Query() query: OwnerRatingsQueryDto) {
    return this.reviewsService.getOwnerPropertyRatings(user.id, query);
  }
}
