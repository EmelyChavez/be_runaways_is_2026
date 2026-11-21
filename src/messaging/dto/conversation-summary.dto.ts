import { ApiProperty } from '@nestjs/swagger';

export class ConversationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  propertyTitle!: string;

  @ApiProperty({ format: 'uuid' })
  participantId!: string;

  @ApiProperty()
  participantName!: string;

  @ApiProperty({ example: 2 })
  unreadCount!: number;

  @ApiProperty({ format: 'date-time', nullable: true })
  lastMessageAt!: string | null;
}
