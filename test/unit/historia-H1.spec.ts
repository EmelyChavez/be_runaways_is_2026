import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { PropertyCategory, PropertyStatus, Role } from '../../src/generated/prisma/client.js';
import { CreatePropertyRequestDto } from '../../src/properties/dto/create-property.dto.js';
import { CreatePropertyResponseDto } from '../../src/properties/dto/create-property-response.dto.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService, type PropertyImageFile } from '../../src/properties/services/properties.service.js';

describe('H1: publicar una propiedad', () => {
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const makeFile = (mimetype = 'image/png', buffer = pngSignature, size = buffer.length): PropertyImageFile => ({ buffer, mimetype, size });
  const dto: CreatePropertyRequestDto = {
    title: 'Cámara profesional',
    description: 'Cámara en excelente estado, incluye lente, estuche y accesorios.',
    category: PropertyCategory.EQUIPMENT,
    department: 'La Libertad',
    municipality: 'Santa Tecla',
    address: 'Colonia Las Delicias',
    pricePerDay: '45.00',
    securityDeposit: '100.00',
  };

  const makeEntity = (images: string[]) => ({
    id: '1d4f3fa0-bb7d-4c31-9b19-87324a78e114', ownerId, ...dto,
    pricePerDay: { toFixed: () => '45.00' }, securityDeposit: { toFixed: () => '100.00' },
    verifiedOnly: true, images, status: PropertyStatus.AVAILABLE,
    createdAt: new Date('2026-11-19T12:00:00.000Z'), updatedAt: new Date('2026-11-19T12:00:00.000Z'),
  });

  describe('casos positivos', () => {
    it('publica el bien del OWNER con una foto, estado AVAILABLE y respuesta completa', async () => {
      const image = makeFile('image/jpeg', jpegSignature);
      const uploaded = { secureUrl: 'https://images.example/property.jpg', publicId: 'property-image' };
      const upload = vi.fn().mockResolvedValue(uploaded);
      const create = vi.fn().mockResolvedValue(makeEntity([uploaded.secureUrl]));
      const service = new PropertiesService({ create } as never, { upload } as never);

      const entity = await service.create(ownerId, dto, [image]);
      const response = CreatePropertyResponseDto.fromEntity(entity as never);

      expect(upload).toHaveBeenCalledWith(image.buffer, 'image/jpeg');
      expect(create).toHaveBeenCalledWith(ownerId, dto, [uploaded.secureUrl]);
      expect(response).toMatchObject({ ownerId, title: dto.title, status: PropertyStatus.AVAILABLE, images: [uploaded.secureUrl], pricePerDay: '45.00' });
      expect(response.id).toMatch(/[0-9a-f-]{36}/i);
      expect(response.createdAt.toISOString()).toBe('2026-11-19T12:00:00.000Z');
    });

    it('acepta cinco fotos JPG/PNG válidas de hasta 5 MB', async () => {
      const files = [makeFile('image/jpeg', jpegSignature), ...Array.from({ length: 4 }, () => makeFile())];
      files[4] = makeFile('image/png', pngSignature, 5 * 1024 * 1024);
      const upload = vi.fn(async (_buffer: Buffer, _mime: string) => ({ secureUrl: `https://images.example/${upload.mock.calls.length}.png`, publicId: 'image' }));
      const create = vi.fn().mockResolvedValue(makeEntity(files.map((_, index) => `https://images.example/${index}.png`)));
      const service = new PropertiesService({ create } as never, { upload } as never);

      await service.create(ownerId, dto, files);

      expect(upload).toHaveBeenCalledTimes(5);
      expect(create.mock.calls[0][2]).toHaveLength(5);
    });

    it('persiste los campos recibidos y usa el identificador del arrendador autenticado', async () => {
      const propertyCreate = vi.fn().mockResolvedValue(makeEntity(['https://images.example/photo.png']));
      const repository = new PropertiesRepository({ property: { create: propertyCreate } } as never);

      await repository.create(ownerId, dto, ['https://images.example/photo.png']);

      expect(propertyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
        ownerId, title: dto.title, description: dto.description, category: dto.category,
        department: dto.department, municipality: dto.municipality, address: dto.address,
        pricePerDay: dto.pricePerDay, securityDeposit: dto.securityDeposit,
        images: ['https://images.example/photo.png'], verifiedOnly: true,
      }) });
    });

    it('incluye la nueva publicación AVAILABLE en la siguiente consulta del catálogo', async () => {
      const property = makeEntity(['https://images.example/photo.png']);
      const create = vi.fn().mockResolvedValue(property);
      const findAvailablePage = vi.fn().mockResolvedValue({ properties: [property], total: 1 });
      const service = new PropertiesService({ create, findAvailablePage } as never, {
        upload: vi.fn().mockResolvedValue({ secureUrl: 'https://images.example/photo.png', publicId: 'photo' }),
      } as never);

      await service.create(ownerId, dto, [makeFile()]);
      const catalog = await service.listCatalog({ page: 1 } as never);

      expect(findAvailablePage).toHaveBeenCalledWith(1, { status: PropertyStatus.AVAILABLE }, undefined);
      expect(catalog.data).toHaveLength(1);
      expect(catalog.data[0]).toMatchObject({ id: property.id, title: dto.title });
    });

    it('protege POST /properties para OWNER', () => {
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.create)).toEqual([Role.OWNER]);
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.create,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.OWNER } }) }),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('casos negativos', () => {
    it.each([0, 6])('rechaza %i fotos con 400 sin guardar ni subir imágenes', async (count) => {
      const upload = vi.fn();
      const create = vi.fn();
      const service = new PropertiesService({ create } as never, { upload } as never);

      await expect(service.create(ownerId, dto, Array.from({ length: count }, () => makeFile()))).rejects.toBeInstanceOf(BadRequestException);
      expect(upload).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it.each([
      ['foto mayor de 5 MB', makeFile('image/png', pngSignature, 5 * 1024 * 1024 + 1)],
      ['formato GIF', makeFile('image/gif', Buffer.from('GIF89a'))],
      ['contenido que no coincide con JPG', makeFile('image/jpeg', pngSignature)],
      ['contenido que no coincide con PNG', makeFile('image/png', jpegSignature)],
    ])('rechaza %s con 400 antes de persistir', async (_description, file) => {
      const upload = vi.fn();
      const create = vi.fn();
      const service = new PropertiesService({ create } as never, { upload } as never);

      await expect(service.create(ownerId, dto, [file as PropertyImageFile])).rejects.toBeInstanceOf(BadRequestException);
      expect(upload).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it.each([
      ['nombre vacío', { title: '   ' }],
      ['nombre mayor de 100 caracteres', { title: 'a'.repeat(101) }],
      ['descripción menor de 30 caracteres', { description: 'Descripción demasiado corta.' }],
      ['categoría inválida', { category: 'OTRA' }],
      ['departamento vacío', { department: '' }],
      ['municipio vacío', { municipality: '' }],
      ['precio cero', { pricePerDay: '0.00' }],
      ['precio negativo', { pricePerDay: '-1.00' }],
    ])('rechaza %s con validación 400', async (_description, overrides) => {
      const invalidDto = plainToInstance(CreatePropertyRequestDto, { ...dto, ...overrides });

      await expect(validate(invalidDto)).resolves.not.toHaveLength(0);
    });

    it('rechaza la publicación sin sesión con 401', async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const context = {
        getHandler: () => PropertiesController.prototype.create,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it.each([Role.TENANT, Role.ADMIN])('deniega la publicación al rol %s con 403', (role) => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.create,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as never;

      expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
    });
  });
});
