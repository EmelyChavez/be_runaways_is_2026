import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const DEPOSIT_DECISION_TYPES = ['DEVOLVER', 'RETENER'] as const;

export class CreateDepositDecisionDto {
  @ApiProperty({ enum: DEPOSIT_DECISION_TYPES, example: 'RETENER' })
  @IsIn(DEPOSIT_DECISION_TYPES, { message: 'decisionType debe ser DEVOLVER o RETENER.' })
  decisionType!: (typeof DEPOSIT_DECISION_TYPES)[number];

  @ApiPropertyOptional({ example: '25.00', description: 'Obligatorio cuando decisionType es RETENER.' })
  @ValidateIf((dto: CreateDepositDecisionDto) => dto.decisionType === 'RETENER')
  @IsString({ message: 'retentionAmount debe ser un monto decimal.' })
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'retentionAmount debe tener como máximo dos decimales.' })
  retentionAmount?: string;

  @ApiPropertyOptional({ maxLength: 250, description: 'Obligatorio cuando decisionType es RETENER.' })
  @ValidateIf((dto: CreateDepositDecisionDto) => dto.decisionType === 'RETENER')
  @IsString({ message: 'retentionReason debe ser texto.' })
  @Matches(/\S/, { message: 'retentionReason no puede estar vacío.' })
  @MaxLength(250, { message: 'retentionReason no puede superar 250 caracteres.' })
  retentionReason?: string;
}
