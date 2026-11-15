import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, IdentityDocumentStatus, IdentityDocumentType } from '@PrismaClient';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

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

export class AdminIdentityDocumentQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ required: false, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}

export class RejectIdentityDocumentDto {
  @ApiProperty({ minLength: 10, maxLength: 300 })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(300)
  rejectionReason!: string;
}
