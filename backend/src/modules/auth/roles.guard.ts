import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('Access denied');

    // Normalise role for comparison: 'Practice Head' → 'practice-head'
    const userRoleNorm = user.role.toLowerCase().replace(/\s+/g, '-');
    const hasRole = requiredRoles.some((r) => r.toLowerCase() === userRoleNorm);
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
