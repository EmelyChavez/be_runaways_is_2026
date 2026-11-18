import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role, PropertyCategory, PropertyStatus } from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { UpdatePropertyRequestDto } from '../../src/properties/dto/update-property.dto.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService, type PropertyImageFile } from '../../src/properties/services/properties.service.js';

describe('H4: ver y editar mis publicaciones', () => {
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const propertyId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const firstImage = 'https://images.example/first.jpg';
  const secondImage = 'https://images.example/second.jpg';
  const tx = {};

  const makeDto = (overrides: Record<string, unknown> = {}) => ({
    title: 'Casa actualizada',
    description: 'Una casa espaciosa y equipada para disfrutar las vacaciones.',
    category: PropertyCategory.PROPERTY,
    department: 'La Libertad',
    municipality: 'Santa Tecla',
    address: 'Residencial Las Palmas',
    pricePerDay: '45.00',
    securityDeposit: '100.00',
    verifiedOnly: false,
    imagesToRemove: [],
    ...overrides,
  });

  const makeCurrent = (overrides: Record<string, unknown> = {}) => ({
    id: propertyId,
    ownerId,
    title: 'Casa original',
    description: 'Una casa espaciosa y equipada para disfrutar las vacaciones.',
    category: PropertyCategory.PROPERTY,
    department: 'La Libertad',
    municipality: 'Santa Tecla',
    address: 'Residencial Las Palmas',
    pricePerDay: { equals: (value: string) => value === '45.00' },
    securityDeposit: { equals: (value: string) => value === '100.00' },
    verifiedOnly: false,
    images: [firstImage, secondImage],
    status: PropertyStatus.AVAILABLE,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    ...overrides,
  });

  const makeFile = (index: number): PropertyImageFile => ({
    buffer: Buffer.from([0xff, 0xd8, 0xff, index]),
    mimetype: 'image/jpeg',
    size: 4,
  });

  const makeEditHarness = (options: {
    current?: Record<string, unknown> | null;
    latest?: Record<string, unknown> | null;
    activeBookings?: number;
  } = {}) => {
    const current = options.current === undefined ? makeCurrent() : options.current;
    const latest = options.latest === undefined ? current : options.latest;
    const findOwnedById = vi.fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(latest);
    const countActiveBookings = vi.fn().mockResolvedValue(options.activeBookings ?? 0);
    const updateOwned = vi.fn().mockImplementation(async (_owner, _id, dto, images) => ({
      ...makeCurrent(),
      ...dto,
      images,
      pricePerDay: { toFixed: () => dto.pricePerDay },
      securityDeposit: { toFixed: () => dto.securityDeposit },
    }));
    const transaction = vi.fn((operation) => operation(tx));
    const upload = vi.fn().mockImplementation(async (_buffer, _mime, index = 0) => ({
      secureUrl: `https://images.example/new-${index}.jpg`,
      publicId: `properties/new-${index}`,
    }));
    const deleteUpload = vi.fn().mockResolvedValue(undefined);
    const deleteByUrl = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findOwnedById,
      countActiveBookings,
      updateOwned,
      transaction,
    };
    const cloudinary = { upload, delete: deleteUpload, deleteByUrl };
    const service = new PropertiesService(repository as never, cloudinary as never);
    return { service, repository, cloudinary, findOwnedById, countActiveBookings, updateOwned, transaction, upload, deleteUpload, deleteByUrl };
  };

  describe('casos positivos', () => {
    it('lista solo los bienes del arrendador en estado AVAILABLE o PAUSED, 12 por página y del más reciente al más antiguo', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const repository = new PropertiesRepository({
        property: { findMany, count },
        $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
      } as never);

      await repository.findOwnerPage(ownerId, 1);

      const expectedWhere = {
        ownerId,
        status: { in: [PropertyStatus.AVAILABLE, PropertyStatus.PAUSED] },
      };
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expectedWhere,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 12,
      }));
      expect(count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('devuelve metadatos de la lista propia y formatea el precio con dos decimales', async () => {
      const findOwnerPage = vi.fn().mockResolvedValue({
        properties: [{ id: propertyId, status: PropertyStatus.PAUSED, pricePerDay: { toFixed: () => '45.00' } }],
        total: 13,
      });
      const service = new PropertiesService({ findOwnerPage } as never, {} as never);

      const result = await service.listMine(ownerId, 2);

      expect(findOwnerPage).toHaveBeenCalledWith(ownerId, 2);
      expect(result).toMatchObject({ data: [{ id: propertyId, status: PropertyStatus.PAUSED, pricePerDay: '45.00' }], total: 13, page: 2, pageSize: 12 });
    });

    it('permite al OWNER consultar el detalle de una publicación propia para editarla', async () => {
      const findOwnedById = vi.fn().mockResolvedValue(makeCurrent());
      const service = new PropertiesService({ findOwnedById } as never, {} as never);

      const result = await service.getOwnedDetail(ownerId, propertyId);

      expect(findOwnedById).toHaveBeenCalledWith(ownerId, propertyId);
      expect(result).toMatchObject({ id: propertyId, ownerId });
    });

    it('reemplaza los datos del bien, conserva las fotos elegidas y agrega la nueva foto', async () => {
      const harness = makeEditHarness();
      const dto = makeDto({ imagesToRemove: [firstImage] });

      const result = await harness.service.updateOwned(ownerId, propertyId, dto as never, [makeFile(1)]);

      expect(harness.updateOwned).toHaveBeenCalledWith(
        ownerId,
        propertyId,
        dto,
        [secondImage, 'https://images.example/new-0.jpg'],
        tx,
      );
      expect(result).toMatchObject({ title: dto.title, description: dto.description, images: [secondImage, 'https://images.example/new-0.jpg'] });
      expect(harness.upload).toHaveBeenCalledOnce();
      expect(harness.deleteByUrl).toHaveBeenCalledWith(firstImage);

      const controller = new PropertiesController({
        updateOwned: vi.fn().mockResolvedValue(result),
      } as never);
      const response = await controller.update({ id: ownerId } as never, propertyId, dto as never, [makeFile(1)]);
      expect(response).toMatchObject({
        id: propertyId,
        ownerId,
        title: dto.title,
        pricePerDay: '45.00',
        securityDeposit: '100.00',
        images: [secondImage, 'https://images.example/new-0.jpg'],
      });
    });

    it('acepta publicaciones que conservan una o cinco fotos', async () => {
      for (const { removals, additions, expectedCount } of [
        { removals: [firstImage], additions: 0, expectedCount: 1 },
        { removals: [], additions: 3, expectedCount: 5 },
      ]) {
        const harness = makeEditHarness();
        const files = Array.from({ length: additions }, (_, index) => makeFile(index + 1));
        await harness.service.updateOwned(ownerId, propertyId, makeDto({ imagesToRemove: removals }) as never, files);
        expect(harness.updateOwned.mock.calls[0][3]).toHaveLength(expectedCount);
      }
    });

    it('permite actualizar otros campos si hay reservas activas y precio y depósito no cambian', async () => {
      const harness = makeEditHarness({ activeBookings: 2 });
      const dto = makeDto({ title: 'Casa con descripción actualizada' });

      await harness.service.updateOwned(ownerId, propertyId, dto as never, []);

      expect(harness.countActiveBookings).not.toHaveBeenCalled();
      expect(harness.updateOwned).toHaveBeenCalledOnce();
    });
  });

  describe('casos negativos', () => {
    it('responde 404 al consultar o editar una publicación inexistente o ajena', async () => {
      const getService = new PropertiesService({ findOwnedById: vi.fn().mockResolvedValue(null) } as never, {} as never);
      await expect(getService.getOwnedDetail(ownerId, propertyId)).rejects.toBeInstanceOf(NotFoundException);

      const editHarness = makeEditHarness({ current: null });
      await expect(editHarness.service.updateOwned(ownerId, propertyId, makeDto() as never, []))
        .rejects.toMatchObject({ status: 404 });
      expect(editHarness.updateOwned).not.toHaveBeenCalled();
    });

    it('requiere sesión y rol OWNER para listar, consultar y editar publicaciones propias', async () => {
      for (const handler of [
        PropertiesController.prototype.listMine,
        PropertiesController.prototype.getOwnedDetail,
        PropertiesController.prototype.update,
      ]) {
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.OWNER]);
      }

      const jwtGuard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: vi.fn() } as never,
        { findById: vi.fn() } as never,
      );
      const unauthenticatedContext = {
        getHandler: () => PropertiesController.prototype.update,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(jwtGuard.canActivate(unauthenticatedContext)).rejects.toMatchObject({ status: 401 });

      const rolesGuard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      for (const role of [Role.TENANT, Role.ADMIN]) {
        const context = {
          getHandler: () => PropertiesController.prototype.update,
          getClass: () => PropertiesController,
          switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
        } as never;
        expect(() => rolesGuard.canActivate(context)).toThrow(expect.objectContaining({ status: 403 }));
      }
    });

    it('rechaza campos obligatorios o valores inválidos del reemplazo integral con error 400', async () => {
      const invalidPayloads = [
        {},
        makeDto({ title: '' }),
        makeDto({ pricePerDay: '0.00' }),
        makeDto({ category: 'OTHER' }),
      ];

      for (const payload of invalidPayloads) {
        const dto = plainToInstance(UpdatePropertyRequestDto, payload);
        expect(await validate(dto)).not.toHaveLength(0);
      }
    });

    it('responde 400 cuando la edición deja cero o más de cinco fotos, o intenta quitar una imagen ajena', async () => {
      const zeroPhotos = makeEditHarness();
      await expect(zeroPhotos.service.updateOwned(
        ownerId,
        propertyId,
        makeDto({ imagesToRemove: [firstImage, secondImage] }) as never,
        [],
      )).rejects.toBeInstanceOf(BadRequestException);

      const tooManyPhotos = makeEditHarness();
      await expect(tooManyPhotos.service.updateOwned(
        ownerId,
        propertyId,
        makeDto() as never,
        Array.from({ length: 4 }, (_, index) => makeFile(index)),
      )).rejects.toBeInstanceOf(BadRequestException);

      const foreignImage = makeEditHarness();
      await expect(foreignImage.service.updateOwned(
        ownerId,
        propertyId,
        makeDto({ imagesToRemove: ['https://images.example/other-owner.jpg'] }) as never,
        [],
      )).rejects.toBeInstanceOf(BadRequestException);
    });

    it('responde 409 con el mensaje indicado si cambia el precio con reservas PENDING o PAID', async () => {
      const harness = makeEditHarness({ activeBookings: 1 });
      await expect(harness.service.updateOwned(
        ownerId,
        propertyId,
        makeDto({ pricePerDay: '50.00' }) as never,
        [],
      )).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'PROPERTY_PRICE_CHANGE_BLOCKED',
          message: 'No se puede modificar el precio ni el depósito de un bien con reservas PENDIENTE O PAGADA',
        }),
      });
      expect(harness.updateOwned).not.toHaveBeenCalled();

      const bookingCount = vi.fn().mockResolvedValue(1);
      const repository = new PropertiesRepository({ booking: { count: bookingCount } } as never);
      await repository.countActiveBookings(propertyId);
      expect(bookingCount).toHaveBeenCalledWith({
        where: { propertyId, status: { in: ['PENDING', 'PAID'] } },
      });
    });

    it('responde 409 con el mensaje indicado si cambia el depósito con reservas PENDING o PAID', async () => {
      const harness = makeEditHarness({ activeBookings: 1 });
      await expect(harness.service.updateOwned(
        ownerId,
        propertyId,
        makeDto({ securityDeposit: '150.00' }) as never,
        [],
      )).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: 'PROPERTY_PRICE_CHANGE_BLOCKED',
          message: 'No se puede modificar el precio ni el depósito de un bien con reservas PENDIENTE O PAGADA',
        }),
      });
      expect(harness.updateOwned).not.toHaveBeenCalled();
    });

    it('rechaza con 413 una imagen mayor de 5 MB en la carga PUT', async () => {
      let app: INestApplication | undefined;
      const updateOwned = vi.fn();
      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          controllers: [PropertiesController],
          providers: [{ provide: PropertiesService, useValue: { updateOwned } }],
        }).compile();
        app = moduleFixture.createNestApplication();
        await app.init();

        await request(app.getHttpServer())
          .put(`/properties/${propertyId}`)
          .attach('images', Buffer.alloc(5 * 1024 * 1024 + 1), {
            filename: 'too-large.jpg',
            contentType: 'image/jpeg',
          })
          .expect(413);
        expect(updateOwned).not.toHaveBeenCalled();
      } finally {
        await app?.close();
      }
    });
  });
});
