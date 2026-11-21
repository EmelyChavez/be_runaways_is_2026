import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  propertyId!: string;
}
