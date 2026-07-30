import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY, PermissionRequirement } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';

/**
 * Global authorization guard. Runs after the global JwtAuthGuard (which
 * populates request.user). Routes annotated with @RequirePermission are checked
 * against the DB-driven permission matrix via PermissionsService; unannotated
 * routes are allowed through (they remain authenticated-only).
 *
 * Fails closed: if a route requires a permission but no authenticated user is
 * present on the request, access is denied.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.sub;
    if (!userId) throw new ForbiddenException('Authentication required');

    const allowed = await this.permissions.can(userId, requirement.module, requirement.permission);
    if (!allowed) {
      throw new ForbiddenException(
        `You do not have permission to ${requirement.permission} ${requirement.module}.`,
      );
    }
    return true;
  }
}
