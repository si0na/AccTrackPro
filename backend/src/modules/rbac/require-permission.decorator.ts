import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/** A single (module, permission) requirement attached to a route handler. */
export interface PermissionRequirement {
  module: string;
  permission: string;
}

/**
 * Declares the RBAC permission a route requires. The global PermissionsGuard
 * reads this metadata and calls PermissionsService.can(user, module, permission).
 *
 * Routes without this decorator are not permission-gated (they remain protected
 * by the global JwtAuthGuard — authentication only).
 *
 * Usage:
 *   @RequirePermission('accounts', 'delete')
 *   @Delete(':id')
 *   remove(...) { ... }
 */
export const RequirePermission = (module: string, permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { module, permission } as PermissionRequirement);
