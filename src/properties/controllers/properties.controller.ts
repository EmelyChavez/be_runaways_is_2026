import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { CreatePropertyDto } from '@Properties/dto';
import { PropertiesService } from '@Properties/services';
import type { PropertyImageFile } from '@Properties/services';
import { Role, type Property, type User } from '@PrismaClient';

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
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'description', 'category', 'department', 'municipality', 'address', 'pricePerDay', 'securityDeposit', 'images'],
      properties: {
        title: { type: 'string', maxLength: 100 },
        description: { type: 'string', minLength: 30 },
        category: { type: 'string', enum: ['PROPERTY', 'EQUIPMENT'] },
        department: { type: 'string' },
        municipality: { type: 'string' },
        address: { type: 'string' },
        pricePerDay: { type: 'string', example: '45.00' },
        securityDeposit: { type: 'string', example: '100.00' },
        images: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Publica un bien y almacena sus imágenes en Cloudinary' })
  @ApiCreatedResponse({ description: 'Bien publicado con estado AVAILABLE.' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o expirado.' })
  @ApiForbiddenResponse({ description: 'Solo un OWNER puede publicar bienes.' })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreatePropertyDto,
    @UploadedFiles() files: PropertyImageFile[],
  ): Promise<Property> {
    return this.propertiesService.create(user.id, dto, files);
  }
}
