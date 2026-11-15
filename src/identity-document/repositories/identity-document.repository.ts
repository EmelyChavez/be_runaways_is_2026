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

  reviewPending(userId: string, status: IdentityDocumentStatus, rejectionReason: string | null, reviewedAt: Date) {
    return this.transaction.identityDocument.updateMany({
      where: { documentStatus: 'PENDING', profile: { is: { userId } } },
      data: { documentStatus: status, rejectionReason, reviewedAt },
    });
  }

  setProfileVerified(userId: string, isVerified: boolean) {
    return this.transaction.profile.update({ where: { userId }, data: { isVerified } });
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

  findPendingDocuments(skip: number, take: number) {
    return this.prisma.identityDocument.findMany({
      where: { documentStatus: 'PENDING' },
      include: { profile: { include: { user: true } } },
      orderBy: { submittedAt: 'asc' }, skip, take,
    });
  }

  countPendingDocuments() {
    return this.prisma.identityDocument.count({ where: { documentStatus: 'PENDING' } });
  }

  findPendingDocumentForUser(userId: string) {
    return this.prisma.identityDocument.findFirst({
      where: { documentStatus: 'PENDING', profile: { is: { userId } } },
      include: { profile: { include: { user: true } } },
    });
  }

  findDocumentForUser(userId: string) {
    return this.prisma.identityDocument.findFirst({
      where: { profile: { is: { userId } } },
      include: { profile: { include: { user: true } } },
    });
  }

  withReviewTransaction<T>(operation: (repository: IdentityDocumentTransactionRepository) => Promise<T>) {
    return this.prisma.$transaction(
      (transaction) => operation(new IdentityDocumentTransactionRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  withTransaction<T>(operation: (repository: IdentityDocumentTransactionRepository) => Promise<T>) {
    return this.prisma.$transaction(
      (transaction) => operation(new IdentityDocumentTransactionRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

}
