import { Module } from '@nestjs/common';
import { IdentityDocumentRepository } from '@IdentityDocument/repositories';
import { IdentityDocumentCloudinaryService, IdentityDocumentService } from '@IdentityDocument/services';

@Module({
  providers: [IdentityDocumentRepository, IdentityDocumentService, IdentityDocumentCloudinaryService],
  exports: [IdentityDocumentService],
})
export class IdentityDocumentModule {}
