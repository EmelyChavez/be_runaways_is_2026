import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Roles } from '@Auth/decorators';
import { Role } from '@PrismaClient';
import { PropertyCatalogQueryDto } from '@Properties/dto';
import { PropertiesService } from '@Properties/services';

@ApiTags('properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @Roles(Role.TENANT)
  @ApiOperation({ summary: 'Lista el catálogo de bienes disponibles' })
  @ApiOkResponse({ description: 'Catálogo paginado de bienes disponibles.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  listCatalog(@Query() query: PropertyCatalogQueryDto) {
    return this.propertiesService.listCatalog(query.page);
  }

  @Get(':id')
  @Roles(Role.TENANT)
  @ApiOperation({ summary: 'Obtiene el detalle de un bien disponible' })
  @ApiOkResponse({ description: 'Detalle del bien y su arrendador.' })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiNotFoundResponse({ description: 'Este bien no existe o no está disponible.' })
  getDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.propertiesService.getDetail(id);
  }
}
