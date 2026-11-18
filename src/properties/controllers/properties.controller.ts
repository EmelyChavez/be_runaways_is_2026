import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Roles } from '@Auth/decorators';
import {
  CreatePropertyRequestDto,
  CreatePropertyResponseDto,
  OccupancyReportQueryDto,
  OccupancyReportResponseDto,
  PropertyCatalogQueryDto,
  UpdatePropertyRequestDto,
  UpdatePropertyStatusDto,
} from '@Properties/dto';
import { PropertiesService, type PropertyImageFile } from '@Properties/services';
import { Role, type User } from '@PrismaClient';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

@ApiTags('properties')
@ApiBearerAuth()
@Controller()
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post('properties')
  @Roles(Role.OWNER)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
      fileFilter: (_request, file, callback) => {
        if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
          callback(new BadRequestException('Cada foto debe estar en formato JPG o PNG.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreatePropertyRequestDto })
  @ApiOperation({ summary: 'Publica un bien y almacena sus imágenes en Cloudinary' })
  @ApiCreatedResponse({ type: CreatePropertyResponseDto })
  @ApiBadRequestResponse({ description: 'Datos o imágenes inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede publicar bienes.' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreatePropertyRequestDto,
    @UploadedFiles() files: PropertyImageFile[],
  ): Promise<CreatePropertyResponseDto> {
    const property = await this.propertiesService.create(user.id, dto, files);
    return CreatePropertyResponseDto.fromEntity(property);
  }

  @Get('properties')
  @Roles(Role.TENANT)
  @ApiOperation({ summary: 'Lista el catálogo de bienes disponibles' })
  @ApiOkResponse({ description: 'Catálogo paginado de bienes disponibles, filtrable por texto, ubicación, categoría, depósito y precio.' })
  @ApiBadRequestResponse({ description: 'Parámetros de búsqueda inválidos o precio mínimo mayor que máximo.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  listCatalog(@Query() query: PropertyCatalogQueryDto) {
    return this.propertiesService.listCatalog(query);
  }

  @Get('properties/mine')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Lista las publicaciones del arrendador actual' })
  @ApiOkResponse({ description: 'Publicaciones AVAILABLE o PAUSED, paginadas.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  listMine(@CurrentUser() user: User, @Query() query: PropertyCatalogQueryDto) {
    return this.propertiesService.listMine(user.id, query.page);
  }

  @Get('properties/:id/owner')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Obtiene un bien propio para editarlo' })
  @ApiOkResponse({ type: CreatePropertyResponseDto })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede editar publicaciones.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no pertenece al arrendador.' })
  async getOwnedDetail(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CreatePropertyResponseDto> {
    const property = await this.propertiesService.getOwnedDetail(user.id, id);
    return CreatePropertyResponseDto.fromEntity(property);
  }

  @Put('properties/:id')
  @Roles(Role.OWNER)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
      fileFilter: (_request, file, callback) => {
        if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
          callback(new BadRequestException('Cada foto debe estar en formato JPG o PNG.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdatePropertyRequestDto })
  @ApiOperation({ summary: 'Reemplaza los datos e imágenes de un bien propio' })
  @ApiOkResponse({ type: CreatePropertyResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o cantidad de fotos fuera de 1 a 5.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede editar publicaciones.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no pertenece al arrendador.' })
  @ApiConflictResponse({ description: 'No se puede cambiar el precio o depósito con reservas activas.' })
  async update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePropertyRequestDto,
    @UploadedFiles() files: PropertyImageFile[],
  ): Promise<CreatePropertyResponseDto> {
    const property = await this.propertiesService.updateOwned(user.id, id, dto, files ?? []);
    return CreatePropertyResponseDto.fromEntity(property);
  }

  @Patch('properties/:id/status')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Pausa o reactiva una publicación propia' })
  @ApiOkResponse({ description: 'Estado actualizado.', schema: { example: { id: 'uuid', status: 'PAUSED', statusChangedAt: '2026-11-13T12:00:00.000Z' } } })
  @ApiBadRequestResponse({ description: 'ID UUID o estado inválido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede cambiar el estado.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no pertenece al arrendador.' })
  @ApiConflictResponse({ description: 'El bien fue eliminado o tiene reservas PENDING o PAID.' })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePropertyStatusDto,
  ) {
    return this.propertiesService.updateOwnedStatus(user.id, id, dto);
  }

  @Delete('properties/:id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una publicación propia' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede eliminar publicaciones.' })
  @ApiNotFoundResponse({ description: 'El bien no existe o no pertenece al arrendador.' })
  @ApiConflictResponse({ description: 'El bien ya fue eliminado o tiene reservas PENDING o PAID.' })
  async delete(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.propertiesService.deleteOwned(user.id, id);
  }

  @Get('properties/:id')
  @Roles(Role.TENANT)
  @ApiOperation({ summary: 'Obtiene el detalle de un bien disponible' })
  @ApiOkResponse({ description: 'Detalle del bien y su arrendador.' })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiNotFoundResponse({ description: 'Este bien no existe o no está disponible.' })
  getDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.propertiesService.getDetail(id);
  }

  @Get('properties/:id/availability')
  @Roles(Role.TENANT, Role.OWNER)
  @ApiOperation({ summary: 'Consulta los días ocupados de un bien durante los próximos 90 días' })
  @ApiOkResponse({ description: 'Rango consultado y fechas ocupadas, sin datos de las reservas.' })
  @ApiBadRequestResponse({ description: 'El ID no es un UUID válido.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo un arrendatario o arrendador puede consultar disponibilidad.' })
  @ApiNotFoundResponse({ description: 'Este bien ya no está disponible o no pertenece al arrendador.' })
  getAvailability(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.propertiesService.getAvailability(id, user.id, user.role);
  }

  @Get('owner/reports/occupancy')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Consulta la tasa de ocupación de los bienes del arrendador autenticado' })
  @ApiOkResponse({ type: OccupancyReportResponseDto })
  @ApiBadRequestResponse({ description: 'Fechas, orden o paginación inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'Solo OWNER puede consultar este reporte.' })
  getOccupancy(@CurrentUser() user: User, @Query() query: OccupancyReportQueryDto) {
    return this.propertiesService.getOccupancyReport(user.id, query);
  }
}
