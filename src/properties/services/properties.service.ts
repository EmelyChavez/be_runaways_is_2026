import { Injectable, NotFoundException } from '@nestjs/common';
import type { PropertyCatalogResponseDto } from '@Properties/dto';
import { PropertiesRepository } from '@Properties/repositories';

const CATALOG_PAGE_SIZE = 12;

@Injectable()
export class PropertiesService {
  constructor(private readonly propertiesRepository: PropertiesRepository) {}

  async listCatalog(page: number): Promise<PropertyCatalogResponseDto> {
    const { properties, total } =
      await this.propertiesRepository.findAvailablePage(page);

    return {
      data: properties.map((property) => ({
        ...property,
        pricePerDay: property.pricePerDay.toFixed(2),
      })),
      total,
      page,
      pageSize: CATALOG_PAGE_SIZE,
    };
  }

  async getDetail(id: string) {
    const property = await this.propertiesRepository.findAvailableById(id);
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_AVAILABLE',
        message: 'Este bien no existe o no está disponible',
      });
    }

    const [propertyRating, ownerRating, reviews] = await Promise.all([
      this.propertiesRepository.findPropertyRating(id),
      this.propertiesRepository.findUserRating(property.owner.id),
      this.propertiesRepository.findPropertyReviews(id),
    ]);

    return {
      ...property,
      pricePerDay: property.pricePerDay.toFixed(2),
      securityDeposit: property.securityDeposit.toFixed(2),
      owner: property.owner,
      propertyRatingAverage:
        propertyRating._avg.propertyRating === null
          ? null
          : propertyRating._avg.propertyRating.toFixed(1),
      propertyReviewCount: propertyRating._count._all,
      ownerRatingAverage:
        ownerRating._avg.userRating === null
          ? null
          : ownerRating._avg.userRating.toFixed(1),
      ownerReviewCount: ownerRating._count._all,
      reviews,
    };
  }
}
