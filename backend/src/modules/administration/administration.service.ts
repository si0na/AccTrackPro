import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TtlCacheService } from '../../common/services/ttl-cache.service';
import type { UpdateFinancialCalendarDto, UpdateSettingsDto } from './dto/administration.dto';

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
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
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
      SELECT id, name, email, role, is_active,
             last_login::TEXT AS last_login,
             created_at::TEXT AS created_at
      FROM users
      ORDER BY name ASC
    `);
    return rows.map((r) => ({
      id:        r.id,
      name:      r.name,
      email:     r.email,
      role:      r.role,
      isActive:  r.is_active,
      lastLogin: r.last_login ?? null,
      createdAt: r.created_at,
    }));
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
