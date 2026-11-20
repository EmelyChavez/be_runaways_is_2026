import { jest } from '@jest/globals';
import 'reflect-metadata';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
import { IncomeQueryDto } from '../../src/income/dto/income-query.dto.js';
import { IncomeRepository } from '../../src/income/repositories/income.repository.js';
import { IncomeService } from '../../src/income/services/income.service.js';

describe("H24. Visualización de ingresos totales", () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const from = new Date('2026-11-01T00:00:00.000Z');
  const to = new Date('2026-11-30T23:59:59.999Z');
  const incomeRepository = {
    rentalIncome: jest.fn<(...args: any[]) => any>(),
    retainedDepositIncome: jest.fn<(...args: any[]) => any>(),
  };
  let service: IncomeService;

  beforeEach(() => {
    jest.resetAllMocks();
    incomeRepository.rentalIncome.mockResolvedValue({
      _sum: { rentalAmount: new Prisma.Decimal('0.00') },
    });
    incomeRepository.retainedDepositIncome.mockResolvedValue({
      _sum: { retainedAmount: new Prisma.Decimal('0.00') },
    });
    service = new IncomeService(incomeRepository as never);
  });

  it("AC1: suma los alquileres de reservas pagadas y finalizadas con dos decimales", async () => {
    incomeRepository.rentalIncome.mockResolvedValue({
      _sum: { rentalAmount: new Prisma.Decimal('450.00') },
    });

    const result = await service.getReport(ownerId, {});

    expect(result).toMatchObject({
      rentalIncome: '450.00',
      retainedDepositIncome: '0.00',
      totalIncome: '450.00',
    });
  });

  it("AC2: suma retainedAmount de depósitos retenidos total o parcialmente", async () => {
    incomeRepository.retainedDepositIncome.mockResolvedValue({
      _sum: { retainedAmount: new Prisma.Decimal('75.50') },
    });

    const result = await service.getReport(ownerId, {});

    expect(result).toMatchObject({
      rentalIncome: '0.00',
      retainedDepositIncome: '75.50',
      totalIncome: '75.50',
    });
  });

  it("AC3: filtra alquileres por fecha de pago y depósitos por fecha de decisión", async () => {
    const prisma = {
      payment: { aggregate: jest.fn<(...args: any[]) => any>().mockResolvedValue({ _sum: { rentalAmount: null } }) },
      deposit: { aggregate: jest.fn<(...args: any[]) => any>().mockResolvedValue({ _sum: { retainedAmount: null } }) },
    };
    const repository = new IncomeRepository(prisma as never);

    await repository.rentalIncome(ownerId, from, to);
    await repository.retainedDepositIncome(ownerId, from, to);

    expect(prisma.payment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
    }));
    expect(prisma.deposit.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ decidedAt: { gte: from, lte: to, not: null } }),
    }));
  });

  it("AC7: limita ambas consultas a las propiedades del OWNER de sesión", async () => {
    const paymentAggregate = jest.fn<(...args: any[]) => any>().mockResolvedValue({ _sum: { rentalAmount: null } });
    const depositAggregate = jest.fn<(...args: any[]) => any>().mockResolvedValue({ _sum: { retainedAmount: null } });
    const repository = new IncomeRepository({
      payment: { aggregate: paymentAggregate },
      deposit: { aggregate: depositAggregate },
    } as never);

    await repository.rentalIncome(ownerId);
    await repository.retainedDepositIncome(ownerId);

    expect(paymentAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ booking: { status: expect.anything(), property: { ownerId } } }),
    }));
    expect(depositAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ booking: { property: { ownerId } } }),
    }));
  });

  it("AC4: devuelve 0.00 en todos los montos cuando no hay ingresos", async () => {
    const result = await service.getReport(ownerId, {});

    expect(result).toMatchObject({
      from: null,
      to: null,
      rentalIncome: '0.00',
      retainedDepositIncome: '0.00',
      totalIncome: '0.00',
    });
  });

  it("AC7: permite consultar el reporte a un usuario autenticado con rol OWNER", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.OWNER } }) }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("AC5: excluye reservas pendientes o canceladas y depósitos pendientes o devueltos", async () => {
    const paymentAggregate = jest.fn<(...args: any[]) => any>().mockResolvedValue({ _sum: { rentalAmount: null } });
    const depositAggregate = jest.fn<(...args: any[]) => any>().mockResolvedValue({ _sum: { retainedAmount: null } });
    const repository = new IncomeRepository({
      payment: { aggregate: paymentAggregate },
      deposit: { aggregate: depositAggregate },
    } as never);

    await repository.rentalIncome(ownerId);
    await repository.retainedDepositIncome(ownerId);

    expect(paymentAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        booking: expect.objectContaining({
          status: { in: [BookingStatus.PAID, BookingStatus.COMPLETED] },
        }),
      }),
      _sum: { rentalAmount: true },
    }));
    expect(depositAggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        state: { in: [DepositStatus.RETAINED, DepositStatus.PARTIALLY_RETAINED] },
      }),
      _sum: { retainedAmount: true },
    }));
  });

  it("AC6: rechaza fechas ISO inválidas en from o to", async () => {
    for (const value of ['no-es-fecha', '2026-02-30']) {
      for (const field of ['from', 'to']) {
        const dto = plainToInstance(IncomeQueryDto, { [field]: value });
        expect(await validate(dto)).not.toHaveLength(0);
      }
    }
  });

  it("AC6: rechaza una fecha to anterior a from con VALIDATION_ERROR", async () => {
    await expect(service.getReport(ownerId, {
      from: '2026-11-20',
      to: '2026-11-01',
    })).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      },
      status: 400,
    });
    await expect(service.getReport(ownerId, {
      from: '2026-11-20',
      to: '2026-11-01',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("AC7: rechaza una solicitud sin sesión con 401", async () => {
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

  it("AC7: deniega el reporte a TENANT con 403", () => {
    const reflector = { getAllAndOverride: jest.fn<(...args: any[]) => any>().mockReturnValue([Role.OWNER]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    const context = {
      getHandler: jest.fn<(...args: any[]) => any>(),
      getClass: jest.fn<(...args: any[]) => any>(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: ownerId, role: Role.TENANT } }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it("AC7: deniega el reporte a ADMIN con 403", () => {
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
