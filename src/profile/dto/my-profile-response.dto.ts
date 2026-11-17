import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdentityDocumentStatus, IdentityDocumentType, Role } from '@PrismaClient';

export class ProfileDocumentDto {
  @ApiProperty({ enum: IdentityDocumentType }) type!: IdentityDocumentType;
  @ApiProperty({ example: '•••••••5-8' }) number!: string;
  @ApiProperty({ enum: IdentityDocumentStatus }) status!: IdentityDocumentStatus;
}

export class ProfileRatingDto {
  @ApiPropertyOptional({ example: 4.5, nullable: true }) average!: number | null;
  @ApiProperty({ example: 3 }) count!: number;
}

export class MyProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ type: ProfileDocumentDto, nullable: true }) document!: ProfileDocumentDto | null;
  @ApiProperty({ type: ProfileRatingDto }) rating!: ProfileRatingDto;
}
