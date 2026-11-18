import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { CreatePropertyReviewDto } from '../dto/create-property-review.dto.js';
import { ReviewsService } from '../services/reviews.service.js';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reservations/:id/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('property')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TENANT)
  @ApiOkResponse({ description: 'Reseña publicada; devuelve el bien detallado con sus promedios actualizados.' })
  @ApiBadRequestResponse({ description: 'Puntuaciones o comentario inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un TENANT puede calificar.' })
  @ApiNotFoundResponse({ description: 'La reserva no existe o no pertenece al arrendatario.' })
  @ApiConflictResponse({ description: 'La reserva no está finalizada, ya fue calificada o venció el plazo.' })
  createPropertyReview(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) reservationId: string,
    @Body() dto: CreatePropertyReviewDto,
  ) {
    return this.reviewsService.createPropertyReview(user.id, reservationId, dto);
  }
}
