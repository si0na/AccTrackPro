import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams, NormalizedFilter } from '../../common/services/filter-context.service';

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  accountId?: string;
  accountName?: string;
  opportunityId?: string;
  opportunityName?: string;
  actionItemId?: string;
  actionItemTitle?: string;
  dueDate?: string;
  createdAt: string;
}

const DAYS_CLOSING_SOON = 7;
const DAYS_NO_ACTIVITY  = 30;
const DAYS_DUE_SOON     = 7;

@Injectable()
export class AlertsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
  ) {}

  async findAll(params: FilterParams = {}): Promise<Alert[]> {
    const f = this.filter.normalize(params);
    const alerts: Alert[] = [];

    const [aiAlerts, acctAlerts, oppAlerts] = await Promise.all([
      this.getActionItemAlerts(f),
      this.getAccountAlerts(f),
      this.getOpportunityAlerts(f),
    ]);

    alerts.push(...aiAlerts, ...acctAlerts, ...oppAlerts);

    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    return alerts;
  }

  // Alerts reflect the current state (overdue, closing soon, at-risk) — they
  // are not fiscal-period data, so only owner scoping applies.
  private buildJoin(alias: string, f: NormalizedFilter, startIdx: number) {
    const { conditions, params, nextIdx } = this.filter.buildOwnerConditions(alias, f, startIdx);
    const joinCond = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    return { joinCond, params, nextIdx };
  }

  private async getActionItemAlerts(f: NormalizedFilter): Promise<Alert[]> {
    const { joinCond, params: qParams } = this.buildJoin('a', f, 1);

    const { rows } = await this.db.query(
      `SELECT
         ai.id, ai.title, ai.status, ai.priority, ai.due_date,
         a.id AS account_id, a.name AS account_name
       FROM action_items ai
       INNER JOIN accounts a ON ai.account_id = a.id AND a.is_deleted = FALSE ${joinCond}
       WHERE ai.is_deleted = FALSE
         AND ai.status NOT IN ('Completed', 'Cancelled')
       ORDER BY ai.due_date ASC NULLS LAST`,
      qParams,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr   = today.toISOString().split('T')[0];
    const soonDate   = new Date(today.getTime() + DAYS_DUE_SOON * 86_400_000);
    const soonStr    = soonDate.toISOString().split('T')[0];
    const nowIso     = new Date().toISOString();

    const alerts: Alert[] = [];

    for (const row of rows) {
      const base = {
        accountId:       row.account_id,
        accountName:     row.account_name,
        actionItemId:    row.id,
        actionItemTitle: row.title,
        createdAt:       nowIso,
      };

      if (row.status === 'Blocked') {
        alerts.push({
          id: `blocked-ai-${row.id}`,
          type: 'BlockedActionItem',
          severity: 'high',
          title: 'Blocked Action Item',
          description: `"${row.title}" is blocked and requires immediate attention.`,
          dueDate: row.due_date || undefined,
          ...base,
        });
        continue;
      }

      const due = row.due_date as string;
      if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) continue;

      if (due < todayStr) {
        alerts.push({
          id: `overdue-ai-${row.id}`,
          type: 'OverdueActionItem',
          severity: 'critical',
          title: 'Overdue Action Item',
          description: `"${row.title}" was due on ${due} and is past its deadline.`,
          dueDate: due,
          ...base,
        });
      } else if (due === todayStr) {
        alerts.push({
          id: `duetoday-ai-${row.id}`,
          type: 'DueTodayActionItem',
          severity: 'high',
          title: 'Action Item Due Today',
          description: `"${row.title}" is due today. Complete it before end of day.`,
          dueDate: due,
          ...base,
        });
      } else if (due <= soonStr) {
        const daysLeft = Math.ceil(
          (new Date(due).getTime() - today.getTime()) / 86_400_000,
        );
        alerts.push({
          id: `duesoon-ai-${row.id}`,
          type: 'DueSoonActionItem',
          severity: 'medium',
          title: 'Action Item Due Soon',
          description: `"${row.title}" is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${due}).`,
          dueDate: due,
          ...base,
        });
      }
    }

    return alerts;
  }

  private async getAccountAlerts(f: NormalizedFilter): Promise<Alert[]> {
    const { conditions, params: qParams } = this.filter.buildOwnerConditions('accounts', f, 1);
    const where = [
      'is_deleted = FALSE',
      "health IN ('Red','Amber')",
      ...conditions,
    ].join(' AND ');

    const { rows } = await this.db.query(
      `SELECT id, name, health FROM accounts WHERE ${where} ORDER BY health ASC, name ASC`,
      qParams,
    );

    const nowIso = new Date().toISOString();
    return rows.map(row => ({
      id:          `acct-health-${row.id}`,
      type:        row.health === 'Red' ? 'CriticalAccount' : 'AtRiskAccount',
      severity:    (row.health === 'Red' ? 'critical' : 'high') as Alert['severity'],
      title:       `Account Health: ${row.health}`,
      description: `Account "${row.name}" has a ${row.health} health status and requires attention.`,
      accountId:   row.id,
      accountName: row.name,
      createdAt:   nowIso,
    }));
  }

  private async getOpportunityAlerts(f: NormalizedFilter): Promise<Alert[]> {
    const { joinCond, params: baseParams, nextIdx } = this.buildJoin('a', f, 1);
    const nowIso = new Date().toISOString();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr       = today.toISOString().split('T')[0];
    const closingSoonStr = new Date(today.getTime() + DAYS_CLOSING_SOON * 86_400_000).toISOString().split('T')[0];
    const noActivityCut  = new Date(today.getTime() - DAYS_NO_ACTIVITY * 86_400_000).toISOString();

    const [closingResult, noActivityResult] = await Promise.all([
      this.db.query(
        `SELECT o.id, o.name, o.allocation_end_date, a.id AS account_id, a.name AS account_name
         FROM opportunities o
         INNER JOIN accounts a ON o.account_id = a.id AND a.is_deleted = FALSE ${joinCond}
         WHERE o.is_deleted = FALSE
           AND o.stage != 'Won'
           AND o.allocation_end_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
           AND o.allocation_end_date::DATE BETWEEN $${nextIdx}::DATE AND $${nextIdx + 1}::DATE
         ORDER BY o.allocation_end_date ASC`,
        [...baseParams, todayStr, closingSoonStr],
      ),
      this.db.query(
        `SELECT o.id, o.name, o.stage, a.id AS account_id, a.name AS account_name,
                MAX(act.created_at) AS last_activity
         FROM opportunities o
         INNER JOIN accounts a ON o.account_id = a.id AND a.is_deleted = FALSE ${joinCond}
         LEFT JOIN activities act ON act.opportunity_id = o.id
         WHERE o.is_deleted = FALSE AND o.stage != 'Won'
         GROUP BY o.id, o.name, o.stage, a.id, a.name
         HAVING MAX(act.created_at) < $${nextIdx} OR MAX(act.created_at) IS NULL`,
        [...baseParams, noActivityCut],
      ),
    ]);

    const closingIds = new Set(closingResult.rows.map(r => r.id as string));
    const alerts: Alert[] = [];

    for (const row of closingResult.rows) {
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(row.allocation_end_date).getTime() - today.getTime()) / 86_400_000),
      );
      alerts.push({
        id:              `closing-opp-${row.id}`,
        type:            'OpportunityClosingSoon',
        severity:        daysLeft <= 2 ? 'high' : 'medium',
        title:           'Opportunity Closing Soon',
        description:     `"${row.name}" closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${row.allocation_end_date}).`,
        accountId:       row.account_id,
        accountName:     row.account_name,
        opportunityId:   row.id,
        opportunityName: row.name,
        dueDate:         row.allocation_end_date,
        createdAt:       nowIso,
      });
    }

    for (const row of noActivityResult.rows) {
      if (closingIds.has(row.id)) continue;
      const lastActivity = row.last_activity
        ? new Date(row.last_activity).toLocaleDateString()
        : 'never';
      alerts.push({
        id:              `noactivity-opp-${row.id}`,
        type:            'OpportunityNoActivity',
        severity:        'low',
        title:           'No Recent Activity',
        description:     `"${row.name}" has had no activity in ${DAYS_NO_ACTIVITY}+ days (last: ${lastActivity}).`,
        accountId:       row.account_id,
        accountName:     row.account_name,
        opportunityId:   row.id,
        opportunityName: row.name,
        createdAt:       nowIso,
      });
    }

    return alerts;
  }
}
