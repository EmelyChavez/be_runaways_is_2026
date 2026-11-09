import { Injectable } from '@nestjs/common';
import { PrismaService } from '@Prisma/services';
import type { CreatePropertyDto } from '@Properties/dto';
import type { Property } from '@PrismaClient';

@Injectable()
export class PropertyRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, data: CreatePropertyDto, images: string[]): Promise<Property> {
    return this.prisma.property.create({
      data: {
        ownerId,
        title: data.title,
        description: data.description,
        category: data.category,
        department: data.department,
        municipality: data.municipality,
        address: data.address,
        pricePerDay: data.pricePerDay,
        securityDeposit: data.securityDeposit,
        images,
      },
    });
  }
}
