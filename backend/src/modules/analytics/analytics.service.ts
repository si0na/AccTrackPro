import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService } from '../../common/services/filter-context.service';
import { TtlCacheService } from '../../common/services/ttl-cache.service';

const FORECAST_CACHE_TTL_MS = 30_000;

export interface ForecastSummary {
  pipelineValue: number;
  forecastRevenue: number;
  committedForecast: number;
  bestCaseForecast: number;
  /** Sum of persisted actual revenue (opportunity_forecasts.actual_value) across the filtered set. */
  actualRevenue: number;
  opportunityCount: number;
  winCount: number;
  avgDealSize: number;
}

export interface QuarterForecast {
  quarter: string;
  pipelineValue: number;
  forecastRevenue: number;
}

export interface AccountForecast {
  accountId: string;
  accountName: string;
  accountType: string;
  pipelineValue: number;
  forecastRevenue: number;
  opportunityCount: number;
}

export interface StageForecast {
  stage: string;
  count: number;
  pipelineValue: number;
  forecastRevenue: number;
}

export interface ForecastResult {
  summary: ForecastSummary;
  byQuarter: QuarterForecast[];
  byAccount: AccountForecast[];
  byStage: StageForecast[];
}

export interface ForecastParams {
  financialYear?: string;
  quarter?: string;
  userId?: string;
  accountId?: string;
}

