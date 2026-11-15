import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import { Prisma } from '@PrismaClient';
import type { IdentityDocumentStatus, IdentityDocumentType } from '@PrismaClient';

export interface IdentityDocumentWrite {
  documentType: IdentityDocumentType;
  documentNumber: string;
  documentUrl: string;
  documentStatus: IdentityDocumentStatus;
  submittedAt: Date;
  rejectionReason: null;
  reviewedAt: null;
}

export class IdentityDocumentTransactionRepository {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  findProfileForUser(userId: string) {
    return this.transaction.profile.findUnique({
      where: { userId },
      include: { identityDocument: true },
    });
  }

  create(profileId: string, data: IdentityDocumentWrite) {
    return this.transaction.identityDocument.create({ data: { profileId, ...data } });
  }

  updateIfEligible(profileId: string, data: IdentityDocumentWrite) {
    return this.transaction.identityDocument.updateMany({
      where: {
        profileId,
        documentStatus: { not: 'PENDING' },
        profile: { is: { isVerified: false } },
      },
      data,
    });
  }
}

@Injectable()
export class IdentityDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfileForUser(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
      include: { identityDocument: true },
    });
  }

  withTransaction<T>(operation: (repository: IdentityDocumentTransactionRepository) => Promise<T>) {
    return this.prisma.$transaction(
      (transaction) => operation(new IdentityDocumentTransactionRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

}
