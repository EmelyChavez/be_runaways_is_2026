import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@PrismaClient';
import type { RequestWithUser } from '@Auth/decorators';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Comprueba los roles declarados con @Roles() después de validar el JWT. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles === undefined) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Falta una sesión válida.');
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para realizar esta acción.',
      });
    }

    return true;
  }
}
