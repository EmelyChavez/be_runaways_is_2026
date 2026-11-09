import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  PropertyCatalogQueryDto,
} from '@Properties/dto';
import { PropertiesService, type PropertyImageFile } from '@Properties/services';
import { Role, type User } from '@PrismaClient';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

@ApiTags('properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
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
