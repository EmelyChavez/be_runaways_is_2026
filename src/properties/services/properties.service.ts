import { Injectable } from '@nestjs/common';
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
}
