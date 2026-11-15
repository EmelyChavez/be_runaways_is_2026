import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, IdentityDocumentStatus, IdentityDocumentType } from '../../src/generated/prisma/client.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { ProfileController } from '../../src/profile/controllers/profile.controller.js';
import { IdentityDocumentService } from '../../src/identity-document/services/identity-document.service.js';

describe('H19: enviar documento de identidad para verificación', () => {
  const findProfileForUser = vi.fn();
  const withTransaction = vi.fn();
  const create = vi.fn();
  const updateIfEligible = vi.fn();
  const upload = vi.fn();
  const deleteFile = vi.fn();
  const deleteByUrl = vi.fn();
  let service: IdentityDocumentService;

  const pdfBuffer = Buffer.from('%PDF-1.7 documento de prueba');
  const file = { buffer: pdfBuffer, mimetype: 'application/pdf', size: pdfBuffer.length };
  const tenant = { id: 'tenant-1', role: Role.TENANT } as never;
  const dto = { documentType: IdentityDocumentType.DUI, documentNumber: '01234567-8' };
  const profile = { id: 'profile-1', isVerified: false, identityDocument: null };

  beforeEach(() => {
    vi.clearAllMocks();
    findProfileForUser.mockResolvedValue(profile);
    withTransaction.mockImplementation((operation) => operation({ findProfileForUser, create, updateIfEligible }));
    create.mockResolvedValue({ documentType: dto.documentType, documentStatus: IdentityDocumentStatus.PENDING, submittedAt: new Date('2026-11-14T12:00:00.000Z') });
    upload.mockResolvedValue({ secureUrl: 'https://cloudinary.test/private.pdf', publicId: 'private.pdf' });
    deleteFile.mockResolvedValue(undefined);
    deleteByUrl.mockResolvedValue(undefined);
    service = new IdentityDocumentService(
      { findProfileForUser, withTransaction } as never,
      { upload, delete: deleteFile, deleteByUrl } as never,
    );
  });

  it('autoriza únicamente TENANT para enviar documentos', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ProfileController.prototype.submitIdentityDocument)).toEqual([Role.TENANT]);
  });

  it('acepta el DUI de un TENANT y persiste el documento como PENDING', async () => {
    const result = await service.submit(tenant, dto, file);

    expect(upload).toHaveBeenCalledWith(pdfBuffer, 'application/pdf');
    expect(create).toHaveBeenCalledWith('profile-1', expect.objectContaining({
      documentNumber: dto.documentNumber,
      documentStatus: IdentityDocumentStatus.PENDING,
      documentUrl: 'https://cloudinary.test/private.pdf',
    }));
    expect(result).toEqual({ documentType: IdentityDocumentType.DUI, documentStatus: IdentityDocumentStatus.PENDING, documentSubmittedAt: '2026-11-14T12:00:00.000Z' });
  });

  it('acepta un pasaporte alfanumérico de 6 a 15 caracteres', async () => {
    const passportDto = { documentType: IdentityDocumentType.PASSPORT, documentNumber: 'A12345' };
    await service.submit(tenant, passportDto, file);
    expect(create).toHaveBeenCalledOnce();
  });

  it.each([
    [{ documentType: IdentityDocumentType.DUI, documentNumber: '1234567-8' }, file],
    [{ documentType: IdentityDocumentType.PASSPORT, documentNumber: 'ABC-123' }, file],
    [dto, undefined],
    [dto, { ...file, size: 5 * 1024 * 1024 + 1 }],
    [dto, { ...file, mimetype: 'text/plain' }],
  ])('rechaza entradas o archivos inválidos sin subir el archivo', async (invalidDto, invalidFile) => {
    await expect(service.submit(tenant, invalidDto as never, invalidFile as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rechaza el envío de OWNER y ADMIN', async () => {
    for (const role of [Role.OWNER, Role.ADMIN]) {
      await expect(service.submit({ id: 'other-user', role } as never, dto, file)).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(findProfileForUser).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('bloquea otro envío mientras hay documento PENDING', async () => {
    findProfileForUser.mockResolvedValueOnce({ ...profile, identityDocument: { documentStatus: IdentityDocumentStatus.PENDING } });
    await expect(service.submit(tenant, dto, file)).rejects.toBeInstanceOf(ConflictException);
    expect(upload).not.toHaveBeenCalled();
  });

  it('bloquea el envío si el perfil ya está verificado', async () => {
    findProfileForUser.mockResolvedValueOnce({ ...profile, isVerified: true });
    await expect(service.submit(tenant, dto, file)).rejects.toBeInstanceOf(ConflictException);
    expect(upload).not.toHaveBeenCalled();
  });

  it('permite reemplazar un documento rechazado y reinicia estado y motivo', async () => {
    const rejectedProfile = {
      ...profile,
      identityDocument: { documentStatus: IdentityDocumentStatus.REJECTED, documentUrl: 'https://cloudinary.test/old.pdf', rejectionReason: 'Ilegible' },
    };
    findProfileForUser.mockResolvedValue(rejectedProfile);
    updateIfEligible.mockResolvedValue({ count: 1 });
    withTransaction.mockImplementation((operation) => operation({ findProfileForUser: vi.fn().mockResolvedValue(rejectedProfile), updateIfEligible, create }));

    const result = await service.submit(tenant, dto, file);

    expect(updateIfEligible).toHaveBeenCalledWith('profile-1', expect.objectContaining({ documentStatus: IdentityDocumentStatus.PENDING, rejectionReason: null }));
    expect(deleteByUrl).toHaveBeenCalledWith('https://cloudinary.test/old.pdf');
    expect(result.documentStatus).toBe(IdentityDocumentStatus.PENDING);
  });
});
