import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CloudinaryService, type UploadedImage } from './cloudinary.service.js';
import { PropertiesRepository } from '@Properties/repositories';
import type { CreatePropertyRequestDto, UpdatePropertyRequestDto } from '@Properties/dto';
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
    private readonly propertiesRepository: PropertiesRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(ownerId: string, dto: CreatePropertyRequestDto, files: PropertyImageFile[]): Promise<Property> {
    this.validateImages(files, true);
    const uploaded: UploadedImage[] = [];

    try {
      for (const file of files) {
        uploaded.push(await this.cloudinaryService.upload(file.buffer, file.mimetype));
      }

      return await this.propertiesRepository.create(
        ownerId,
        dto,
        uploaded.map((image) => image.secureUrl),
      );
    } catch (error) {
      await Promise.allSettled(uploaded.map(({ publicId }) => this.cloudinaryService.delete(publicId)));
      throw error;
    }
  }

  private validateImages(files: PropertyImageFile[], requireOne: boolean): void {
    if (!files || files.length > MAX_IMAGES || (requireOne && files.length < 1)) {
      throw new BadRequestException('Debes mantener entre una y cinco fotos del bien.');
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
  }

  async listMine(ownerId: string, page: number) {
    const { properties, total } = await this.propertiesRepository.findOwnerPage(ownerId, page);
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

  async getOwnedDetail(ownerId: string, id: string) {
    const property = await this.propertiesRepository.findOwnedById(ownerId, id);
    if (!property) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe o no te pertenece.' });
    }
    return property;
  }

  async updateOwned(
    ownerId: string,
    id: string,
    dto: UpdatePropertyRequestDto,
    files: PropertyImageFile[],
  ): Promise<Property> {
    const current = await this.propertiesRepository.findOwnedById(ownerId, id);
    if (!current) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe o no te pertenece.' });
    }

    this.validateImages(files ?? [], false);
    const imagesToRemove = dto.imagesToRemove ?? [];
    const removalSet = new Set(imagesToRemove);
    if (removalSet.size !== imagesToRemove.length || imagesToRemove.some((url) => !current.images.includes(url))) {
      throw new BadRequestException('La lista de imágenes a remover no es válida.');
    }
    const finalImageCount = current.images.length - removalSet.size + files.length;
    if (finalImageCount < 1 || finalImageCount > MAX_IMAGES) {
      throw new BadRequestException('El bien debe conservar entre una y cinco fotos.');
    }

    const uploaded: UploadedImage[] = [];
    try {
      for (const file of files) {
        uploaded.push(await this.cloudinaryService.upload(file.buffer, file.mimetype));
      }
      const result = await this.propertiesRepository.transaction(async (transaction) => {
        const latest = await this.propertiesRepository.findOwnedById(ownerId, id, transaction);
        if (!latest) {
          throw new NotFoundException({
            code: 'PROPERTY_NOT_FOUND',
            message: 'El bien no existe o no te pertenece.',
          });
        }
        if (imagesToRemove.some((url) => !latest.images.includes(url))) {
          throw new BadRequestException('La lista de imágenes a remover no es válida.');
        }
        const imageCount = latest.images.length - removalSet.size + files.length;
        if (imageCount < 1 || imageCount > MAX_IMAGES) {
          throw new BadRequestException('El bien debe conservar entre una y cinco fotos.');
        }

        const changesProtectedAmount =
          !latest.pricePerDay.equals(dto.pricePerDay) ||
          !latest.securityDeposit.equals(dto.securityDeposit);
        if (
          changesProtectedAmount &&
          (await this.propertiesRepository.countActiveBookings(id, transaction)) > 0
        ) {
          throw new ConflictException({
            code: 'PROPERTY_PRICE_CHANGE_BLOCKED',
            message: 'No se puede modificar el precio ni el depósito de un bien con reservas PENDIENTE O PAGADA',
          });
        }

        const finalImages = [
          ...latest.images.filter((image) => !removalSet.has(image)),
          ...uploaded.map((image) => image.secureUrl),
        ];
        const property = await this.propertiesRepository.updateOwned(
          ownerId,
          id,
          dto,
          finalImages,
          transaction,
        );
        return {
          property,
          removedImages: latest.images.filter((image) => !finalImages.includes(image)),
        };
      });
      await Promise.allSettled(result.removedImages.map((url) => this.cloudinaryService.deleteByUrl(url)));
      return result.property;
    } catch (error) {
      await Promise.allSettled(uploaded.map(({ publicId }) => this.cloudinaryService.delete(publicId)));
      throw error;
    }
  }
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
