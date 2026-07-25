import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  DEFAULT_QUARTERS,
  DEFAULT_START_MONTH,
  FYQuarterDef,
  buildQuarterRanges,
  computeFY,
  fyDateRange,
} from '../utils/fiscal.util';

/**
 * Query parameters sent by the frontend on filterable GET endpoints.
 *
 * `userId`        — the authenticated user's UUID. Scopes records to the
 *                   signed-in user via owner_id FK columns.
 * `financialYear` / `quarter`
 *                 — the Global Period Selector. These NEVER match stored
 *                   columns: fiscal periods are derived from business dates
 *                   (opportunity close date, action-item due date) using the
 *                   configured Financial Calendar. Accounts, stakeholders,
 *                   and documents are never period-filtered.
 */
export interface FilterParams {
  financialYear?: string;
  quarter?: string;
  userId?: string;
}

export interface NormalizedFilter {
  fy: string | null;
  quarter: string | null;
  userId: string | null;
}

interface FiscalYearRange {
  label: string;
  startDate: string;
  endDate: string;
  startMonth: number;
  quarters: { label: string; startDate: string; endDate: string }[];
}

/**
 * Snapshot of the fiscal configuration used to translate FY/quarter labels
 * into date ranges and to derive period labels from dates. Fetch once per
 * request with getFiscalContext() and pass to the pure helpers below.
 */
