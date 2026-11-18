import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  senderId!: string;

  @ApiProperty({ maxLength: 500 })
  content!: string;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
