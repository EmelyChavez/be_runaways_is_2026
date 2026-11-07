import { SetMetadata } from '@nestjs/common';
import type { Role } from '@PrismaClient';

export const ROLES_KEY = 'roles';

/** Declara qué roles pueden acceder a un controlador o método. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
