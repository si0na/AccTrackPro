import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { Opportunity } from '../../types';
import { UpsertOpportunityForecastDto } from './dto/opportunity-forecast.dto';

/** Current forecast + actuals for one opportunity (null values = never set). */
export interface OpportunityForecast {
  opportunityId: string;
  accountId: string | null;
  forecastDate: string | null;
  forecastValue: number | null;
  actualDate: string | null;
  actualValue: number | null;
  remarks: string | null;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** One forecast-revision snapshot (append-only audit trail). */
export interface OpportunityForecastHistoryEntry {
  id: string;
  forecastDate: string | null;
  forecastValue: number | null;
  updatedByName: string | null;
  updatedAt: string;
}

/** Full payload for the per-opportunity Forecast page. */
export interface OpportunityForecastResult {
  opportunity: Opportunity;
  forecast: OpportunityForecast | null;
  history: OpportunityForecastHistoryEntry[];
}

function normNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normDate(v: unknown): string | null {
  // DATE columns come back as raw 'YYYY-MM-DD' strings (see DatabaseService type
  // parsers); the DTO already validates the ISO format on the way in.
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

@Injectable()
export class OpportunityForecastService {
  private readonly logger = new Logger(OpportunityForecastService.name);

  constructor(
    private readonly db: DatabaseService,
    // Reused for ownership enforcement + the opportunity summary shown at the top
    // of the Forecast page — no duplicate opportunity-fetch/ownership logic.
    private readonly opportunities: OpportunitiesService,
    private readonly bus: NotificationEventBus,
  ) {}

  /**
   * Loads the Forecast page payload for one opportunity. Ownership is enforced
   * by OpportunitiesService.findOne (throws NotFound when the opportunity is not
   * owned by the requesting user).
   */
  async getForOpportunity(opportunityId: string, userId: string): Promise<OpportunityForecastResult> {
    const opportunity = await this.opportunities.findOne(opportunityId, userId);
    const forecast = await this.loadForecast(opportunityId);
    const history = await this.loadHistory(opportunityId);
    return { opportunity, forecast, history };
  }

  /**
   * Saves the whole forecast card (forecast + actuals) for one opportunity.
   * The page always sends every field, so an omitted field clears its stored
   * value. When the forecast date or forecast value is set or changed, a
   * revision row is appended to opportunity_forecast_history so the timeline of
   * forecast changes is preserved.
   */
  async upsert(
    opportunityId: string,
    dto: UpsertOpportunityForecastDto,
    user: { sub: string; name?: string },
  ): Promise<OpportunityForecastResult> {
    // Ownership check (also yields accountId for the denormalised FK).
    const opportunity = await this.opportunities.findOne(opportunityId, user.sub);

    const existing = await this.loadForecast(opportunityId);

    const forecastDate = normDate(dto.forecastDate);
    const forecastValue = normNum(dto.forecastValue);
    const actualDate = normDate(dto.actualDate);
    const actualValue = normNum(dto.actualValue);
    const remarks = dto.remarks?.trim() ? dto.remarks.trim() : null;

    const forecastChanged =
      !existing ||
      normDate(existing.forecastDate) !== forecastDate ||
      normNum(existing.forecastValue) !== forecastValue;
    const hasForecast = forecastDate !== null || forecastValue !== null;

    await this.db.query(
      `INSERT INTO opportunity_forecasts
         (id, opportunity_id, account_id, forecast_date, forecast_value,
          actual_date, actual_value, remarks, updated_by, updated_at)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (opportunity_id) DO UPDATE SET
         account_id     = EXCLUDED.account_id,
         forecast_date  = EXCLUDED.forecast_date,
         forecast_value = EXCLUDED.forecast_value,
         actual_date    = EXCLUDED.actual_date,
         actual_value   = EXCLUDED.actual_value,
         remarks        = EXCLUDED.remarks,
         updated_by     = EXCLUDED.updated_by,
         updated_at     = NOW()`,
      [
        opportunityId, opportunity.accountId ?? null,
        forecastDate, forecastValue, actualDate, actualValue, remarks, user.sub,
      ],
    );

    // Append a revision snapshot whenever the forecast itself is set or changed
    // (actual-only edits don't create forecast history).
    if (forecastChanged && hasForecast) {
      await this.db.query(
        `INSERT INTO opportunity_forecast_history
           (id, opportunity_id, forecast_date, forecast_value, updated_by, created_at)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, NOW())`,
        [opportunityId, forecastDate, forecastValue, user.sub],
      );
    }

    await this.log(
      `Updated forecast for Opportunity '${opportunity.name}'`,
      opportunity.accountId,
      opportunityId,
      user.sub,
    );

    // Reuse the opportunity's owner for the notification target, consistent with
    // the rest of the module's per-user notification model.
    if (opportunity.ownerId) {
      this.bus.emit({
        userId:               opportunity.ownerId,
        type:                 'Opportunity',
        eventType:            'Updated',
        title:                'Forecast Updated',
        message:              `Forecast for "${opportunity.name}" has been updated.`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId:            opportunity.accountId,
        opportunityId,
      });
    }

    return this.getForOpportunity(opportunityId, user.sub);
  }

  // ── Internal loaders ──────────────────────────────────────────────────────

  private async loadForecast(opportunityId: string): Promise<OpportunityForecast | null> {
    const { rows } = await this.db.query(
      `SELECT f.opportunity_id, f.account_id, f.forecast_date, f.forecast_value,
              f.actual_date, f.actual_value, f.remarks, f.updated_by, f.updated_at,
              u.name AS updated_by_name
       FROM opportunity_forecasts f
       LEFT JOIN users u ON f.updated_by = u.id
       WHERE f.opportunity_id = $1`,
      [opportunityId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      opportunityId: r.opportunity_id,
      accountId:     r.account_id ?? null,
      forecastDate:  normDate(r.forecast_date),
      forecastValue: normNum(r.forecast_value),
      actualDate:    normDate(r.actual_date),
      actualValue:   normNum(r.actual_value),
      remarks:       r.remarks ?? null,
      updatedById:   r.updated_by ?? null,
      updatedByName: r.updated_by_name ?? null,
      updatedAt:     r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
  }

  private async loadHistory(opportunityId: string): Promise<OpportunityForecastHistoryEntry[]> {
    const { rows } = await this.db.query(
      `SELECT h.id, h.forecast_date, h.forecast_value, h.created_at,
              u.name AS updated_by_name
       FROM opportunity_forecast_history h
       LEFT JOIN users u ON h.updated_by = u.id
       WHERE h.opportunity_id = $1
       ORDER BY h.created_at DESC`,
      [opportunityId],
    );
    return rows.map((r: any) => ({
      id:            r.id,
      forecastDate:  normDate(r.forecast_date),
      forecastValue: normNum(r.forecast_value),
      updatedByName: r.updated_by_name ?? null,
      updatedAt:     new Date(r.created_at).toISOString(),
    }));
  }

  private async log(text: string, accountId?: string, opportunityId?: string, userId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id, opportunity_id)
         VALUES (gen_random_uuid()::TEXT, 'opportunity', $1, $2, 'System', $3, $4)`,
        [text, userId ?? null, accountId ?? null, opportunityId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write forecast activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
