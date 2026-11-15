import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IdentityDocumentCloudinaryService } from './identity-document-cloudinary.service.js';
import { IdentityDocumentRepository } from '@IdentityDocument/repositories';
import { AccountStatus, IdentityDocumentStatus, IdentityDocumentType, Prisma, Role } from '@PrismaClient';
import type { User } from '@PrismaClient';
import type { SubmitIdentityDocumentDto } from '@IdentityDocument/dto';
import type { MyIdentityDocumentResponseDto } from '@IdentityDocument/dto';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface IdentityDocumentFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class IdentityDocumentService {
  constructor(
    private readonly repository: IdentityDocumentRepository,
    private readonly cloudinary: IdentityDocumentCloudinaryService,
  ) {}

  async submit(user: User, dto: SubmitIdentityDocumentDto, file?: IdentityDocumentFile) {
    if (!dto.documentType || !dto.documentNumber || !file) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Tipo, número y archivo son obligatorios.' });
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'El archivo debe pesar como máximo 5 MB.' });
    }

    const supportedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const signatures: Record<string, boolean> = {
      'image/jpeg': file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff,
      'image/png': file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'application/pdf': file.buffer.subarray(0, 5).toString() === '%PDF-',
    };
    if (!supportedTypes.includes(file.mimetype) || !signatures[file.mimetype]) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'El archivo debe ser JPG, PNG o PDF válido.' });
    }

    const numberIsValid = dto.documentType === IdentityDocumentType.DUI
      ? /^\d{8}-\d$/.test(dto.documentNumber)
      : dto.documentType === IdentityDocumentType.PASSPORT && /^[a-zA-Z0-9]{6,15}$/.test(dto.documentNumber);
    if (!numberIsValid) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'El número no tiene el formato válido para el tipo de documento.' });
    }
    if (user.role !== Role.TENANT) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Solo TENANT puede enviar un documento de identidad.' });
    }

    const currentProfile = await this.repository.findProfileForUser(user.id);
    if (!currentProfile) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'No se encontró el perfil.' });
    if (currentProfile.isVerified) {
      throw new ConflictException({ code: 'ACCOUNT_ALREADY_VERIFIED', message: 'La cuenta ya está verificada.' });
    }
    if (currentProfile.identityDocument?.documentStatus === IdentityDocumentStatus.PENDING) {
      throw new ConflictException({ code: 'DOCUMENT_PENDING', message: 'Ya tienes un documento pendiente de revisión.' });
    }

    const uploaded = await this.cloudinary.upload(file.buffer, file.mimetype);
    try {
      const result = await this.repository.withTransaction(async (repository) => {
        const profile = await repository.findProfileForUser(user.id);
        if (!profile) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'No se encontró el perfil.' });
        if (profile.isVerified) {
          throw new ConflictException({ code: 'ACCOUNT_ALREADY_VERIFIED', message: 'La cuenta ya está verificada.' });
        }
        if (profile.identityDocument?.documentStatus === IdentityDocumentStatus.PENDING) {
          throw new ConflictException({ code: 'DOCUMENT_PENDING', message: 'Ya tienes un documento pendiente de revisión.' });
        }

        const documentData = {
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          documentUrl: uploaded.secureUrl,
          documentStatus: IdentityDocumentStatus.PENDING,
          submittedAt: new Date(),
          rejectionReason: null,
          reviewedAt: null,
        } as const;
        const previousDocumentUrl = profile.identityDocument?.documentUrl;
        if (profile.identityDocument) {
          const updated = await repository.updateIfEligible(profile.id, documentData);
          if (updated.count !== 1) {
            throw new ConflictException({ code: 'DOCUMENT_PENDING', message: 'Ya tienes un documento pendiente de revisión.' });
          }
          return {
            document: { ...profile.identityDocument, ...documentData },
            previousDocumentUrl,
          };
        }
        const document = await repository.create(profile.id, documentData);
        return { document, previousDocumentUrl };
      });
      if (result.previousDocumentUrl) await this.cloudinary.deleteByUrl(result.previousDocumentUrl).catch(() => undefined);
      return {
        documentType: result.document.documentType,
        documentStatus: result.document.documentStatus,
        documentSubmittedAt: result.document.submittedAt.toISOString(),
      };
    } catch (error) {
      await this.cloudinary.delete(uploaded.publicId).catch(() => undefined);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException({ code: 'DOCUMENT_PENDING', message: 'Ya tienes un documento pendiente de revisión.' });
      }
      throw error;
    }
  }

  async getMyStatus(userId: string): Promise<MyIdentityDocumentResponseDto> {
    const profile = await this.repository.findProfileForUser(userId);
    if (!profile) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'No se encontró el perfil.' });

    const document = profile.identityDocument;
    const accountStatus = profile.isVerified || document?.documentStatus === IdentityDocumentStatus.APPROVED
      ? AccountStatus.VERIFIED
      : document?.documentStatus === IdentityDocumentStatus.PENDING
        ? AccountStatus.PENDING
        : document?.documentStatus === IdentityDocumentStatus.REJECTED
          ? AccountStatus.REJECTED
          : AccountStatus.UNVERIFIED;

    return {
      accountStatus,
      ...(document && {
        documentType: document.documentType,
        documentSubmittedAt: document.submittedAt.toISOString(),
        ...(document.documentStatus === IdentityDocumentStatus.REJECTED && document.rejectionReason
          ? { rejectionReason: document.rejectionReason }
          : {}),
      }),
    };
  }
}
