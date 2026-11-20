import { jest } from '@jest/globals';
import { expectHttpExceptionStatus } from './expect-http-exception.js';
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { BookingStatus, Prisma, Role } from '../../src/generated/prisma/client.js';
import { BookingsController } from '../../src/bookings/controllers/bookings.controller.js';
import { CreateBookingDto } from '../../src/bookings/dto/create-booking.dto.js';
import { BookingsService } from '../../src/bookings/services/bookings.service.js';
import { CreatePaymentDto } from '../../src/payments/dto/create-payment.dto.js';
import { PaymentsController } from '../../src/payments/controllers/payments.controller.js';
import { PaymentsService } from '../../src/payments/services/payments.service.js';
import { CreatePropertyRequestDto } from '../../src/properties/dto/create-property.dto.js';
import { PropertiesRepository } from '../../src/properties/repositories/properties.repository.js';
import { PropertiesService } from '../../src/properties/services/properties.service.js';
import { PropertiesController } from '../../src/properties/controllers/properties.controller.js';

describe("H21. Rentar solo a usuarios verificados", () => {
  const tenantId = 'e75428ba-0c10-4d31-b97b-f4a1b563983e';
  const ownerId = '793c1ac3-d3cf-4cf3-97b5-73958318a5eb';
  const propertyId = '1d4f3fa0-bb7d-4c31-9b19-87324a78e114';
  const bookingId = '19be8fb4-81e2-4c84-9ad9-65524817b5ea';
  const tx = {};

  
    it("AC1: expone verifiedOnly true en el detalle para indicar el requisito de cuenta verificada", async () => {
      const property = {
        id: propertyId,
        title: 'Casa de campo',
        description: 'Casa amplia y equipada para disfrutar en familia.',
        category: 'PROPERTY',
        department: 'La Libertad',
        municipality: 'Santa Tecla',
        pricePerDay: new Prisma.Decimal('45.00'),
        securityDeposit: new Prisma.Decimal('100.00'),
        verifiedOnly: true,
        images: [],
        owner: { id: ownerId, name: 'Ana Pérez' },
      };
      const service = new PropertiesService({
        findAvailableById: jest.fn<(...args: any[]) => any>().mockResolvedValue(property),
        findPropertyRating: jest.fn<(...args: any[]) => any>().mockResolvedValue({ _avg: { propertyRating: null }, _count: { _all: 0 } }),
        findUserRating: jest.fn<(...args: any[]) => any>().mockResolvedValue({ _avg: { userRating: null }, _count: { _all: 0 } }),
        findPropertyReviews: jest.fn<(...args: any[]) => any>().mockResolvedValue([]),
      } as never, {} as never);

      const result = await service.getDetail(propertyId);

      expect(result.verifiedOnly).toBe(true);
      expect(result.id).toBe(propertyId);
    });

    it("AC2: permite a un TENANT no verificado consultar catálogo, detalle y disponibilidad", async () => {
      const property = {
        id: propertyId,
        title: 'Casa de campo',
        description: 'Casa amplia y equipada para disfrutar en familia.',
        category: 'PROPERTY',
        department: 'La Libertad',
        municipality: 'Santa Tecla',
        pricePerDay: new Prisma.Decimal('45.00'),
        securityDeposit: new Prisma.Decimal('100.00'),
        verifiedOnly: true,
        images: [],
        owner: { id: ownerId, name: 'Ana Pérez' },
      };
      const repository = {
        findAvailablePage: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          properties: [{ id: propertyId, title: 'Casa de campo', pricePerDay: new Prisma.Decimal('45.00') }],
          total: 1,
        }),
        findAvailableById: jest.fn<(...args: any[]) => any>().mockResolvedValue(property),
        findPropertyRating: jest.fn<(...args: any[]) => any>().mockResolvedValue({ _avg: { propertyRating: null }, _count: { _all: 0 } }),
        findUserRating: jest.fn<(...args: any[]) => any>().mockResolvedValue({ _avg: { userRating: null }, _count: { _all: 0 } }),
        findPropertyReviews: jest.fn<(...args: any[]) => any>().mockResolvedValue([]),
        findAvailabilityProperty: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: propertyId }),
        findOccupiedRanges: jest.fn<(...args: any[]) => any>().mockResolvedValue([]),
      };
      const service = new PropertiesService(repository as never, {} as never);
      const query = { page: 1 } as never;
      const catalog = await service.listCatalog(query);
      const detail = await service.getDetail(propertyId);
      const availability = await service.getAvailability(propertyId, tenantId, Role.TENANT);

      expect(catalog.data).toHaveLength(1);
      expect(detail.verifiedOnly).toBe(true);
      expect(availability.propertyId).toBe(propertyId);
      expect(repository.findAvailabilityProperty).toHaveBeenCalledWith(propertyId, undefined);
    });

    it("AC3: crea reserva PENDING al verificar Profile.isVerified del TENANT de sesión", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
      const findVerifiedProfile = jest.fn<(...args: any[]) => any>().mockResolvedValue({ isVerified: true });
      const createPendingBooking = jest.fn<(...args: any[]) => any>().mockResolvedValue({
        id: bookingId,
        propertyId,
        tenantId,
        startDate: new Date('2026-11-20T00:00:00.000Z'),
        endDate: new Date('2026-11-20T00:00:00.000Z'),
        subtotal: new Prisma.Decimal('45.00'),
        status: BookingStatus.PENDING,
        expiresAt: new Date('2026-11-17T18:00:00.000Z'),
      });
      const service = new BookingsService({
        serializableTransaction: jest.fn<(operation: (transaction: typeof tx) => Promise<any>) => Promise<any>>((operation) => operation(tx)),
        findVerifiedProfile,
        findAvailableProperty: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          id: propertyId,
          ownerId,
          title: 'Casa de campo',
          pricePerDay: new Prisma.Decimal('45.00'),
          securityDeposit: new Prisma.Decimal('100.00'),
        }),
        findOverlappingActiveBooking: jest.fn<(...args: any[]) => any>().mockResolvedValue(null),
        findOverlappingBlock: jest.fn<(...args: any[]) => any>().mockResolvedValue(null),
        createPendingBooking,
      } as never, { emit: jest.fn<(...args: any[]) => any>().mockResolvedValue({}) } as never);

      try {
        const result = await service.create(tenantId, {
          propertyId,
          startDate: '2026-11-20',
          endDate: '2026-11-20',
        });

        expect(result.status).toBe(BookingStatus.PENDING);
        expect(findVerifiedProfile).toHaveBeenCalledWith(tenantId, tx);
        expect(createPendingBooking).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC5: permite pagar a un TENANT verificado aunque el bien tuviera verifiedOnly desactivado", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
      const findBookingForPayment = jest.fn<(...args: any[]) => any>()
        .mockResolvedValueOnce(makePaymentBooking({ verifiedOnly: false }))
        .mockResolvedValueOnce(makePaymentBooking({ verifiedOnly: false }));
      const markBookingPaid = jest.fn<(...args: any[]) => any>().mockResolvedValue({ count: 1 });
      const service = new PaymentsService({
        serializableTransaction: jest.fn<(operation: (transaction: typeof tx) => Promise<any>) => Promise<any>>((operation) => operation(tx)),
        findBookingForPayment,
        markBookingPaid,
        createPayment: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          receiptNumber: 'PAY-TEST',
          last4Digits: '4242',
          createdAt: new Date('2026-11-16T18:00:02.000Z'),
        }),
        createDeposit: jest.fn<(...args: any[]) => any>().mockResolvedValue({}),
        createChargeHistory: jest.fn<(...args: any[]) => any>().mockResolvedValue({}),
      } as never, { emit: jest.fn<(...args: any[]) => any>().mockResolvedValue({}) } as never);

      try {
        const payment = service.pay(tenantId, { bookingId, last4Digits: '4242' });
        await jest.advanceTimersByTimeAsync(2_000);
        await expect(payment).resolves.toMatchObject({ bookingId });
        expect(markBookingPaid).toHaveBeenCalledWith(bookingId, tenantId, expect.any(Date), tx);
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC5: fuerza verifiedOnly true al crear y actualizar cualquier bien", async () => {
      const create = jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: propertyId });
      const update = jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: propertyId });
      const repository = new PropertiesRepository({
        property: { create, update },
      } as never);
      const data = {
        title: 'Casa de campo',
        description: 'Casa amplia y equipada para disfrutar en familia.',
        category: 'PROPERTY',
        department: 'La Libertad',
        municipality: 'Santa Tecla',
        address: 'Centro',
        pricePerDay: '45.00',
        securityDeposit: '100.00',
      } as never;

      await repository.create(ownerId, data, []);
      await repository.updateOwned(ownerId, propertyId, data, [], { property: { update } } as never);

      expect(create.mock.calls[0][0].data.verifiedOnly).toBe(true);
      expect(update.mock.calls[0][0].data.verifiedOnly).toBe(true);
    });
  

  
    it("AC4: rechaza la reserva no verificada con el error exacto y no crea registros", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
      const createPendingBooking = jest.fn<(...args: any[]) => any>();
      const service = new BookingsService({
        serializableTransaction: jest.fn<(operation: (transaction: typeof tx) => Promise<any>) => Promise<any>>((operation) => operation(tx)),
        findVerifiedProfile: jest.fn<(...args: any[]) => any>().mockResolvedValue({ isVerified: false }),
        findAvailableProperty: jest.fn<(...args: any[]) => any>().mockResolvedValue({ id: propertyId, ownerId, title: 'Casa', pricePerDay: new Prisma.Decimal('45.00') }),
        findOverlappingActiveBooking: jest.fn<(...args: any[]) => any>(),
        findOverlappingBlock: jest.fn<(...args: any[]) => any>(),
        createPendingBooking,
      } as never, { emit: jest.fn<(...args: any[]) => any>() } as never);

      try {
        await expect(service.create(tenantId, {
          propertyId,
          startDate: '2026-11-20',
          endDate: '2026-11-20',
        })).rejects.toMatchObject({
          status: 403,
          response: {
            code: 'VERIFICATION_REQUIRED',
            message: 'Debes verificar tu cuenta para rentar.',
          },
        });
        expect(createPendingBooking).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC6: rechaza la reserva cuando el usuario de sesión no tiene perfil verificado", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
      const findVerifiedProfile = jest.fn<(...args: any[]) => any>().mockResolvedValue(null);
      const createPendingBooking = jest.fn<(...args: any[]) => any>();
      const service = new BookingsService({
        serializableTransaction: jest.fn<(operation: (transaction: typeof tx) => Promise<any>) => Promise<any>>((operation) => operation(tx)),
        findVerifiedProfile,
        findAvailableProperty: jest.fn<(...args: any[]) => any>().mockResolvedValue({
          id: propertyId,
          ownerId,
          title: 'Casa de campo',
          pricePerDay: new Prisma.Decimal('45.00'),
        }),
        createPendingBooking,
      } as never, { emit: jest.fn<(...args: any[]) => any>() } as never);

      try {
        await expect(service.create(tenantId, {
          propertyId,
          startDate: '2026-11-20',
          endDate: '2026-11-20',
        })).rejects.toMatchObject({ status: 403, response: { code: 'VERIFICATION_REQUIRED' } });
        expect(findVerifiedProfile).toHaveBeenCalledWith(tenantId, tx);
        expect(createPendingBooking).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC4: impide pagar y registrar movimientos si el perfil de la reserva no está verificado", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
      const findBookingForPayment = jest.fn<(...args: any[]) => any>().mockResolvedValue(makePaymentBooking({
        verified: false,
        verifiedOnly: false,
      }));
      const serializableTransaction = jest.fn<(...args: any[]) => any>();
      const markBookingPaid = jest.fn<(...args: any[]) => any>();
      const createPayment = jest.fn<(...args: any[]) => any>();
      const createDeposit = jest.fn<(...args: any[]) => any>();
      const createChargeHistory = jest.fn<(...args: any[]) => any>();
      const service = new PaymentsService({
        serializableTransaction,
        findBookingForPayment,
        markBookingPaid,
        createPayment,
        createDeposit,
        createChargeHistory,
      } as never, { emit: jest.fn<(...args: any[]) => any>() } as never);

      try {
        await expect(service.pay(tenantId, { bookingId, last4Digits: '4242' })).rejects.toMatchObject({
          status: 403,
          response: {
            code: 'VERIFICATION_REQUIRED',
            message: 'Debes verificar tu cuenta para rentar.',
          },
        });
        expect(serializableTransaction).not.toHaveBeenCalled();
        expect(markBookingPaid).not.toHaveBeenCalled();
        expect(createPayment).not.toHaveBeenCalled();
        expect(createDeposit).not.toHaveBeenCalled();
        expect(createChargeHistory).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC6: vuelve a validar la cuenta dentro de la transacción antes de marcar pagada", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
      const findBookingForPayment = jest.fn<(...args: any[]) => any>()
        .mockResolvedValueOnce(makePaymentBooking({ verified: true }))
        .mockResolvedValueOnce(makePaymentBooking({ verified: false }));
      const markBookingPaid = jest.fn<(...args: any[]) => any>();
      const service = new PaymentsService({
        serializableTransaction: jest.fn<(operation: (transaction: typeof tx) => Promise<any>) => Promise<any>>((operation) => operation(tx)),
        findBookingForPayment,
        markBookingPaid,
      } as never, { emit: jest.fn<(...args: any[]) => any>() } as never);

      try {
        const payment = service.pay(tenantId, { bookingId, last4Digits: '4242' });
        const rejection = expect(payment).rejects.toMatchObject({
          status: 403,
          response: { code: 'VERIFICATION_REQUIRED' },
        });
        await jest.advanceTimersByTimeAsync(2_000);
        await rejection;
        expect(findBookingForPayment).toHaveBeenCalledTimes(2);
        expect(markBookingPaid).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("AC6: rechaza datos de verificación enviados en DTOs de reserva, pago y publicación", async () => {
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
      const bodies = [
        { type: 'body', metatype: CreateBookingDto, data: '', value: { propertyId, startDate: '2026-11-20', endDate: '2026-11-20', isVerified: true } },
        { type: 'body', metatype: CreatePaymentDto, data: '', value: { bookingId, last4Digits: '4242', isVerified: true } },
        { type: 'body', metatype: CreatePropertyRequestDto, data: '', value: { verifiedOnly: false } },
      ];

      for (const body of bodies) {
        await expect(pipe.transform(body.value, { type: body.type as 'body', metatype: body.metatype, data: body.data })).rejects.toBeInstanceOf(BadRequestException);
      }
      const bookingDto = plainToInstance(CreateBookingDto, { propertyId, startDate: '2026-11-20', endDate: '2026-11-20' });
      expect(await validate(bookingDto)).toHaveLength(0);
    });

    it("AC4: requiere sesión TENANT para reservar y pagar", async () => {
      expect(Reflect.getMetadata(ROLES_KEY, BookingsController.prototype.create)).toEqual([Role.TENANT]);
      expect(Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.pay)).toEqual([Role.TENANT]);
      const guard = new RolesGuard({ getAllAndOverride: () => [Role.TENANT] } as never);
      const context = {
        getHandler: () => BookingsController.prototype.create,
        getClass: () => BookingsController,
        switchToHttp: () => ({ getRequest: () => ({ user: { id: tenantId, role: Role.TENANT } }) }),
      };
      expect(guard.canActivate(context as never)).toBe(true);
      const ownerContext = {
        ...context,
        switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.OWNER } }) }),
      };
      expectHttpExceptionStatus(() => guard.canActivate(ownerContext as never), 403);
      expect(Reflect.getMetadata(ROLES_KEY, PropertiesController.prototype.getDetail)).toEqual([Role.TENANT]);
    });

    it("AC4: devuelve 401 sin sesión para crear la reserva", async () => {
      const guard = new JwtAuthGuard(
        { getAllAndOverride: () => false } as never,
        { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
        { findById: jest.fn<(...args: any[]) => any>() } as never,
      );
      const context = {
        getHandler: () => BookingsController.prototype.create,
        getClass: () => BookingsController,
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    });
  
});

function makePaymentBooking(options: { verified?: boolean; verifiedOnly?: boolean } = {}) {
  const verified = options.verified ?? true;
  return {
    id: '19be8fb4-81e2-4c84-9ad9-65524817b5ea',
    tenantId: 'e75428ba-0c10-4d31-b97b-f4a1b563983e',
    startDate: new Date('2026-11-20T00:00:00.000Z'),
    endDate: new Date('2026-11-20T00:00:00.000Z'),
    subtotal: new Prisma.Decimal('45.00'),
    status: BookingStatus.PENDING,
    expiresAt: new Date('2026-11-17T18:00:00.000Z'),
    tenant: { profile: { isVerified: verified } },
    property: {
      id: '1d4f3fa0-bb7d-4c31-9b19-87324a78e114',
      title: 'Casa de campo',
      ownerId: '793c1ac3-d3cf-4cf3-97b5-73958318a5eb',
      pricePerDay: new Prisma.Decimal('45.00'),
      securityDeposit: new Prisma.Decimal('100.00'),
      verifiedOnly: options.verifiedOnly ?? true,
    },
  };
}
