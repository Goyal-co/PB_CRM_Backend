import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { CurrentUser, UserRole } from '@common/types/user.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndMerge<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: CurrentUser }).user;
    if (!user) {
      throw new ForbiddenException({
        message: 'User context missing',
        error: 'FORBIDDEN',
      });
    }

    if (user.role === 'super_admin') {
      return true;
    }

    const allowed = new Set<UserRole>(required);
    if (allowed.has(user.role)) {
      return true;
    }

    throw new ForbiddenException({
      message: 'Insufficient role',
      error: 'FORBIDDEN',
    });
  }
}
