import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role, IdentityDocumentStatus, IdentityDocumentType } from '../../src/generated/prisma/client.js';
import { IdentityDocumentRepository } from '../../src/identity-document/repositories/identity-document.repository.js';
import { AdminIdentityDocumentQueryDto, RejectIdentityDocumentDto } from '../../src/identity-document/dto/identity-document.dto.js';
import { IdentityDocumentService } from '../../src/identity-document/services/identity-document.service.js';
import { ProfileController } from '../../src/profile/controllers/profile.controller.js';

describe('H20: aprobar o rechazar documentos de identidad', () => {
  const findPendingDocuments = vi.fn();
  const countPendingDocuments = vi.fn();
  const findPendingDocumentForUser = vi.fn();
  const findDocumentForUser = vi.fn();
  const withReviewTransaction = vi.fn();
  const reviewPending = vi.fn();
  const setProfileVerified = vi.fn();
  const getPrivateDownloadUrl = vi.fn();
  let service: IdentityDocumentService;

  const submittedAt = new Date('2026-11-10T12:30:00.000Z');
  const reviewedAt = new Date('2026-11-12T10:00:00.000Z');
  const pendingDocument = {
    documentType: IdentityDocumentType.DUI,
    documentNumber: '01234567-8',
    documentUrl: 'https://cloudinary.test/private.pdf',
    documentStatus: IdentityDocumentStatus.PENDING,
    submittedAt,
    rejectionReason: null,
    reviewedAt: null,
    profile: {
      userId: 'user-1',
      user: { name: 'Ana Pérez', email: 'ana@example.com' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findPendingDocuments.mockResolvedValue([pendingDocument]);
    countPendingDocuments.mockResolvedValue(1);
    findPendingDocumentForUser.mockResolvedValue(pendingDocument);
    findDocumentForUser.mockResolvedValue(pendingDocument);
    reviewPending.mockResolvedValue({ count: 1 });
    setProfileVerified.mockResolvedValue({ userId: 'user-1', isVerified: true });
    withReviewTransaction.mockImplementation((operation) => operation({ reviewPending, setProfileVerified }));
    getPrivateDownloadUrl.mockReturnValue('https://cloudinary.test/signed/private.pdf');
    service = new IdentityDocumentService(
      {
        findPendingDocuments,
        countPendingDocuments,
        findPendingDocumentForUser,
        findDocumentForUser,
        withReviewTransaction,
      } as never,
      { getPrivateDownloadUrl } as never,
    );
  });

  describe('casos positivos', () => {
    it('H20-U01 lista documentos PENDING con la página y el límite por defecto', async () => {
      const query = plainToInstance(AdminIdentityDocumentQueryDto, {});

      expect(query.page).toBe(1);
      expect(query.pageSize).toBe(10);
      await service.listForAdmin(query);

      expect(findPendingDocuments).toHaveBeenCalledWith(0, 10);
      expect(countPendingDocuments).toHaveBeenCalledOnce();
    });

    it('H20-U02 aplica la paginación solicitada', async () => {
      const query = plainToInstance(AdminIdentityDocumentQueryDto, { page: '3', pageSize: '10' });

      expect(await validate(query)).toHaveLength(0);
      await service.listForAdmin(query);

      expect(findPendingDocuments).toHaveBeenCalledWith(20, 10);
    });

    it('H20-U03 incluye los datos requeridos del usuario y del documento', async () => {
      const result = await service.listForAdmin(new AdminIdentityDocumentQueryDto());

      expect(result).toEqual({
        data: [{
          userId: 'user-1',
          name: 'Ana Pérez',
          email: 'ana@example.com',
          documentType: IdentityDocumentType.DUI,
          documentNumber: '01234567-8',
          documentSubmittedAt: submittedAt.toISOString(),
        }],
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });

    it('H20-U04 devuelve una lista vacía cuando no hay documentos pendientes', async () => {
      findPendingDocuments.mockResolvedValue([]);
      countPendingDocuments.mockResolvedValue(0);

      await expect(service.listForAdmin(new AdminIdentityDocumentQueryDto())).resolves.toEqual({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it('H20-U05 permite consultar un documento pendiente y genera el enlace temporal al archivo', async () => {
      const result = await service.getForAdmin('user-1');

      expect(findPendingDocumentForUser).toHaveBeenCalledWith('user-1');
      expect(getPrivateDownloadUrl).toHaveBeenCalledWith(pendingDocument.documentUrl);
      expect(result).toMatchObject({
        userId: 'user-1',
        documentType: IdentityDocumentType.DUI,
        documentNumber: '01234567-8',
        documentStatus: IdentityDocumentStatus.PENDING,
        documentUrl: 'https://cloudinary.test/signed/private.pdf',
        documentSubmittedAt: submittedAt.toISOString(),
      });
    });

    it('H20-U06 aprueba el documento, verifica el perfil y registra la revisión', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(reviewedAt);

      try {
        const result = await service.approveForAdmin('user-1');

        expect(reviewPending).toHaveBeenCalledWith(
          'user-1',
          IdentityDocumentStatus.APPROVED,
          null,
          reviewedAt,
        );
        expect(setProfileVerified).toHaveBeenCalledWith('user-1', true);
        expect(result).toEqual({
          userId: 'user-1',
          documentStatus: IdentityDocumentStatus.APPROVED,
          isVerified: true,
          reviewedAt: reviewedAt.toISOString(),
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('H20-U07 rechaza con un motivo de 10 caracteres y guarda la revisión', async () => {
      const result = await service.rejectForAdmin('user-1', 'No legible');

      expect(reviewPending).toHaveBeenCalledWith(
        'user-1',
        IdentityDocumentStatus.REJECTED,
        'No legible',
        expect.any(Date),
      );
      expect(setProfileVerified).toHaveBeenCalledWith('user-1', false);
      expect(result).toMatchObject({
        userId: 'user-1',
        documentStatus: IdentityDocumentStatus.REJECTED,
        rejectionReason: 'No legible',
      });
      expect(result.reviewedAt).toEqual(expect.any(String));
    });

    it('H20-U08 acepta un motivo de rechazo de 300 caracteres', async () => {
      const rejectionReason = 'x'.repeat(300);
      const dto = plainToInstance(RejectIdentityDocumentDto, { rejectionReason });

      expect(await validate(dto)).toHaveLength(0);
      await expect(service.rejectForAdmin('user-1', rejectionReason)).resolves.toMatchObject({ rejectionReason });
    });

    it('H20-U09 restringe las rutas administrativas al rol ADMIN', () => {
      const handlers = [
        ProfileController.prototype.listIdentityDocumentsForAdmin,
        ProfileController.prototype.getIdentityDocumentForAdmin,
        ProfileController.prototype.approveIdentityDocument,
        ProfileController.prototype.rejectIdentityDocument,
      ];

      for (const handler of handlers) {
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
      }

      const guard = new RolesGuard({ getAllAndOverride: () => [Role.ADMIN] } as never);
      const context = {
        getHandler: () => ProfileController.prototype.listIdentityDocumentsForAdmin,
        getClass: () => ProfileController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.ADMIN } }) }),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('casos negativos', () => {
    it('H20-U10 rechaza un motivo ausente o vacío', async () => {
      for (const body of [{}, { rejectionReason: '' }]) {
        const dto = plainToInstance(RejectIdentityDocumentDto, body);
        expect(await validate(dto)).not.toHaveLength(0);
      }
      await expect(service.rejectForAdmin('user-1', '          ')).rejects.toMatchObject({ status: 400 });
      expect(withReviewTransaction).not.toHaveBeenCalled();
    });

    it('H20-U11 rechaza un motivo de 9 caracteres', async () => {
      const rejectionReason = 'x'.repeat(9);
      const dto = plainToInstance(RejectIdentityDocumentDto, { rejectionReason });

      expect(await validate(dto)).not.toHaveLength(0);
      await expect(service.rejectForAdmin('user-1', rejectionReason)).rejects.toMatchObject({ status: 400 });
      expect(withReviewTransaction).not.toHaveBeenCalled();
    });

    it('H20-U12 rechaza un motivo de 301 caracteres', async () => {
      const rejectionReason = 'x'.repeat(301);
      const dto = plainToInstance(RejectIdentityDocumentDto, { rejectionReason });

      expect(await validate(dto)).not.toHaveLength(0);
      await expect(service.rejectForAdmin('user-1', rejectionReason)).rejects.toMatchObject({ status: 400 });
      expect(withReviewTransaction).not.toHaveBeenCalled();
    });

    it('H20-U13 no permite consultar un documento inexistente o no pendiente', async () => {
      findPendingDocumentForUser.mockResolvedValue(null);

      await expect(service.getForAdmin('missing-user')).rejects.toBeInstanceOf(NotFoundException);
      expect(getPrivateDownloadUrl).not.toHaveBeenCalled();
    });

    it.each([
      ['H20-U14', IdentityDocumentStatus.APPROVED],
      ['H20-U15', IdentityDocumentStatus.REJECTED],
    ])(
      '%s no permite volver a revisar el documento',
      async (_testId, documentStatus) => {
        findDocumentForUser.mockResolvedValue({ ...pendingDocument, documentStatus });

        await expect(service.approveForAdmin('user-1')).rejects.toBeInstanceOf(ConflictException);
        await expect(service.rejectForAdmin('user-1', 'Motivo válido')).rejects.toBeInstanceOf(ConflictException);
        expect(withReviewTransaction).not.toHaveBeenCalled();
      },
    );

    it('H20-U16 rechaza solicitudes sin sesión con 401', async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => ProfileController.prototype.listIdentityDocumentsForAdmin,
        getClass: () => ProfileController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it('H20-U17 rechaza al rol TENANT con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.ADMIN] } as never);
      const context = {
        getHandler: () => ProfileController.prototype.listIdentityDocumentsForAdmin,
        getClass: () => ProfileController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.TENANT } }) }),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
    });

    it('H20-U18 rechaza al rol OWNER con 403', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.ADMIN] } as never);
      const context = {
        getHandler: () => ProfileController.prototype.listIdentityDocumentsForAdmin,
        getClass: () => ProfileController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.OWNER } }) }),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
    });

    it('H20-U19 rechaza la operación si no hay usuario autenticado en RolesGuard', () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.ADMIN] } as never);
      const context = {
        getHandler: () => ProfileController.prototype.listIdentityDocumentsForAdmin,
        getClass: () => ProfileController,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 401 }));
    });

    it('H20-U20 traduce la contención de una revisión concurrente a 409', async () => {
      withReviewTransaction.mockImplementation((operation) => operation({
        reviewPending: vi.fn().mockResolvedValue({ count: 0 }),
        setProfileVerified,
      }));

      await expect(service.approveForAdmin('user-1')).rejects.toMatchObject({ status: 409 });
      expect(setProfileVerified).not.toHaveBeenCalled();
    });
  });
});

describe('H20: consultas de IdentityDocumentRepository', () => {
  it('H20-U21 filtra documentos PENDING, ordena por fecha ascendente y aplica el límite de 10', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = new IdentityDocumentRepository({
      identityDocument: { findMany, count },
    } as never);

    await repository.findPendingDocuments(0, 10);
    await repository.countPendingDocuments();

    expect(findMany).toHaveBeenCalledWith({
      where: { documentStatus: 'PENDING' },
      include: { profile: { include: { user: true } } },
      orderBy: { submittedAt: 'asc' },
      skip: 0,
      take: 10,
    });
    expect(count).toHaveBeenCalledWith({ where: { documentStatus: 'PENDING' } });
  });
});
