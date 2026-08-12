import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TtlCacheService } from '../../common/services/ttl-cache.service';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../rbac/permissions.service';
import type { UpdateFinancialCalendarDto, UpdateSettingsDto, UpdateUserDto, CreateUserDto } from './dto/administration.dto';

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
  isPending: boolean;
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
      SELECT
        COALESCE(u.id, em.id) AS id,
        COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS name,
        COALESCE(u.email, em.email) AS email,
        u.role,
        COALESCE(u.role_id, em.role_id) AS role_id,
        r.key AS role_key,
        r.name AS role_name,
        COALESCE(u.employee_id, em.employee_id) AS employee_id,
        COALESCE(u.department, em.department) AS department,
        COALESCE(u.designation, em.designation) AS designation,
        COALESCE(u.is_active, TRUE) AS is_active,
        u.last_login::TEXT AS last_login,
        COALESCE(u.created_at::TEXT, em.created_at::TEXT) AS created_at,
        COALESCE(u.failed_attempts, 0) AS failed_attempts,
        u.locked_until::TEXT AS locked_until,
        COALESCE(ur.role_ids, er.role_ids, CASE WHEN em.role_id IS NOT NULL THEN ARRAY[em.role_id] ELSE ARRAY[]::TEXT[] END) AS role_ids,
        COALESCE(ur.role_keys, er.role_keys, CASE WHEN r.key IS NOT NULL THEN ARRAY[r.key] ELSE ARRAY[]::TEXT[] END) AS role_keys,
        (u.id IS NULL) AS is_pending
      FROM employee_master em
      FULL OUTER JOIN users u ON LOWER(u.email) = LOWER(em.email)
      LEFT JOIN roles r ON r.id = COALESCE(u.role_id, em.role_id)
      LEFT JOIN LATERAL (
        SELECT array_agg(rr.id ORDER BY rr.is_system DESC, rr.name ASC) AS role_ids,
               array_agg(rr.key ORDER BY rr.is_system DESC, rr.name ASC) AS role_keys
        FROM user_roles x
        JOIN roles rr ON rr.id = x.role_id
        WHERE x.user_id = u.id
      ) ur ON TRUE
      LEFT JOIN LATERAL (
        SELECT array_agg(rr.id ORDER BY rr.is_system DESC, rr.name ASC) AS role_ids,
               array_agg(rr.key ORDER BY rr.is_system DESC, rr.name ASC) AS role_keys
        FROM employee_roles x
        JOIN roles rr ON rr.id = x.role_id
        WHERE x.employee_id = em.id
      ) er ON TRUE
      ORDER BY COALESCE(u.name, em.name) ASC
    `);
    return rows.map((r) => ({
      id:             r.id,
      name:           r.name,
      email:          r.email,
      role:           r.role || '',
      roleId:         r.role_id ?? null,
      roleKey:        r.role_key ?? null,
      roleName:       r.role_name ?? null,
      roleIds:        (r.role_ids ?? []) as string[],
      roleKeys:       (r.role_keys ?? []) as string[],
      employeeId:     r.employee_id ?? null,
      department:     r.department ?? null,
      designation:    r.designation ?? null,
      isActive:       r.is_active,
      lastLogin:      r.last_login ?? null,
      createdAt:      r.created_at,
      failedAttempts: r.failed_attempts ?? 0,
      lockedUntil:    r.locked_until ?? null,
      isPending:      r.is_pending ?? false,
    }));
  }

  async createUser(dto: CreateUserDto, actorUserId: string): Promise<AdminUser> {
    const email = dto.email.trim().toLowerCase();

    const { rows: existingEmp } = await this.db.query(
      `SELECT id FROM employee_master WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    if (existingEmp.length) {
      throw new ConflictException('This email address is already in the whitelisted users list');
    }

    const primaryRoleId = dto.roleIds[0] ?? null;

    let employeeId: string;
    await this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO employee_master (id, email, name, role_id, employee_id, department, designation)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [email, dto.name ?? '', primaryRoleId, dto.employeeId ?? null, dto.department ?? null, dto.designation ?? null],
      );
      employeeId = rows[0].id;

      for (const rId of dto.roleIds) {
        await client.query(
          `INSERT INTO employee_roles (employee_id, role_id) VALUES ($1, $2)
           ON CONFLICT (employee_id, role_id) DO NOTHING`,
          [employeeId, rId],
        );
      }
    });

    this.cache.invalidatePrefix('admin:');

    const list = await this.getUsers();
    const created = list.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!created) throw new NotFoundException('Whitelisted user not found');
    return created;
  }

  async updateUser(id: string, dto: UpdateUserDto, actorUserId: string): Promise<AdminUser> {
    const { rows: userCheck } = await this.db.query(`SELECT id, email FROM users WHERE id = $1`, [id]);
    const isRegistered = userCheck.length > 0;

    if (isRegistered) {
      const email = userCheck[0].email;
      const { rows: before } = await this.db.query(
        `SELECT u.name, u.is_active, r.name AS role_name
         FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
        [id],
      );
      if (!before.length) throw new NotFoundException('User not found');

      const roleSet: string[] | null = dto.roleIds
        ? [...new Set(dto.roleIds.filter((r) => typeof r === 'string' && r.trim() !== ''))]
        : dto.roleId
          ? [dto.roleId]
          : null;

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
        name:        dto.name ?? null,
        roleId:      primaryRoleId,
        roleName,
        department:  dto.department ?? null,
        designation: dto.designation ?? null,
        employeeId:  dto.employeeId ?? null,
        isActive:    typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
      });

      await this.db.withTransaction(async (client) => {
        await client.query(
          `UPDATE employee_master
           SET name = COALESCE($2, name),
               role_id = COALESCE($3, role_id),
               employee_id = COALESCE($4, employee_id),
               department = COALESCE($5, department),
               designation = COALESCE($6, designation),
               updated_at = NOW()
           WHERE LOWER(email) = LOWER($1)`,
          [email, dto.name ?? null, primaryRoleId, dto.employeeId ?? null, dto.department ?? null, dto.designation ?? null],
        );

        if (roleSet) {
          const { rows: emp } = await client.query(
            `SELECT id FROM employee_master WHERE LOWER(email) = LOWER($1)`,
            [email],
          );
          if (emp.length) {
            const empId = emp[0].id;
            await client.query(`DELETE FROM employee_roles WHERE employee_id = $1`, [empId]);
            for (const rId of roleSet) {
              await client.query(
                `INSERT INTO employee_roles (employee_id, role_id) VALUES ($1, $2)
                 ON CONFLICT (employee_id, role_id) DO NOTHING`,
                [empId, rId],
              );
            }
          }
        }
      });

      const changes: string[] = [];
      if (roleName && roleName !== before[0].role_name) {
        changes.push(`role "${before[0].role_name ?? 'none'}" → "${roleName}"`);
      }
      if (typeof dto.isActive === 'boolean' && dto.isActive !== before[0].is_active) {
        changes.push(dto.isActive ? 'activated' : 'deactivated');
      }
      if (dto.name !== undefined) changes.push(`name set to "${dto.name}"`);
      if (dto.department !== undefined) changes.push(`department set to "${dto.department}"`);
      if (dto.designation !== undefined) changes.push(`designation set to "${dto.designation}"`);
      if (changes.length) {
        await this.db.query(
          `INSERT INTO activities (id, type, text, user_id, user_name)
           VALUES (gen_random_uuid()::TEXT, 'permission', $1, $2, 'System')`,
          [`User "${before[0].name}": ${changes.join('; ')}`, actorUserId],
        ).catch(() => undefined);
      }
    } else {
      const { rows: before } = await this.db.query(
        `SELECT id, email, name, role_id FROM employee_master WHERE id = $1`,
        [id],
      );
      if (!before.length) throw new NotFoundException('User not found');

      const roleSet: string[] | null = dto.roleIds
        ? [...new Set(dto.roleIds.filter((r) => typeof r === 'string' && r.trim() !== ''))]
        : dto.roleId
          ? [dto.roleId]
          : null;
      const primaryRoleId = roleSet ? roleSet[0] : before[0].role_id;

      await this.db.withTransaction(async (client) => {
        await client.query(
          `UPDATE employee_master
           SET name = COALESCE($2, name),
               role_id = COALESCE($3, role_id),
               employee_id = COALESCE($4, employee_id),
               department = COALESCE($5, department),
               designation = COALESCE($6, designation),
               updated_at = NOW()
           WHERE id = $1`,
          [id, dto.name ?? null, primaryRoleId, dto.employeeId ?? null, dto.department ?? null, dto.designation ?? null],
        );

        if (roleSet) {
          await client.query(`DELETE FROM employee_roles WHERE employee_id = $1`, [id]);
          for (const rId of roleSet) {
            await client.query(
              `INSERT INTO employee_roles (employee_id, role_id) VALUES ($1, $2)
               ON CONFLICT (employee_id, role_id) DO NOTHING`,
              [id, rId],
            );
          }
        }
      });
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
