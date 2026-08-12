import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TtlCacheService } from '../../common/services/ttl-cache.service';

/**
 * The resolved authorization context for a user — their role plus the set of
 * permissions their role grants. Cached briefly per user; the cache is busted
 * whenever any role/permission/user-role change occurs, so administrator edits
 * take effect immediately (never waiting for the 15-minute JWT to refresh).
 */
export interface UserAccessContext {
  userId: string;
  /** Primary role (users.role_id) — the JWT display claim / single-role fallback. */
  roleId: string | null;
  roleKey: string | null;
  roleName: string | null;
  /** Keys of EVERY role the user holds (primary + all rows in user_roles). */
  roleKeys: string[];
  /**
   * The primary role's ownership scope column (back-compat convenience). Prefer
   * accountScopeFields for correctness when a user holds multiple roles.
   */
  accountScopeField: string | null;
  /**
   * Every distinct accounts FK column any of the user's roles is ownership-scoped
   * by. A user who is both Account Manager and Practice Lead scopes by both.
   */
  accountScopeFields: string[];
  /** Whether ANY of the user's roles may see every account (accounts:view-all). */
  canViewAllAccounts: boolean;
  /** Granted permissions (union across all roles) as `${module}:${permission}` keys. */
  permissions: Set<string>;
}

export interface MatrixCell {
  roleId: string;
  moduleKey: string;
  permissionKey: string;
  isAllowed: boolean;
  isLocked: boolean;
}

export interface MatrixChange {
  roleId: string;
  moduleKey: string;
  permissionKey: string;
  isAllowed: boolean;
}

// Account FK columns a role may legitimately be scoped by. Guards against a
// crafted account_scope_field ever reaching a SQL identifier position.
const ALLOWED_SCOPE_FIELDS = new Set([
  'account_manager_id',
  'practice_lead_id',
  'client_partner_id',
  'vertical_head_id',
]);

