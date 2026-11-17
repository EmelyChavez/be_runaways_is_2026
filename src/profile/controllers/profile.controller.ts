import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
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
import { ChangeRoleDto, MyProfileResponseDto, RoleChangeResponseDto } from '@Profile/dto';
import { ProfileRoleService } from '@Profile/services';
import { AdminIdentityDocumentQueryDto, MyIdentityDocumentResponseDto, RejectIdentityDocumentDto, SubmitIdentityDocumentDto, SubmitIdentityDocumentResponseDto } from '@IdentityDocument/dto';
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

  @Get()
  @Roles(Role.TENANT, Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Consulta el perfil propio y su calificación' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'Se requiere una sesión válida.' })
  getMyProfile(@CurrentUser() user: User): Promise<MyProfileResponseDto> {
    return this.profileRoleService.getMyProfile(user.id);
  }

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

  @Get('document/admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lista documentos de identidad para revisión administrativa' })
  @ApiOkResponse({ description: 'Documentos paginados por fecha de envío ascendente.' })
  listIdentityDocumentsForAdmin(@Query() query: AdminIdentityDocumentQueryDto) {
    return this.identityDocumentService.listForAdmin(query);
  }

  @Get('document/admin/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Consulta el documento y archivo privado para revisión' })
  @ApiOkResponse({ description: 'Detalle del documento con enlace temporal al archivo privado.' })
  @ApiNotFoundResponse({ description: 'No existe un documento para el usuario.' })
  getIdentityDocumentForAdmin(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.identityDocumentService.getForAdmin(userId);
  }

  @Patch('document/admin/:userId/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Aprueba un documento de identidad pendiente' })
  @ApiOkResponse({ description: 'Documento aprobado y cuenta verificada.' })
  @ApiNotFoundResponse({ description: 'No existe un documento para el usuario.' })
  @ApiConflictResponse({ description: 'El documento ya fue revisado.' })
  approveIdentityDocument(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.identityDocumentService.approveForAdmin(userId);
  }

  @Patch('document/admin/:userId/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Rechaza un documento pendiente con un motivo' })
  @ApiOkResponse({ description: 'Documento rechazado con el motivo y fecha de revisión.' })
  @ApiBadRequestResponse({ description: 'El motivo debe tener entre 10 y 300 caracteres.' })
  @ApiNotFoundResponse({ description: 'No existe un documento para el usuario.' })
  @ApiConflictResponse({ description: 'El documento ya fue revisado.' })
  rejectIdentityDocument(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: RejectIdentityDocumentDto,
  ) {
    return this.identityDocumentService.rejectForAdmin(userId, dto.rejectionReason);
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
