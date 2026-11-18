import { ApiProperty } from '@nestjs/swagger';
import { PropertyStatus } from '@PrismaClient';

export class OwnerPropertyRatingDto {
  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: PropertyStatus })
  status!: PropertyStatus;

  @ApiProperty({ type: Number, nullable: true, example: 4.5 })
  averageRating!: number | null;

  @ApiProperty({ type: Number, minimum: 0 })
  reviewCount!: number;
}

export class OwnerRatingsReportResponseDto {
  @ApiProperty({ type: [OwnerPropertyRatingDto] })
  data!: OwnerPropertyRatingDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  constructor(data: OwnerRatingsReportResponseDto) {
    Object.assign(this, data);
  }
}
