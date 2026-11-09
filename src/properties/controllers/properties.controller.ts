import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
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
}
