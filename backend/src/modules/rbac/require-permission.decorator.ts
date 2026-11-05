import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/** A single (module, permission) requirement attached to a route handler. */
export interface PermissionRequirement {
  module: string;
  permission: string;
}

/**
 * Declares the RBAC permission(s) a route requires. The global PermissionsGuard
 * reads this metadata and calls PermissionsService.can(user, module, permission).
 *
 * Routes without this decorator are not permission-gated (they remain protected
 * by the global JwtAuthGuard — authentication only).
 *
 * Usage:
 *   @RequirePermission('accounts', 'delete')
 *   @RequirePermissions(
 *     { module: 'stakeholder-connects', permission: 'update' },
 *     { module: 'action-items', permission: 'create' },
 *   )
 */
export function RequirePermission(module: string, permission: string): any;
export function RequirePermission(requirements: PermissionRequirement[]): any;
export function RequirePermission(
  moduleOrRequirements: string | PermissionRequirement[],
  permission?: string,
): any {
  if (Array.isArray(moduleOrRequirements)) {
    return SetMetadata(REQUIRE_PERMISSION_KEY, moduleOrRequirements);
  }
  return SetMetadata(REQUIRE_PERMISSION_KEY, {
    module: moduleOrRequirements,
    permission: permission!,
  } as PermissionRequirement);
}

export const RequirePermissions = (...requirements: PermissionRequirement[]): any =>
  SetMetadata(REQUIRE_PERMISSION_KEY, requirements);
