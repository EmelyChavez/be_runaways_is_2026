import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@Auth/decorators';
import { Role } from '@PrismaClient';
import type { User } from '@PrismaClient';
import { ChangeRoleDto, RoleChangeResponseDto } from '@Profile/dto';
import { ProfileRoleService } from '@Profile/services';
import { MyIdentityDocumentResponseDto, SubmitIdentityDocumentDto, SubmitIdentityDocumentResponseDto } from '@IdentityDocument/dto';
import { IdentityDocumentService } from '@IdentityDocument/services';
import type { IdentityDocumentFile } from '@IdentityDocument/services';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileRoleService: ProfileRoleService,
    private readonly identityDocumentService: IdentityDocumentService,
  ) {}

  @Post('document')
  @Roles(Role.TENANT)
  @UseInterceptors(FileInterceptor('documentUrl', {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
        callback(new BadRequestException('El archivo debe ser JPG, PNG o PDF.'), false);
        return;
      }
      callback(null, true);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documentType', 'documentNumber', 'documentUrl'],
      properties: {
        documentType: { type: 'string', enum: ['DUI', 'PASSPORT'] },
        documentNumber: { type: 'string', example: '01234567-8' },
        documentUrl: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Envía un documento de identidad para verificación' })
  @ApiCreatedResponse({ type: SubmitIdentityDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Tipo, número o archivo inválido; máximo 5 MB.' })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  @ApiForbiddenResponse({ description: 'El rol ADMIN no puede enviar documentos.' })
  @ApiConflictResponse({ description: 'Ya existe un documento PENDING o la cuenta está verificada.' })
  submitIdentityDocument(
    @CurrentUser() user: User,
    @Body() dto: SubmitIdentityDocumentDto,
    @UploadedFile() file: IdentityDocumentFile,
  ) {
    return this.identityDocumentService.submit(user, dto, file);
  }

  @Get('document')
  @Roles(Role.TENANT, Role.OWNER)
  @ApiOperation({ summary: 'Consulta el estado del documento de identidad propio' })
  @ApiOkResponse({ type: MyIdentityDocumentResponseDto })
  @ApiNotFoundResponse({ description: 'No se encontró el perfil.' })
  getMyIdentityDocument(@CurrentUser() user: User) {
    return this.identityDocumentService.getMyStatus(user.id);
  }

  @Patch('role')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TENANT, Role.OWNER)
  @ApiOperation({ summary: 'Cambia el rol entre TENANT y OWNER' })
  @ApiOkResponse({ type: RoleChangeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sesión ausente o inválida.' })
  @ApiForbiddenResponse({ description: 'ADMIN no puede cambiar su rol; también puede requerirse verificación.' })
  @ApiConflictResponse({ description: 'El rol no cambió o existen reservas o depósitos que bloquean el cambio.' })
  changeRole(
    @CurrentUser() user: User,
    @Body() dto: ChangeRoleDto,
  ): Promise<RoleChangeResponseDto> {
    return this.profileRoleService.changeRole(user.id, dto.role);
  }
}