const CTX_TTL_MS = 15_000;
const CACHE_PREFIX = 'rbac:';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: TtlCacheService,
  ) {}

  /** Validated scope field, or null. Callers may interpolate the result directly. */
  static safeScopeField(field: string | null | undefined): string | null {
    return field && ALLOWED_SCOPE_FIELDS.has(field) ? field : null;
  }

  /** Bust all cached authorization state (call after any RBAC mutation). */
  private bust(): void {
    this.cache.invalidatePrefix(CACHE_PREFIX);
  }

  // ─── Authorization reads ───────────────────────────────────────────────────

  async getUserAccessContext(userId: string): Promise<UserAccessContext> {
    return this.cache.getOrSet(`${CACHE_PREFIX}ctx:${userId}`, CTX_TTL_MS, async () => {
      // Primary role (JWT display claim / single-role fallback).
      const { rows: primaryRows } = await this.db.query(
        `SELECT u.role_id, r.key AS role_key, r.name AS role_name, r.account_scope_field
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [userId],
      );
      const primary = primaryRows[0];

      // Every role the user holds. The primary role_id is always guaranteed to be
      // present (backfilled into user_roles by migration 049), but we still merge
      // it in defensively so the context is correct even if the junction row is
      // momentarily missing.
      const { rows: roleRows } = await this.db.query(
        `SELECT r.id, r.key, r.name, r.account_scope_field
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId],
      );

      const roleById = new Map<string, { id: string; key: string; name: string; scope: string | null }>();
      for (const r of roleRows) {
        roleById.set(r.id, { id: r.id, key: r.key, name: r.name, scope: r.account_scope_field ?? null });
      }
      if (primary?.role_id && !roleById.has(primary.role_id)) {
        roleById.set(primary.role_id, {
          id: primary.role_id, key: primary.role_key, name: primary.role_name,
          scope: primary.account_scope_field ?? null,
        });
      }

      const roleIds = [...roleById.keys()];
      const permissions = new Set<string>();
      if (roleIds.length) {
        // Union of every allowed permission across all the user's roles.
        const { rows: perms } = await this.db.query(
          `SELECT DISTINCT module_key, permission_key
           FROM role_permissions
           WHERE role_id = ANY($1) AND is_allowed = TRUE`,
          [roleIds],
        );
        for (const p of perms) {
          permissions.add(`${p.module_key}:${p.permission_key}`);
        }
      }
      const canViewAllAccounts = permissions.has('accounts:view-all');

      const roleKeys = [...roleById.values()].map((r) => r.key).filter(Boolean);
      const accountScopeFields = [
        ...new Set(
          [...roleById.values()]
            .map((r) => PermissionsService.safeScopeField(r.scope))
            .filter((f): f is string => !!f),
        ),
      ];

      return {
        userId,
        roleId: primary?.role_id ?? null,
        roleKey: primary?.role_key ?? null,
        roleName: primary?.role_name ?? null,
        roleKeys,
        accountScopeField: PermissionsService.safeScopeField(primary?.account_scope_field),
        accountScopeFields,
        canViewAllAccounts,
        permissions,
      };
    });
  }

  /** Central permission check — the single authority used by the guard and services. */
  async can(userId: string, moduleKey: string, permissionKey: string): Promise<boolean> {
    const ctx = await this.getUserAccessContext(userId);
    return ctx.permissions.has(`${moduleKey}:${permissionKey}`);
  }

  /**
   * Returns true when the given user holds the role identified by `roleKey`
   * (e.g. `'project-manager'`). Uses the cached access context so no extra
   * DB round-trip is needed on a warm cache.
   */
  async userHasRole(userId: string, roleKey: string): Promise<boolean> {
    const ctx = await this.getUserAccessContext(userId);
    return ctx.roleKeys.includes(roleKey);
  }

  /** The logged-in user's effective permission set — consumed by the SPA. */
  async getMyPermissions(userId: string): Promise<{
    roleKey: string | null;
    roleName: string | null;
    roleKeys: string[];
    accountScopeField: string | null;
    accountScopeFields: string[];
    canViewAllAccounts: boolean;
    permissions: string[];
  }> {
    const ctx = await this.getUserAccessContext(userId);
    return {
      roleKey: ctx.roleKey,
      roleName: ctx.roleName,
      roleKeys: ctx.roleKeys,
      accountScopeField: ctx.accountScopeField,
      accountScopeFields: ctx.accountScopeFields,
      canViewAllAccounts: ctx.canViewAllAccounts,
      permissions: [...ctx.permissions],
    };
  }

  // ─── User ↔ role assignment (multi-role) ─────────────────────────────────────

  /** The full set of role ids a user holds. */
  async getUserRoleIds(userId: string): Promise<string[]> {
    const { rows } = await this.db.query(
      `SELECT role_id FROM user_roles WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r) => r.role_id);
  }

  /**
   * Replace a user's role set with `roleIds` (deduped, validated). The first id
   * becomes the primary role written to users.role_id (JWT display claim); the
   * caller (AdministrationService) keeps the denormalised role text in sync.
   * Runs in one transaction and busts the permission cache so the change takes
   * effect immediately. Returns the primary role id (or null when cleared).
   */
  async setUserRoles(userId: string, roleIds: string[], actorUserId: string): Promise<string | null> {
    const wanted = [...new Set((roleIds ?? []).filter((id) => typeof id === 'string' && id.trim() !== ''))];

    if (wanted.length) {
      const { rows } = await this.db.query(
        `SELECT id FROM roles WHERE id = ANY($1)`,
        [wanted],
      );
      const valid = new Set(rows.map((r) => r.id));
      const missing = wanted.filter((id) => !valid.has(id));
      if (missing.length) throw new NotFoundException(`Unknown role id(s): ${missing.join(', ')}`);
    }

    const primary = wanted[0] ?? null;

    await this.db.withTransaction(async (client) => {
      await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
      for (const roleId of wanted) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [userId, roleId],
        );
      }
      await this.writeAudit(
        client,
        actorUserId,
        `User roles set: ${wanted.length ? `${wanted.length} role(s)` : 'none'}`,
      );
    });

    this.bust();
    return primary;
  }

  // ─── Matrix (admin UI) ───────────────────────────────────────────────────────

  async getMatrix(): Promise<{
    roles: Array<{ id: string; key: string; name: string; isSystem: boolean; accountScopeField: string | null }>;
    modules: Array<{ key: string; name: string; sortOrder: number }>;
    permissions: Array<{ key: string; name: string; sortOrder: number }>;
    cells: MatrixCell[];
  }> {
    const [rolesRes, modulesRes, permsRes, cellsRes] = await Promise.all([
      this.db.query(`SELECT id, key, name, is_system, account_scope_field FROM roles ORDER BY is_system DESC, name ASC`),
      this.db.query(`SELECT key, name, sort_order FROM modules ORDER BY sort_order ASC`),
      this.db.query(`SELECT key, name, sort_order FROM permissions ORDER BY sort_order ASC`),
      this.db.query(`SELECT role_id, module_key, permission_key, is_allowed, is_locked FROM role_permissions`),
    ]);
    return {
      roles: rolesRes.rows.map((r) => ({
        id: r.id, key: r.key, name: r.name, isSystem: r.is_system,
        accountScopeField: r.account_scope_field ?? null,
      })),
      modules: modulesRes.rows.map((m) => ({ key: m.key, name: m.name, sortOrder: m.sort_order })),
      permissions: permsRes.rows.map((p) => ({ key: p.key, name: p.name, sortOrder: p.sort_order })),
      cells: cellsRes.rows.map((c) => ({
        roleId: c.role_id, moduleKey: c.module_key, permissionKey: c.permission_key,
        isAllowed: c.is_allowed, isLocked: c.is_locked,
      })),
    };
  }

  /**
   * Apply matrix changes in one transaction. Locked cells can NEVER be changed —
   * any attempt is rejected (defence-in-depth behind the disabled UI checkbox).
   * Each changed cell is written to the audit feed with old→new values.
   */
  async updateMatrix(changes: MatrixChange[], actorUserId: string): Promise<{ updated: number }> {
    if (!Array.isArray(changes) || changes.length === 0) return { updated: 0 };

    let updated = 0;
    await this.db.withTransaction(async (client) => {
      for (const change of changes) {
        const { rows } = await client.query(
          `SELECT rp.is_allowed, rp.is_locked, r.name AS role_name, m.name AS module_name, p.name AS permission_name
           FROM role_permissions rp
           JOIN roles r ON r.id = rp.role_id
           JOIN modules m ON m.key = rp.module_key
           JOIN permissions p ON p.key = rp.permission_key
           WHERE rp.role_id = $1 AND rp.module_key = $2 AND rp.permission_key = $3`,
          [change.roleId, change.moduleKey, change.permissionKey],
        );
        const existing = rows[0];
        if (!existing) {
          throw new NotFoundException(
            `Permission cell not found (${change.roleId}/${change.moduleKey}/${change.permissionKey})`,
          );
        }
        if (existing.is_locked) {
          throw new ForbiddenException(
            `"${existing.module_name} → ${existing.permission_name}" is locked for role "${existing.role_name}" and cannot be changed.`,
          );
        }
        if (existing.is_allowed === change.isAllowed) continue; // no-op

        await client.query(
          `UPDATE role_permissions SET is_allowed = $1, updated_at = NOW()
           WHERE role_id = $2 AND module_key = $3 AND permission_key = $4`,
          [change.isAllowed, change.roleId, change.moduleKey, change.permissionKey],
        );
        await this.writeAudit(
          client,
          actorUserId,
          `Permission changed: role "${existing.role_name}" — ${existing.module_name} → ${existing.permission_name}: ` +
          `${existing.is_allowed ? 'Allowed' : 'Denied'} → ${change.isAllowed ? 'Allowed' : 'Denied'}`,
        );
        updated++;
      }
    });

    this.bust();
    return { updated };
  }

  // ─── Roles CRUD ────────────────────────────────────────────────────────────

  async listRoles(): Promise<Array<{ id: string; key: string; name: string; description: string | null; isSystem: boolean; accountScopeField: string | null }>> {
    const { rows } = await this.db.query(
      `SELECT id, key, name, description, is_system, account_scope_field
       FROM roles ORDER BY is_system DESC, name ASC`,
    );
    return rows.map((r) => ({
      id: r.id, key: r.key, name: r.name, description: r.description ?? null,
      isSystem: r.is_system, accountScopeField: r.account_scope_field ?? null,
    }));
  }

  async createRole(data: { name: string; description?: string; accountScopeField?: string | null }, actorUserId: string): Promise<{ id: string }> {
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Role name is required');
    const key = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!key) throw new BadRequestException('Role name must contain letters or numbers');

    const created = await this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO roles (key, name, description, is_system, account_scope_field) VALUES ($1, $2, $3, FALSE, $4) RETURNING id`,
        [key, name, data.description ?? null, data.accountScopeField?.trim() || null],
      ).catch((err: any) => {
        if (err?.code === '23505') throw new ConflictException(`A role named "${name}" already exists.`);
        throw err;
      });
      const roleId = rows[0].id;
      // Materialise a full matrix row set (all denied, nothing locked except the
      // Accounts→Delete business rule) so the new role appears in the grid.
      await client.query(
        `INSERT INTO role_permissions (role_id, module_key, permission_key, is_allowed, is_locked)
         SELECT $1, m.key, p.key, FALSE, FALSE
         FROM modules m CROSS JOIN permissions p
         ON CONFLICT (role_id, module_key, permission_key) DO NOTHING`,
        [roleId],
      );
      await this.writeAudit(client, actorUserId, `Role created: "${name}"`);
      return { id: roleId };
    });

    this.bust();
    return created;
  }

  async updateRole(id: string, data: { name?: string; description?: string; accountScopeField?: string | null }, actorUserId: string): Promise<{ id: string }> {
    const { rows } = await this.db.query(`SELECT is_system, name FROM roles WHERE id = $1`, [id]);
    if (!rows.length) throw new NotFoundException('Role not found');
    if (rows[0].is_system && data.name && data.name.trim() !== rows[0].name) {
      throw new ForbiddenException('System roles cannot be renamed.');
    }

    const updates: string[] = [];
    const params: any[] = [id];
    let pIdx = 2;

    if (data.name !== undefined) {
      updates.push(`name = $${pIdx++}`);
      params.push(data.name.trim());
    }
    if (data.description !== undefined) {
      updates.push(`description = $${pIdx++}`);
      params.push(data.description.trim() || null);
    }
    if (data.accountScopeField !== undefined) {
      updates.push(`account_scope_field = $${pIdx++}`);
      params.push(data.accountScopeField?.trim() || null);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      await this.db.query(
        `UPDATE roles SET ${updates.join(', ')} WHERE id = $1`,
        params,
      );
    }
    await this.db.query(
      `INSERT INTO activities (id, type, text, user_id, user_name)
       VALUES (gen_random_uuid()::TEXT, 'permission', $1, $2, 'System')`,
      [`Role updated: "${rows[0].name}"`, actorUserId],
    ).catch(() => undefined);
    this.bust();
    return { id };
  }

  async deleteRole(id: string, actorUserId: string): Promise<{ success: boolean }> {
    const { rows } = await this.db.query(`SELECT is_system, name FROM roles WHERE id = $1`, [id]);
    if (!rows.length) throw new NotFoundException('Role not found');
    if (rows[0].is_system) throw new ForbiddenException('System roles cannot be deleted.');

    const { rows: inUse } = await this.db.query(
      `SELECT COUNT(*)::INTEGER AS n FROM users WHERE role_id = $1`, [id],
    );
    if (inUse[0].n > 0) {
      throw new ConflictException(`Cannot delete role "${rows[0].name}" — ${inUse[0].n} user(s) are assigned to it.`);
    }
    await this.db.query(`DELETE FROM roles WHERE id = $1`, [id]); // role_permissions cascade
    await this.db.query(
      `INSERT INTO activities (id, type, text, user_id, user_name)
       VALUES (gen_random_uuid()::TEXT, 'permission', $1, $2, 'System')`,
      [`Role deleted: "${rows[0].name}"`, actorUserId],
    ).catch(() => undefined);
    this.bust();
    return { success: true };
  }

  /** Called by the user-management flow after a role assignment / activation change. */
  invalidate(): void {
    this.bust();
  }

  private async writeAudit(client: { query: (t: string, p?: any[]) => Promise<any> }, actorUserId: string, text: string): Promise<void> {
    await client.query(
      `INSERT INTO activities (id, type, text, user_id, user_name)
       VALUES (gen_random_uuid()::TEXT, 'permission', $1, $2, 'System')`,
      [text, actorUserId],
    );
  }
}
