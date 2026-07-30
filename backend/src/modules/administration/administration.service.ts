import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TtlCacheService } from '../../common/services/ttl-cache.service';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../rbac/permissions.service';
import type { UpdateFinancialCalendarDto, UpdateSettingsDto, UpdateUserDto } from './dto/administration.dto';

const OVERVIEW_CACHE_TTL_MS = 30_000;

export interface FYQuarterDef {
  label: string;
  startMonth: number;
  endMonth: number;
}

export interface FinancialCalendar {
  startMonth: number;
  quarters: FYQuarterDef[];
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string | null;
  roleKey: string | null;
  roleName: string | null;
  /** Every role the user holds (multi-role). Primary role is included. */
  roleIds: string[];
  roleKeys: string[];
  employeeId: string | null;
  department: string | null;
  designation: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface SystemOverview {
  totalUsers: number;
  totalAccounts: number;
  totalOpportunities: number;
  totalDocuments: number;
  totalNotifications: number;
}

export interface AdminSettings {
  fySelectorCount: string;
  [key: string]: string;
}

const DEFAULT_QUARTERS: FYQuarterDef[] = [
  { label: 'Q1', startMonth: 4,  endMonth: 6  },
  { label: 'Q2', startMonth: 7,  endMonth: 9  },
  { label: 'Q3', startMonth: 10, endMonth: 12 },
  { label: 'Q4', startMonth: 1,  endMonth: 3  },
];

@Injectable()
export class AdministrationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: TtlCacheService,
    private readonly users: UsersService,
    private readonly permissions: PermissionsService,
  ) {}

  // Five COUNT(*) scans — cached briefly; admin counters tolerate 30 s staleness.
  async getSystemOverview(): Promise<SystemOverview> {
    return this.cache.getOrSet('admin:system-overview', OVERVIEW_CACHE_TTL_MS, () =>
      this.computeSystemOverview(),
    );
  }

  private async computeSystemOverview(): Promise<SystemOverview> {
    const { rows } = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM users WHERE is_active = TRUE)          AS total_users,
        (SELECT COUNT(*)::INTEGER FROM accounts WHERE is_deleted = FALSE)     AS total_accounts,
        (SELECT COUNT(*)::INTEGER FROM opportunities WHERE is_deleted = FALSE) AS total_opportunities,
        (SELECT COUNT(*)::INTEGER FROM documents)                              AS total_documents,
        (SELECT COUNT(*)::INTEGER FROM notifications)                          AS total_notifications
    `);
    const r = rows[0];
    return {
      totalUsers:         r.total_users,
      totalAccounts:      r.total_accounts,
      totalOpportunities: r.total_opportunities,
      totalDocuments:     r.total_documents,
      totalNotifications: r.total_notifications,
    };
  }

  async getUsers(): Promise<AdminUser[]> {
    const { rows } = await this.db.query(`
      SELECT u.id, u.name, u.email, u.role, u.role_id,
             r.key AS role_key, r.name AS role_name,
             u.employee_id, u.department, u.designation,
             u.is_active,
             u.last_login::TEXT AS last_login,
             u.created_at::TEXT AS created_at,
             u.failed_attempts,
             u.locked_until::TEXT AS locked_until,
             ur.role_ids, ur.role_keys
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN LATERAL (
        SELECT array_agg(rr.id ORDER BY rr.is_system DESC, rr.name ASC) AS role_ids,
               array_agg(rr.key ORDER BY rr.is_system DESC, rr.name ASC) AS role_keys
        FROM user_roles x
        JOIN roles rr ON rr.id = x.role_id
        WHERE x.user_id = u.id
      ) ur ON TRUE
      ORDER BY u.name ASC
    `);
    return rows.map((r) => ({
      id:             r.id,
      name:           r.name,
      email:          r.email,
      role:           r.role,
      roleId:         r.role_id ?? null,
      roleKey:        r.role_key ?? null,
      roleName:       r.role_name ?? null,
      // Fall back to the primary role when the junction has no rows yet.
      roleIds:        (r.role_ids ?? (r.role_id ? [r.role_id] : [])) as string[],
      roleKeys:       (r.role_keys ?? (r.role_key ? [r.role_key] : [])) as string[],
      employeeId:     r.employee_id ?? null,
      department:     r.department ?? null,
      designation:    r.designation ?? null,
      isActive:       r.is_active,
      lastLogin:      r.last_login ?? null,
      createdAt:      r.created_at,
      failedAttempts: r.failed_attempts ?? 0,
      lockedUntil:    r.locked_until ?? null,
    }));
  }

  /**
   * Administrator update of a user: assign role, edit department/designation/
   * employee id, and activate/deactivate. Keeps the denormalised role text in
   * sync with the assigned role, records an audit entry, and busts the RBAC
   * permission cache so the change takes effect immediately.
   */
  async updateUser(id: string, dto: UpdateUserDto, actorUserId: string): Promise<AdminUser> {
    const { rows: before } = await this.db.query(
      `SELECT u.name, u.is_active, r.name AS role_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [id],
    );
    if (!before.length) throw new NotFoundException('User not found');

    // Determine the authoritative role set for this update. `roleIds` (multi-role)
    // wins when present; otherwise a single `roleId` is treated as a one-element
    // set. When neither is supplied the user's roles are left untouched.
    const roleSet: string[] | null = dto.roleIds
      ? [...new Set(dto.roleIds.filter((r) => typeof r === 'string' && r.trim() !== ''))]
      : dto.roleId
        ? [dto.roleId]
        : null;

    // Sync the multi-role junction first; it returns the primary role id that
    // should back users.role_id (the JWT display claim).
    let primaryRoleId: string | null = null;
    let roleName: string | null = null;
    if (roleSet) {
      primaryRoleId = await this.permissions.setUserRoles(id, roleSet, actorUserId);
      if (primaryRoleId) {
        const { rows } = await this.db.query(`SELECT name FROM roles WHERE id = $1`, [primaryRoleId]);
        roleName = rows[0]?.name ?? null;
      }
    }

    await this.users.adminUpdate(id, {
      roleId:      primaryRoleId,
      roleName,
      department:  dto.department ?? null,
      designation: dto.designation ?? null,
      employeeId:  dto.employeeId ?? null,
      isActive:    typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
    });

    // Audit trail (user-facing Audit Log — type 'permission' groups access changes).
    const changes: string[] = [];
    if (roleName && roleName !== before[0].role_name) {
      changes.push(`role "${before[0].role_name ?? 'none'}" → "${roleName}"`);
    }
    if (typeof dto.isActive === 'boolean' && dto.isActive !== before[0].is_active) {
      changes.push(dto.isActive ? 'activated' : 'deactivated');
    }
    if (dto.department !== undefined) changes.push(`department set to "${dto.department}"`);
    if (dto.designation !== undefined) changes.push(`designation set to "${dto.designation}"`);
    if (changes.length) {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name)
         VALUES (gen_random_uuid()::TEXT, 'permission', $1, $2, 'System')`,
        [`User "${before[0].name}": ${changes.join('; ')}`, actorUserId],
      ).catch(() => undefined);
    }

    this.permissions.invalidate();
    this.cache.invalidatePrefix('admin:');

    const users = await this.getUsers();
    const updated = users.find((u) => u.id === id);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async getFinancialCalendar(): Promise<FinancialCalendar> {
    const { rows } = await this.db.query(
      `SELECT start_month, quarters, updated_at::TEXT AS updated_at
       FROM financial_calendar WHERE id = 'default'`,
    );
    if (rows.length === 0) {
      return { startMonth: 4, quarters: DEFAULT_QUARTERS };
    }
    return {
      startMonth: rows[0].start_month,
      quarters:   rows[0].quarters as FYQuarterDef[],
      updatedAt:  rows[0].updated_at,
    };
  }

  async updateFinancialCalendar(dto: UpdateFinancialCalendarDto): Promise<FinancialCalendar> {
    const { rows } = await this.db.query(
      `INSERT INTO financial_calendar (id, start_month, quarters, updated_at)
       VALUES ('default', $1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
         SET start_month = EXCLUDED.start_month,
             quarters    = EXCLUDED.quarters,
             updated_at  = NOW()
       RETURNING start_month, quarters, updated_at::TEXT AS updated_at`,
      [dto.startMonth, JSON.stringify(dto.quarters)],
    );
    return {
      startMonth: rows[0].start_month,
      quarters:   rows[0].quarters as FYQuarterDef[],
      updatedAt:  rows[0].updated_at,
    };
  }

  async getSettings(): Promise<AdminSettings> {
    const { rows } = await this.db.query(`SELECT key, value FROM administration_settings`);
    const settings: AdminSettings = { fySelectorCount: '5' };
    for (const row of rows) {
      // Convert snake_case DB keys to camelCase
      const key = row.key.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
      settings[key] = row.value;
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<AdminSettings> {
    const pairs: Array<[string, string]> = [];
    if (dto.fySelectorCount !== undefined) pairs.push(['fy_selector_count', dto.fySelectorCount]);
    for (const [key, value] of pairs) {
      await this.db.query(
        `INSERT INTO administration_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value],
      );
    }
    return this.getSettings();
  }
}
