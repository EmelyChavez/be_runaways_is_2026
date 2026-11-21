import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PropertyStatus } from '@PrismaClient';

export class UpdatePropertyStatusDto {
  @ApiProperty({ enum: [PropertyStatus.AVAILABLE, PropertyStatus.PAUSED] })
  @IsEnum({ AVAILABLE: PropertyStatus.AVAILABLE, PAUSED: PropertyStatus.PAUSED }, {
    message: 'status debe ser AVAILABLE o PAUSED.',
  })
  status!: PropertyStatus;
}
