import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, IdentityDocumentStatus, IdentityDocumentType } from '@PrismaClient';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class SubmitIdentityDocumentDto {
  @ApiProperty({ enum: IdentityDocumentType })
  @IsEnum(IdentityDocumentType)
  documentType!: IdentityDocumentType;

  @ApiProperty({ example: 'DUI: 01234567-8 o PASAPORTE: A01234567' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

}

export class SubmitIdentityDocumentResponseDto {
  @ApiProperty({ enum: IdentityDocumentType })
  documentType!: IdentityDocumentType;

  @ApiProperty({ enum: IdentityDocumentStatus })
  documentStatus!: IdentityDocumentStatus;

  @ApiProperty({ example: '2026-11-14T12:00:00.000Z' })
  documentSubmittedAt!: string;
}

export class MyIdentityDocumentResponseDto {
  @ApiProperty({ enum: AccountStatus })
  accountStatus!: AccountStatus;

  @ApiProperty({ enum: IdentityDocumentType, required: false })
  documentType?: IdentityDocumentType;

  @ApiProperty({ example: '2026-11-14T12:00:00.000Z', required: false })
  documentSubmittedAt?: string;

  @ApiProperty({ required: false })
  rejectionReason?: string;
}