/**
 * Business rules applied in SQL (all computed server-side):
 *
 *  Pipeline Value    = SUM(value)                 — nominal / face value of all active opportunities
 *  Forecast Revenue  = SUM(value × probability/100) — probability-weighted expected revenue
 *  Committed Forecast= weighted sum where probability ≥ 70 OR stage IN ('Negotiation','Verbal Agreement','Won')
 *                      These are deals the rep is confident will close this period.
 *  Best Case Forecast= SUM(value) for stage NOT IN ('Lead')
 *                      Maximum achievable if every qualified-and-beyond opportunity closes.
 *
 * byQuarter always covers all four quarters of the selected FY (quarter filter is intentionally
 * excluded from that sub-query so the trend chart always shows the full year for context).
 *
 * Fiscal periods are derived from o.allocation_end_date using the configured
 * Financial Calendar — FY/quarter filters are translated into allocation-end-date
 * ranges, and the quarterly breakdown groups by a quarter label computed from
 * the allocation end date.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly cache: TtlCacheService,
  ) {}

  /**
   * Forecast aggregations run four GROUP BY queries over opportunities.
   * Results are cached briefly per (user, period, account) — dashboards and
   * period-selector churn re-request identical filters far more often than
   * the underlying data changes. 30 s of staleness is acceptable here.
   */
  async getForecast(params: ForecastParams): Promise<ForecastResult> {
    const key = `forecast:${params.userId ?? ''}:${params.financialYear ?? ''}:${params.quarter ?? ''}:${params.accountId ?? ''}`;
    return this.cache.getOrSet(key, FORECAST_CACHE_TTL_MS, () => this.computeForecast(params));
  }

  private async computeForecast(params: ForecastParams): Promise<ForecastResult> {
    const f = this.filter.normalize(params);
    const accountId = params.accountId && params.accountId !== 'All' ? params.accountId : null;
    const ctx = await this.filter.getFiscalContext();

    // Full filter — applied to KPIs, byAccount, byStage
    const fullPeriod = this.filter.buildPeriodConditions('o.allocation_end_date', f, ctx, 1);
    const fullConds: string[] = [...fullPeriod.conditions];
    const fullVals: any[] = [...fullPeriod.params];
    let pi = fullPeriod.nextIdx;
    if (f.userId)  { fullConds.push(`o.owner_id   = $${pi++}`); fullVals.push(f.userId);  }
    if (accountId) { fullConds.push(`o.account_id = $${pi++}`); fullVals.push(accountId); }
    const fullWhere = fullConds.length ? `AND ${fullConds.join(' AND ')}` : '';

    // FY-only filter — applied to byQuarter so the chart always shows all four quarters
    const fyOnly = { ...f, quarter: null };
    const fyPeriod = this.filter.buildPeriodConditions('o.allocation_end_date', fyOnly, ctx, 1);
    const fyConds: string[] = [...fyPeriod.conditions];
    const fyVals: any[] = [...fyPeriod.params];
    let fi = fyPeriod.nextIdx;
    if (f.userId)  { fyConds.push(`o.owner_id   = $${fi++}`); fyVals.push(f.userId);  }
    if (accountId) { fyConds.push(`o.account_id = $${fi++}`); fyVals.push(accountId); }
    const fyWhere = fyConds.length ? `AND ${fyConds.join(' AND ')}` : '';

    // Quarter label derived from the allocation end date (FY calendar snapshot
    // when a configured FY is selected, global calendar otherwise).
    const quarterExpr = this.filter.quarterLabelExpr('o.allocation_end_date', ctx, f.fy);

    // Closed-lost deals never contribute to pipeline or forecast figures.
    // The opportunity_forecasts LEFT JOIN is 1:1 (unique opportunity_id), so it
    // never inflates the value/probability SUMs below — it only makes the
    // persisted actual revenue available to the KPI query.
    const baseJoin = `
      FROM opportunities o
      INNER JOIN accounts a ON o.account_id = a.id AND a.is_deleted = FALSE
      LEFT  JOIN opportunity_forecasts fc ON fc.opportunity_id = o.id
      WHERE o.is_deleted = FALSE AND o.stage <> 'Lost'
    `;

    // ── KPI summary ───────────────────────────────────────────────────────────
    const kpiSql = `
      SELECT
        COALESCE(SUM(o.value),                                      0)::NUMERIC AS pipeline_value,
        COALESCE(SUM(o.value * o.probability / 100.0),              0)::NUMERIC AS forecast_revenue,
        COALESCE(SUM(
          CASE WHEN o.probability >= 70 OR o.stage IN ('Negotiation','Verbal Agreement','Won')
               THEN o.value * o.probability / 100.0 END
        ),                                                          0)::NUMERIC AS committed_forecast,
        COALESCE(SUM(
          CASE WHEN o.stage NOT IN ('Lead')
               THEN o.value END
        ),                                                          0)::NUMERIC AS best_case_forecast,
        COALESCE(SUM(fc.actual_value),                             0)::NUMERIC AS actual_revenue,
        COUNT(*)                                                                  AS opportunity_count,
        COUNT(CASE WHEN o.stage = 'Won' THEN 1 END)                              AS win_count,
        COALESCE(AVG(o.value),                                      0)::NUMERIC AS avg_deal_size
      ${baseJoin} ${fullWhere}
    `;

    // ── Quarterly breakdown (quarter filter excluded intentionally) ───────────
    // The quarter of each opportunity is derived from its allocation end date;
    // rows without a valid allocation end date carry no quarter and are
    // excluded here.
    const qtrSql = `
      WITH fy_opps AS (
        SELECT ${quarterExpr} AS quarter, o.value, o.probability
        ${baseJoin}
          AND o.allocation_end_date ~ '^\\d{4}-\\d{2}-\\d{2}'
          ${fyWhere}
      )
      SELECT
        q.quarter,
        COALESCE(SUM(f.value),                          0)::NUMERIC AS pipeline_value,
        COALESCE(SUM(f.value * f.probability / 100.0),  0)::NUMERIC AS forecast_revenue
      FROM (VALUES ('Q1'),('Q2'),('Q3'),('Q4')) AS q(quarter)
      LEFT JOIN fy_opps f ON f.quarter = q.quarter
      GROUP BY q.quarter
      ORDER BY q.quarter
    `;

    // ── By-account breakdown ──────────────────────────────────────────────────
    const accountSql = `
      SELECT
        o.account_id,
        a.name AS account_name,
        a.type AS account_type,
        COALESCE(SUM(o.value),                          0)::NUMERIC AS pipeline_value,
        COALESCE(SUM(o.value * o.probability / 100.0),  0)::NUMERIC AS forecast_revenue,
        COUNT(*)                                                       AS opportunity_count
      ${baseJoin} ${fullWhere}
      GROUP BY o.account_id, a.name, a.type
      ORDER BY forecast_revenue DESC
    `;

    // ── By-stage breakdown ────────────────────────────────────────────────────
    const stageSql = `
      SELECT
        o.stage,
        COUNT(*)                                                       AS count,
        COALESCE(SUM(o.value),                          0)::NUMERIC AS pipeline_value,
        COALESCE(SUM(o.value * o.probability / 100.0),  0)::NUMERIC AS forecast_revenue
      ${baseJoin} ${fullWhere}
      GROUP BY o.stage
      ORDER BY CASE o.stage
        WHEN 'Lead'        THEN 1
        WHEN 'Qualified'   THEN 2
        WHEN 'Proposal'    THEN 3
        WHEN 'Negotiation' THEN 4
        WHEN 'Verbal Agreement' THEN 5
        WHEN 'Won'         THEN 6
        ELSE 7
      END
    `;

    const [kpiRes, qtrRes, accountRes, stageRes] = await Promise.all([
      this.db.query(kpiSql, fullVals),
      this.db.query(qtrSql, fyVals),
      this.db.query(accountSql, fullVals),
      this.db.query(stageSql, fullVals),
    ]);

    const k = kpiRes.rows[0];
    return {
      summary: {
        pipelineValue:     Number(k.pipeline_value),
        forecastRevenue:   Number(k.forecast_revenue),
        committedForecast: Number(k.committed_forecast),
        bestCaseForecast:  Number(k.best_case_forecast),
        actualRevenue:     Number(k.actual_revenue),
        opportunityCount:  Number(k.opportunity_count),
        winCount:          Number(k.win_count),
        avgDealSize:       Number(k.avg_deal_size),
      },
      byQuarter: qtrRes.rows.map(r => ({
        quarter:        r.quarter,
        pipelineValue:  Number(r.pipeline_value),
        forecastRevenue:Number(r.forecast_revenue),
      })),
      byAccount: accountRes.rows.map(r => ({
        accountId:       r.account_id,
        accountName:     r.account_name,
        accountType:     r.account_type,
        pipelineValue:   Number(r.pipeline_value),
        forecastRevenue: Number(r.forecast_revenue),
        opportunityCount:Number(r.opportunity_count),
      })),
      byStage: stageRes.rows.map(r => ({
        stage:           r.stage,
        count:           Number(r.count),
        pipelineValue:   Number(r.pipeline_value),
        forecastRevenue: Number(r.forecast_revenue),
      })),
    };
  }
}