export interface FiscalContext {
  /** Global Financial Calendar start month (1-12). */
  startMonth: number;
  /** Global Financial Calendar quarter definitions. */
  quarterDefs: FYQuarterDef[];
  /** Configured financial years, each with its own calendar snapshot. */
  years: FiscalYearRange[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Shared service that normalises raw query-param strings into typed filter
 * values and builds reusable SQL condition fragments.
 *
 * Date-driven fiscal model: fiscal period filters are translated into date
 * ranges applied to the entity's business date column. No entity stores a
 * financial_year or quarter column.
 */
@Injectable()
export class FilterContextService {
  constructor(private readonly db: DatabaseService) {}

  normalize(params: FilterParams): NormalizedFilter {
    return {
      fy:      params.financialYear && params.financialYear !== 'All' ? params.financialYear : null,
      quarter: params.quarter       && params.quarter       !== 'All' ? params.quarter       : null,
      userId:  params.userId        && params.userId        !== 'All' ? params.userId        : null,
    };
  }

  /**
   * Owner (user) scoping condition on `{alias}.owner_id`. This is the ONLY
   * filter that applies to accounts — they are never period-filtered.
   */
  buildOwnerConditions(
    alias: string,
    filter: NormalizedFilter,
    startIdx: number,
  ): { conditions: string[]; params: any[]; nextIdx: number } {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = startIdx;

    if (filter.userId) {
      conditions.push(`${alias}.owner_id = $${idx++}`);
      params.push(filter.userId);
    }
    return { conditions, params, nextIdx: idx };
  }

  /**
   * Load the fiscal configuration (global Financial Calendar plus every
   * configured Financial Year with its calendar snapshot). One query pair per
   * request; pass the result to resolvePeriodRange/derivePeriod/…
   */
  async getFiscalContext(): Promise<FiscalContext> {
    const [calRes, fyRes] = await Promise.all([
      this.db.query(`SELECT start_month, quarters FROM financial_calendar WHERE id = 'default'`),
      this.db.query(
        `SELECT fy_label, start_year,
                start_date::TEXT AS start_date,
                end_date::TEXT   AS end_date,
                calendar_start_month, calendar_quarters
         FROM financial_years`,
      ),
    ]);

    const startMonth: number = calRes.rows[0]?.start_month ?? DEFAULT_START_MONTH;
    const quarterDefs: FYQuarterDef[] = calRes.rows[0]?.quarters ?? DEFAULT_QUARTERS;

    const years: FiscalYearRange[] = fyRes.rows.map((r) => {
      const fyStartMonth: number = r.calendar_start_month ?? DEFAULT_START_MONTH;
      const fyQuarterDefs: FYQuarterDef[] = r.calendar_quarters ?? DEFAULT_QUARTERS;
      return {
        label:      r.fy_label,
        startDate:  r.start_date,
        endDate:    r.end_date,
        startMonth: fyStartMonth,
        quarters:   buildQuarterRanges(r.start_year, fyStartMonth, fyQuarterDefs),
      };
    });

    return { startMonth, quarterDefs, years };
  }

  /**
   * Derive { financialYear, quarter } display labels for a business date.
   * Prefers the calendar snapshot of the configured FY containing the date
   * (so historical periods never shift when the global calendar changes);
   * falls back to global-calendar math for dates outside every configured FY.
   * Missing/invalid dates yield empty labels.
   */
  derivePeriod(
    dateStr: string | null | undefined,
    ctx: FiscalContext,
  ): { financialYear: string; quarter: string } {
    const raw = (dateStr ?? '').trim();
    if (!DATE_RE.test(raw)) return computeFY(raw, ctx.startMonth);

    const day = raw.slice(0, 10);
    const fy = ctx.years.find((y) => day >= y.startDate && day <= y.endDate);
    if (fy) {
      const q = fy.quarters.find((q) => day >= q.startDate && day <= q.endDate);
      return {
        financialYear: fy.label,
        quarter:       q?.label ?? computeFY(day, fy.startMonth).quarter,
      };
    }
    return computeFY(day, ctx.startMonth);
  }

  /**
   * Resolve a FY label (and optional quarter label) into an inclusive
   * YYYY-MM-DD date range. Uses the configured FY's calendar snapshot when it
   * exists; otherwise computes the range from the label and the global
   * calendar. Returns null when the label cannot be resolved at all.
   */
  resolvePeriodRange(
    ctx: FiscalContext,
    fyLabel: string,
    quarterLabel: string | null,
  ): { start: string; end: string } | null {
    const fy = ctx.years.find((y) => y.label === fyLabel);
    if (fy) {
      if (quarterLabel) {
        const q = fy.quarters.find((q) => q.label === quarterLabel);
        return q ? { start: q.startDate, end: q.endDate } : null;
      }
      return { start: fy.startDate, end: fy.endDate };
    }

    const startYear = parseInt(fyLabel, 10);
    if (isNaN(startYear)) return null;
    if (quarterLabel) {
      const q = buildQuarterRanges(startYear, ctx.startMonth, ctx.quarterDefs)
        .find((q) => q.label === quarterLabel);
      return q ? { start: q.startDate, end: q.endDate } : null;
    }
    const { startDate, endDate } = fyDateRange(startYear, ctx.startMonth);
    return { start: startDate, end: endDate };
  }

  /**
   * Fiscal-period SQL conditions for an entity whose period is derived from a
   * business date (opportunities.allocation_end_date, action_items.due_date, …).
   *
   * @param dateExpr    SQL expression yielding a 'YYYY-MM-DD' text value
   * @param filter      Normalized filter values
   * @param ctx         Fiscal context from getFiscalContext()
   * @param startIdx    First available $N placeholder index
   * @param guardFormat Add a format guard for TEXT columns that may hold
   *                    empty/free-form values (default true)
   */
  buildPeriodConditions(
    dateExpr: string,
    filter: NormalizedFilter,
    ctx: FiscalContext,
    startIdx: number,
    guardFormat = true,
  ): { conditions: string[]; params: any[]; nextIdx: number } {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = startIdx;

    if (!filter.fy && !filter.quarter) return { conditions, params, nextIdx: idx };

    const guard = guardFormat ? `${dateExpr} ~ '^\\d{4}-\\d{2}-\\d{2}' AND ` : '';

    if (filter.fy) {
      const range = this.resolvePeriodRange(ctx, filter.fy, filter.quarter);
      if (!range) {
        // Unresolvable period label — matches nothing, mirroring the behaviour
        // of an equality filter against a non-existent label.
        conditions.push('FALSE');
        return { conditions, params, nextIdx: idx };
      }
      conditions.push(
        `(${guard}SUBSTRING(${dateExpr} FROM 1 FOR 10) BETWEEN $${idx} AND $${idx + 1})`,
      );
      params.push(range.start, range.end);
      idx += 2;
      return { conditions, params, nextIdx: idx };
    }

    // Quarter selected with "All" financial years: match the quarter's months
    // (per the global calendar) across every year.
    const def = ctx.quarterDefs.find((q) => q.label === filter.quarter);
    if (!def) {
      conditions.push('FALSE');
      return { conditions, params, nextIdx: idx };
    }
    const months: number[] = [];
    for (let m = def.startMonth; ; m = (m % 12) + 1) {
      months.push(m);
      if (m === def.endMonth) break;
      if (months.length > 12) break; // malformed definition safety valve
    }
    conditions.push(
      `(${guard}CAST(SUBSTRING(${dateExpr} FROM 6 FOR 2) AS INT) = ANY($${idx}))`,
    );
    params.push(months);
    idx += 1;

    return { conditions, params, nextIdx: idx };
  }

  /**
   * SQL expression producing the quarter label ('Q1'…) for a date expression,
   * used by reporting GROUP BYs. When a configured FY is selected its snapshot
   * quarter boundaries are used; otherwise quarters are derived from the
   * global calendar start month.
   */
  quarterLabelExpr(dateExpr: string, ctx: FiscalContext, fyLabel: string | null): string {
    const day = `SUBSTRING(${dateExpr} FROM 1 FOR 10)`;
    const fy = fyLabel ? ctx.years.find((y) => y.label === fyLabel) : undefined;
    if (fy) {
      const esc = (s: string) => s.replace(/'/g, "''");
      const cases = fy.quarters
        .map((q) => `WHEN ${day} BETWEEN '${esc(q.startDate)}' AND '${esc(q.endDate)}' THEN '${esc(q.label)}'`)
        .join(' ');
      return `CASE ${cases} END`;
    }
    // Equal 3-month windows from the global calendar start month.
    const sm = Math.trunc(ctx.startMonth); // integer from DB — safe to inline
    return `('Q' || (((CAST(SUBSTRING(${dateExpr} FROM 6 FOR 2) AS INT) - ${sm} + 12) % 12) / 3 + 1))`;
  }
}
