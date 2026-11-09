import { ApiProperty } from '@nestjs/swagger';
import { PropertyCategory, PropertyStatus, type Property } from '@PrismaClient';

export class CreatePropertyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ownerId!: string;

  @ApiProperty({ maxLength: 100 })
  title!: string;

  @ApiProperty({ minLength: 30 })
  description!: string;

  @ApiProperty({ enum: PropertyCategory })
  category!: PropertyCategory;

  @ApiProperty()
  department!: string;

  @ApiProperty()
  municipality!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ example: '45.00', description: 'Monto USD con dos decimales.' })
  pricePerDay!: string;

  @ApiProperty({ example: '100.00', description: 'Monto USD con dos decimales.' })
  securityDeposit!: string;

  @ApiProperty({ type: [String], description: 'URLs seguras de las imágenes almacenadas en Cloudinary.' })
  images!: string[];

  @ApiProperty({ enum: PropertyStatus, example: PropertyStatus.AVAILABLE })
  status!: PropertyStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(property: Property): CreatePropertyResponseDto {
    return {
      id: property.id,
      ownerId: property.ownerId,
      title: property.title,
      description: property.description,
      category: property.category,
      department: property.department,
      municipality: property.municipality,
      address: property.address,
      pricePerDay: property.pricePerDay.toFixed(2),
      securityDeposit: property.securityDeposit.toFixed(2),
      images: property.images,
      status: property.status,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };
  }
}
