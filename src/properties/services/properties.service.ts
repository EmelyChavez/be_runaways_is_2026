import { Injectable, BadRequestException, NotFoundException} from '@nestjs/common';
import { CloudinaryService, type UploadedImage } from './cloudinary.service.js';
import { PropertyRepository } from '@Properties/repositories';
import type { CreatePropertyDto } from '@Properties/dto';
import type { Property } from '@PrismaClient';
import type { PropertyCatalogResponseDto } from '@Properties/dto';

const CATALOG_PAGE_SIZE = 12;
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface PropertyImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(ownerId: string, dto: CreatePropertyDto, files: PropertyImageFile[]): Promise<Property> {
    this.validateImages(files);
    const uploaded: UploadedImage[] = [];

    try {
      for (const file of files) {
        uploaded.push(await this.cloudinaryService.upload(file.buffer, file.mimetype));
      }

      return await this.propertyRepository.create(
        ownerId,
        dto,
        uploaded.map((image) => image.secureUrl),
      );
    } catch (error) {
      await Promise.allSettled(uploaded.map(({ publicId }) => this.cloudinaryService.delete(publicId)));
      throw error;
    }
  }

  private validateImages(files: PropertyImageFile[]): void {
    if (!files || files.length < 1 || files.length > MAX_IMAGES) {
      throw new BadRequestException('Debes subir entre una y cinco fotos del bien.');
    }

    for (const file of files) {
      const isAllowedMimeType = file.mimetype === 'image/jpeg' || file.mimetype === 'image/png';
      const isAllowedSize = file.size <= MAX_IMAGE_BYTES;
      const hasJpegSignature = file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
      const hasPngSignature = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const signatureMatchesMimeType =
        (file.mimetype === 'image/jpeg' && hasJpegSignature) ||
        (file.mimetype === 'image/png' && hasPngSignature);

      if (!isAllowedMimeType || !isAllowedSize || !signatureMatchesMimeType) {
        throw new BadRequestException('Cada foto debe ser JPG o PNG y pesar como máximo 5 MB.');
      }
    }


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
