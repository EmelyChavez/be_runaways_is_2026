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
import { IncomeQueryDto, IncomeReportResponseDto } from '@Income/dto';
import { IncomeService } from '@Income/services';

@ApiTags('income')
@ApiBearerAuth()
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get('reports')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Consulta los ingresos del arrendador autenticado' })
  @ApiOkResponse({ type: IncomeReportResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas ISO inválidas o rango invertido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo OWNER puede consultar este reporte.' })
  getReport(@Query() query: IncomeQueryDto, @CurrentUser() user: User) {
    return this.incomeService.getReport(user.id, query);
  }
}
