import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CloudinaryService, type UploadedImage } from './cloudinary.service.js';
import { PropertiesRepository } from '@Properties/repositories';
import { AvailabilityBlockResponseDto, type CreateAvailabilityBlockDto, type CreatePropertyRequestDto, type UpdatePropertyRequestDto, type UpdatePropertyStatusDto } from '@Properties/dto';
import type { Property } from '@PrismaClient';
import { BookingStatus, Prisma, PropertyStatus, Role } from '@PrismaClient';
import type { PropertyCatalogResponseDto } from '@Properties/dto';
import type { PropertyCatalogQueryDto } from '@Properties/dto';

const CATALOG_PAGE_SIZE = 12;
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EL_SALVADOR_TIME_ZONE = 'America/El_Salvador';
const AVAILABILITY_DAYS = 90;

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

  async updateOwnedStatus(ownerId: string, id: string, dto: UpdatePropertyStatusDto) {
    return this.propertiesRepository.serializableTransaction(async (transaction) => {
      const property = await this.propertiesRepository.findOwnedForManagement(ownerId, id, transaction);
      if (!property) {
        throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe o no te pertenece.' });
      }
      if (property.status === PropertyStatus.DELETED) {
        throw new ConflictException({ code: 'PROPERTY_DELETED', message: 'No se puede cambiar el estado de un bien ELIMINADO.' });
      }
      if ((await this.propertiesRepository.countActiveBookings(id, transaction)) > 0) {
        throw new ConflictException({
          code: 'PROPERTY_STATUS_CHANGE_BLOCKED',
          message: 'No se puede cambiar el estado ni eliminar un bien con reservas PENDIENTE O PAGADA',
        });
      }
      const updated = await this.propertiesRepository.updateStatus(id, dto.status, transaction);
      return { id: updated.id, status: updated.status, statusChangedAt: updated.updatedAt };
    });
  }

  async deleteOwned(ownerId: string, id: string): Promise<void> {
    await this.propertiesRepository.serializableTransaction(async (transaction) => {
      const property = await this.propertiesRepository.findOwnedForManagement(ownerId, id, transaction);
      if (!property) {
        throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe o no te pertenece.' });
      }
      if (property.status === PropertyStatus.DELETED) {
        throw new ConflictException({ code: 'PROPERTY_ALREADY_DELETED', message: 'El bien ya está ELIMINADO.' });
      }
      if ((await this.propertiesRepository.countActiveBookings(id, transaction)) > 0) {
        throw new ConflictException({
          code: 'PROPERTY_DELETE_BLOCKED',
          message: 'No se puede cambiar el estado ni eliminar un bien con reservas PENDIENTE O PAGADA',
        });
      }
      await this.propertiesRepository.softDelete(id, transaction);
    });
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
  async listCatalog(query: PropertyCatalogQueryDto): Promise<PropertyCatalogResponseDto> {
    if (query.municipality && !query.department) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Debes indicar department para filtrar por municipality.',
      });
    }

    const filters: Prisma.PropertyWhereInput = {
      status: PropertyStatus.AVAILABLE,
      ...(query.department && { department: { equals: query.department, mode: 'insensitive' } }),
      ...(query.municipality && { municipality: { equals: query.municipality, mode: 'insensitive' } }),
      ...(query.category && { category: query.category }),
      ...(query.noDeposit === true && { securityDeposit: '0' }),
      ...((query.minPrice !== undefined || query.maxPrice !== undefined) && {
        pricePerDay: {
          ...(query.minPrice !== undefined && { gte: query.minPrice }),
          ...(query.maxPrice !== undefined && { lte: query.maxPrice }),
        },
      }),
      ...(query.startDate !== undefined && query.endDate !== undefined && {
        NOT: {
          OR: [
            {
              bookings: {
                some: {
                  startDate: { lte: this.toDatabaseDate(query.endDate) },
                  endDate: { gte: this.toDatabaseDate(query.startDate) },
                  OR: [
                    { status: BookingStatus.PAID },
                    {
                      status: BookingStatus.PENDING,
                      expiresAt: { gt: new Date() },
                    },
                  ],
                },
              },
            },
            {
              availabilityBlocks: {
                some: {
                  startDate: { lte: this.toDatabaseDate(query.endDate) },
                  endDate: { gte: this.toDatabaseDate(query.startDate) },
                },
              },
            },
          ],
        },
      }),
    };

    const { properties, total } =
      await this.propertiesRepository.findAvailablePage(
        query.page,
        filters,
        query.q,
      );

    return {
      data: properties.map((property) => ({
        ...property,
        pricePerDay: property.pricePerDay.toFixed(2),
      })),
      total,
      page: query.page,
      pageSize: CATALOG_PAGE_SIZE,
    };
  }

  private toDatabaseDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
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

  async getAvailability(id: string, userId: string, role: Role) {
    const property = await this.propertiesRepository.findAvailabilityProperty(
      id,
      role === Role.OWNER ? userId : undefined,
    );
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_AVAILABLE',
        message: 'Este bien ya no está disponible',
      });
    }

    const from = this.getTodayInElSalvador();
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + AVAILABILITY_DAYS - 1);
    const ranges = await this.propertiesRepository.findOccupiedRanges(property.id, from, to);
    const occupied = new Set<string>();
    for (const range of ranges) {
      const start = new Date(Math.max(range.startDate.getTime(), from.getTime()));
      const end = new Date(Math.min(range.endDate.getTime(), to.getTime()));
      for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
        occupied.add(day.toISOString().slice(0, 10));
      }
    }

    return {
      propertyId: property.id,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      occupiedDates: [...occupied].sort(),
    };
  }

  async createAvailabilityBlock(ownerId: string, propertyId: string, dto: CreateAvailabilityBlockDto) {
    const { startDate, endDate } = this.validateAvailabilityBlockPeriod(dto.startDate, dto.endDate);
    try {
      const block = await this.propertiesRepository.serializableTransaction(async (transaction) => {
        const property = await this.propertiesRepository.findOwnedForAvailability(ownerId, propertyId, transaction);
        if (!property) {
          throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe o no te pertenece.' });
        }
        const [overlappingBlock, overlappingBooking] = await Promise.all([
          this.propertiesRepository.findOverlappingAvailabilityBlock(propertyId, startDate, endDate, transaction),
          this.propertiesRepository.findOverlappingActiveBooking(propertyId, startDate, endDate, transaction),
        ]);
        if (overlappingBlock || overlappingBooking) throw this.availabilityBlockConflict();
        return this.propertiesRepository.createAvailabilityBlock(propertyId, startDate, endDate, transaction);
      });
      return AvailabilityBlockResponseDto.fromEntity(block);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw this.availabilityBlockConflict();
      }
      throw error;
    }
  }

  async listAvailabilityBlocks(ownerId: string, propertyId: string) {
    const property = await this.propertiesRepository.findOwnedProperty(ownerId, propertyId);
    if (!property) {
      throw new NotFoundException({ code: 'PROPERTY_NOT_FOUND', message: 'El bien no existe o no te pertenece.' });
    }
    const blocks = await this.propertiesRepository.listAvailabilityBlocks(propertyId, this.getTodayInElSalvador());
    return blocks.map((block) => AvailabilityBlockResponseDto.fromEntity(block));
  }

  async deleteAvailabilityBlock(ownerId: string, blockId: string): Promise<void> {
    const block = await this.propertiesRepository.findAvailabilityBlockById(blockId);
    if (!block) {
      throw new NotFoundException({ code: 'AVAILABILITY_BLOCK_NOT_FOUND', message: 'El bloqueo no existe.' });
    }
    const property = await this.propertiesRepository.findOwnedProperty(ownerId, block.propertyId);
    if (!property) {
      throw new NotFoundException({ code: 'AVAILABILITY_BLOCK_NOT_FOUND', message: 'El bloqueo no existe.' });
    }
    await this.propertiesRepository.deleteAvailabilityBlock(blockId);
  }

  private validateAvailabilityBlockPeriod(start: string, end: string) {
    if (!this.isDateOnly(start) || !this.isDateOnly(end)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Las fechas deben usar el formato YYYY-MM-DD.' });
    }
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) ||
      startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Las fechas indicadas no son válidas.' });
    }
    if (endDate < startDate) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
    }
    const today = this.getTodayInElSalvador();
    const lastAvailableDate = new Date(today);
    lastAvailableDate.setUTCDate(lastAvailableDate.getUTCDate() + AVAILABILITY_DAYS - 1);
    if (startDate < today || endDate > lastAvailableDate) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Las fechas deben estar dentro de los próximos 90 días.' });
    }
    return { startDate, endDate };
  }

  private isDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private availabilityBlockConflict(): ConflictException {
    return new ConflictException({
      code: 'DATES_UNAVAILABLE',
      message: 'Las fechas se traslapan con otro bloqueo o con una reserva PENDIENTE o PAGADA.',
    });
  }

  private getTodayInElSalvador(): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: EL_SALVADOR_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
  }
}
