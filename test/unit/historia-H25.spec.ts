import { jest } from '@jest/globals';
import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import {
  BookingStatus,
  DepositStatus,
  Prisma,
  Role,
} from '../../src/generated/prisma/client.js';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { IncomeByPropertyQueryDto } from '../../src/income/dto/income-by-property-query.dto.js';
import { IncomeRepository } from '../../src/income/repositories/income.repository.js';
import { IncomeService } from '../../src/income/services/income.service.js';

describe("H25. Visualización de ingresos por bien publicado", () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const propertyOneId = '22222222-2222-4222-8222-222222222222';
  const propertyTwoId = '33333333-3333-4333-8333-333333333333';
  const propertyThreeId = '44444444-4444-4444-8444-444444444444';
  const incomeRepository = { incomeByProperty: jest.fn<(...args: any[]) => any>() };
  const prisma = {
    property: { findMany: jest.fn<(...args: any[]) => any>() },
    payment: { findMany: jest.fn<(...args: any[]) => any>() },
    deposit: { findMany: jest.fn<(...args: any[]) => any>() },
  };
  let service: IncomeService;

  const property = (id: string, title: string) => ({
    id,
    title,
    category: 'PROPERTY',
  });

  const payment = (propertyId: string, amount: string) => ({
    rentalAmount: new Prisma.Decimal(amount),
    booking: { propertyId },
  });

  const deposit = (propertyId: string, amount: string) => ({
    retainedAmount: new Prisma.Decimal(amount),
    booking: { propertyId },
  });

  const query = (overrides: Partial<IncomeByPropertyQueryDto> = {}) => ({
    ...new IncomeByPropertyQueryDto(),
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    incomeRepository.incomeByProperty.mockResolvedValue({
      properties: [],
      payments: [],
      deposits: [],
    });
    prisma.property.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.deposit.findMany.mockResolvedValue([]);
    service = new IncomeService(incomeRepository as never);
  });

  it("AC1: muestra cada bien del arrendador con sus ingresos o 0.00", async () => {
    incomeRepository.incomeByProperty.mockResolvedValue({
      properties: [property(propertyOneId, 'Casa de playa'), property(propertyTwoId, 'Taladro')],
      payments: [payment(propertyOneId, '150.00')],
      deposits: [deposit(propertyOneId, '75.00')],
    });

    const result = await service.getReportByProperty(ownerId, query());

    expect(result.data).toEqual([
      {
        propertyId: propertyOneId,
        title: 'Casa de playa',
        category: 'PROPERTY',
        rentalIncome: '150.00',
        retainedDepositIncome: '75.00',
        totalIncome: '225.00',
      },
      {
        propertyId: propertyTwoId,
        title: 'Taladro',
        category: 'PROPERTY',
        rentalIncome: '0.00',
        retainedDepositIncome: '0.00',
        totalIncome: '0.00',
      },
    ]);
    expect(result).toMatchObject({ rentalIncome: '150.00', retainedDepositIncome: '75.00', totalIncome: '225.00' });
  });

  it("AC2: ordena los bienes de mayor a menor ingreso con order=desc", async () => {
    incomeRepository.incomeByProperty.mockResolvedValue({
      properties: [
        property(propertyOneId, 'Bien medio'),
        property(propertyTwoId, 'Bien alto'),
        property(propertyThreeId, 'Bien bajo'),
      ],
      payments: [
        payment(propertyOneId, '100.00'),
        payment(propertyTwoId, '300.00'),
        payment(propertyThreeId, '25.00'),
      ],
      deposits: [],
    });

    const result = await service.getReportByProperty(ownerId, query({ order: 'desc' }));

    expect(result.data.map((item) => item.propertyId)).toEqual([
      propertyTwoId,
      propertyOneId,
      propertyThreeId,
    ]);
  });

  it("AC2: ordena los bienes de menor a mayor ingreso con order=asc", async () => {
    incomeRepository.incomeByProperty.mockResolvedValue({
      properties: [
        property(propertyOneId, 'Bien medio'),
        property(propertyTwoId, 'Bien alto'),
        property(propertyThreeId, 'Bien bajo'),
      ],
      payments: [
        payment(propertyOneId, '100.00'),
        payment(propertyTwoId, '300.00'),
        payment(propertyThreeId, '25.00'),
      ],
      deposits: [],
    });

    const result = await service.getReportByProperty(ownerId, query({ order: 'asc' }));

    expect(result.data.map((item) => item.propertyId)).toEqual([
      propertyThreeId,
      propertyOneId,
      propertyTwoId,
    ]);
  });

  it("AC3: limita propiedades, pagos y depósitos al arrendador autenticado", async () => {
    const repository = new IncomeRepository(prisma as never);

    await repository.incomeByProperty(ownerId);

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: { ownerId },
      select: { id: true, title: true, category: true },
    });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        booking: expect.objectContaining({ property: { ownerId } }),
      }),
    }));
    expect(prisma.deposit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        booking: { property: { ownerId } },
      }),
    }));
  });

  it("AC3: filtra pagos por createdAt y depósitos por decidedAt", async () => {
    const from = new Date('2026-11-01T00:00:00.000Z');
    const to = new Date('2026-11-30T23:59:59.999Z');
    const repository = new IncomeRepository(prisma as never);

    await repository.incomeByProperty(ownerId, from, to);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
    }));
    expect(prisma.deposit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ decidedAt: { gte: from, lte: to, not: null } }),
    }));
  });

  it("AC1: pagina la lista y conserva los totales de todas las propiedades", async () => {
    incomeRepository.incomeByProperty.mockResolvedValue({
      properties: [
        property(propertyOneId, 'Primera'),
        property(propertyTwoId, 'Segunda'),
        property(propertyThreeId, 'Tercera'),
      ],
      payments: [
        payment(propertyOneId, '300.00'),
        payment(propertyTwoId, '200.00'),
        payment(propertyThreeId, '100.00'),
      ],
      deposits: [],
    });

    const result = await service.getReportByProperty(
      ownerId,
      query({ page: 2, pageSize: 1 }),
    );

    expect(result.data.map((item) => item.propertyId)).toEqual([propertyTwoId]);
    expect(result).toMatchObject({
      rentalIncome: '600.00',
      totalIncome: '600.00',
      total: 3,
      page: 2,
      pageSize: 1,
    });
  });

  it("AC3: permite consultar el reporte al rol OWNER", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.OWNER } }) }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("AC4: excluye reservas canceladas de los pagos que consulta", async () => {
    const repository = new IncomeRepository(prisma as never);

    await repository.incomeByProperty(ownerId);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        booking: expect.objectContaining({
          status: { in: [BookingStatus.PAID, BookingStatus.COMPLETED] },
        }),
      }),
    }));
    expect(prisma.payment.findMany.mock.calls[0][0].where.booking.status.in).not.toContain(
      BookingStatus.CANCELED,
    );
  });

  it("AC2: rechaza order, page y pageSize inválidos", async () => {
    for (const invalidQuery of [
      { order: 'popular' },
      { page: 0 },
      { pageSize: 101 },
    ]) {
      const dto = plainToInstance(IncomeByPropertyQueryDto, invalidQuery);
      expect(await validate(dto)).not.toHaveLength(0);
    }
  });

  it("AC3: rechaza la consulta sin sesión con 401", async () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue(false) };
    const guard = new JwtAuthGuard(
      reflector as never,
      { verifyAsync: jest.fn<(...args: any[]) => any>() } as never,
      { findById: jest.fn<(...args: any[]) => any>() } as never,
    );
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("AC3: deniega el reporte a TENANT con 403", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.TENANT } }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it("AC3: deniega el reporte a ADMIN con 403", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.ADMIN } }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });
});
