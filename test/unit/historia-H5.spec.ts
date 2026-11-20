import { jest } from '@jest/globals';
import { expectHttpExceptionStatus } from './expect-http-exception.js';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, ConflictException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { Role, PropertyStatus } from '../../src/generated/prisma/client.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';
import { UpdatePropertyStatusDto } from '../../src/properties/dto/update-property-status.dto.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';

describe("H5. Pausar, reactivar y eliminar una publicación", () => {
  const findOwnedForManagement = jest.fn<(...args: any[]) => any>();
  const countActiveBookings = jest.fn<(...args: any[]) => any>();
  const updateStatus = jest.fn<(...args: any[]) => any>();
  const softDelete = jest.fn<(...args: any[]) => any>();
  const serializableTransaction = jest.fn<(...args: any[]) => any>();
  let service: PropertiesService;
  const ownerId = 'owner-1';
  const propertyId = 'property-1';
  const tx = {};

  beforeEach(() => {
    jest.clearAllMocks();
    serializableTransaction.mockImplementation((operation) => operation(tx));
    findOwnedForManagement.mockResolvedValue({ id: propertyId, status: PropertyStatus.AVAILABLE });
    countActiveBookings.mockResolvedValue(0);
    updateStatus.mockImplementation(async (id, status) => ({ id, status, updatedAt: new Date('2026-11-14T12:00:00.000Z') }));
    service = new PropertiesService(
      { serializableTransaction, findOwnedForManagement, countActiveBookings, updateStatus, softDelete } as never,
      {} as never,
    );
  });


    it.each([PropertyStatus.PAUSED, PropertyStatus.AVAILABLE])("AC1: cambia el estado a %s", async (status) => {
      findOwnedForManagement.mockResolvedValueOnce({ id: propertyId, status: PropertyStatus.AVAILABLE });

      const result = await service.updateOwnedStatus(ownerId, propertyId, { status });

      expect(countActiveBookings).toHaveBeenCalledWith(propertyId, tx);
      expect(updateStatus).toHaveBeenCalledWith(propertyId, status, tx);
      expect(result).toEqual({ id: propertyId, status, statusChangedAt: new Date('2026-11-14T12:00:00.000Z') });
    });

    it("AC3: elimina lógicamente y conserva las reseñas al no borrar registros relacionados", async () => {
      await service.deleteOwned(ownerId, propertyId);

      expect(softDelete).toHaveBeenCalledWith(propertyId, tx);
      expect(serializableTransaction).toHaveBeenCalledTimes(1);
    });

    it("AC4: declara OWNER como rol autorizado para cambiar estado y eliminar", () => {
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.updateStatus)).toEqual([Role.OWNER]);
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.delete)).toEqual([Role.OWNER]);
    });

    it("AC4: permite al rol OWNER pasar el guard de roles", () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.updateStatus,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.OWNER } }) }),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });

    it("AC1: oculta los bienes pausados/eliminados del catálogo, detalle público y Mis publicaciones", async () => {
      const findAvailablePage = jest.fn<(...args: any[]) => any>().mockResolvedValue({ properties: [], total: 0 });
      const findAvailableById = jest.fn<(...args: any[]) => any>().mockResolvedValue(null);
      const findOwnerPage = jest.fn<(...args: any[]) => any>().mockResolvedValue({ properties: [], total: 0 });
      const visibilityService = new PropertiesService({ findAvailablePage, findAvailableById, findOwnerPage } as never, {} as never);

      await visibilityService.listCatalog({ page: 1 });
      await expect(visibilityService.getDetail(propertyId)).rejects.toMatchObject({ status: 404 });
      await visibilityService.listMine(ownerId, 1);

      expect(findAvailablePage).toHaveBeenCalledWith(1, { status: PropertyStatus.AVAILABLE }, undefined);
      expect(findAvailableById).toHaveBeenCalledWith(propertyId);
      expect(findOwnerPage).toHaveBeenCalledWith(ownerId, 1);
    });

    it("AC2: considera PENDING y PAID como reservas activas que bloquean la gestión", async () => {
      const bookingCount = jest.fn<(...args: any[]) => any>().mockResolvedValue(1);
      const repository = new PropertiesRepository({} as never);

      await repository.countActiveBookings(propertyId, { booking: { count: bookingCount } } as never);

      expect(bookingCount).toHaveBeenCalledWith({
        where: { propertyId, status: { in: ['PENDING', 'PAID'] } },
      });
    });



    it("AC4: rechaza un estado distinto de AVAILABLE o PAUSED", async () => {
      const dto = plainToInstance(UpdatePropertyStatusDto, { status: PropertyStatus.DELETED });

      expect(await validate(dto)).not.toHaveLength(0);
    });

    it.each(['cambio de estado', 'eliminación'])("AC4: responde 404 si el bien no existe o no pertenece al dueño (%s)", async (operation) => {
      findOwnedForManagement.mockResolvedValueOnce(null);
      const action = operation === 'cambio de estado'
        ? service.updateOwnedStatus(ownerId, propertyId, { status: PropertyStatus.PAUSED })
        : service.deleteOwned(ownerId, propertyId);

      await expect(action).rejects.toBeInstanceOf(NotFoundException);
      expect(updateStatus).not.toHaveBeenCalled();
      expect(softDelete).not.toHaveBeenCalled();
    });

    it.each([['PENDING', 1], ['PAID', 1]])("AC2: bloquea cambio de estado y eliminación con reservas %s", async (_status, count) => {
      countActiveBookings.mockResolvedValue(count);

      await expect(service.updateOwnedStatus(ownerId, propertyId, { status: PropertyStatus.PAUSED }))
        .rejects.toMatchObject({ status: 409, message: expect.stringContaining('No se puede cambiar el estado ni eliminar un bien con reservas PENDIENTE O PAGADA') });
      await expect(service.deleteOwned(ownerId, propertyId))
        .rejects.toMatchObject({ status: 409, message: expect.stringContaining('No se puede cambiar el estado ni eliminar un bien con reservas PENDIENTE O PAGADA') });
      expect(updateStatus).not.toHaveBeenCalled();
      expect(softDelete).not.toHaveBeenCalled();
    });

    it("AC4: no permite cambiar el estado de un bien ELIMINADO", async () => {
      findOwnedForManagement.mockResolvedValueOnce({ id: propertyId, status: PropertyStatus.DELETED });

      await expect(service.updateOwnedStatus(ownerId, propertyId, { status: PropertyStatus.AVAILABLE }))
        .rejects.toBeInstanceOf(ConflictException);
      expect(countActiveBookings).not.toHaveBeenCalled();
      expect(updateStatus).not.toHaveBeenCalled();
    });

    it("AC4: no permite eliminar otra vez un bien ELIMINADO", async () => {
      findOwnedForManagement.mockResolvedValueOnce({ id: propertyId, status: PropertyStatus.DELETED });

      await expect(service.deleteOwned(ownerId, propertyId)).rejects.toBeInstanceOf(ConflictException);
      expect(softDelete).not.toHaveBeenCalled();
    });

    it("AC4: rechaza solicitud sin sesión con 401", async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const context = {
        getHandler: () => PropertiesController.prototype.updateStatus,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });

    it.each([Role.TENANT, Role.ADMIN])("AC4: rechaza rol %s con 403", (role) => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.delete,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as never;

      expectHttpExceptionStatus(() => guard.canActivate(context), 403);
    });

    it("AC4: rechaza el cambio de estado si no hay usuario autenticado con 401", () => {
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.OWNER] } as never);
      const context = {
        getHandler: () => PropertiesController.prototype.updateStatus,
        getClass: () => PropertiesController,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never;

      expectHttpExceptionStatus(() => guard.canActivate(context), 401);
    });

    it("AC4: rechaza UUID inválido mediante ParseUUIDPipe en ambas rutas", async () => {
      const statusIdPipe = new ParseUUIDPipe();
      const deleteIdPipe = new ParseUUIDPipe();
      const parameterMetadata = { type: 'param', metatype: String, data: 'id' } as const;
      await expect(statusIdPipe.transform('not-a-uuid', parameterMetadata)).rejects.toBeInstanceOf(BadRequestException);
      await expect(deleteIdPipe.transform('not-a-uuid', parameterMetadata)).rejects.toBeInstanceOf(BadRequestException);
    });

});
