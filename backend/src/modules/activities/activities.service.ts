import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { Activity } from '../../types';
import { toIsoString } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';

function rowToActivity(row: any): Activity {
  const { user_name, user_id, user_display_name, account_id, opportunity_id, created_at, ...base } = row;
  return {
    ...base,
    // Prefer the JOIN-derived display name; fall back to the stored user_name text
    user:          user_display_name ?? user_name ?? 'System',
    accountId:     account_id     ?? undefined,
    opportunityId: opportunity_id ?? undefined,
    timestamp:     toIsoString(created_at),
  } as Activity;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly access: AccessScopeService,
  ) {}

  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Activity[] | Paginated<Activity>> {
    const f = this.filter.normalize(params);

    // The activity feed is operational data — always accessible, never
    // fiscal-period-filtered. Row-scoped visibility (role-aware): an activity is
    // visible when EITHER its parent account is visible to the user OR it is the
    // user's own activity (user_id = the requester). A view-all user gets no
    // restriction; when no userId is supplied, no scoping is applied.
    const conditions: string[] = [];
    const scopeParams: any[] = [];
    let nextIdx = 1;

    if (f.userId) {
      const ctx = await this.access.getContext(f.userId);
      const vis = this.access.buildChildVisibility('act', ctx, 1);
      if (vis.conditions.length > 0) {
        conditions.push(`(${vis.conditions.join(' AND ')} OR act.user_id = $${vis.nextIdx})`);
        scopeParams.push(...vis.params, f.userId);
        nextIdx = vis.nextIdx + 1;
      }
      // else view-all: no restriction
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalCol    = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${nextIdx} OFFSET $${nextIdx + 1}` : '';
    const qParams     = pg ? [...scopeParams, pg.limit, pg.offset] : scopeParams;

    const { rows } = await this.db.query(
      `SELECT act.*, u.name AS user_display_name${totalCol}
       FROM activities act
       LEFT JOIN users u ON act.user_id = u.id
       ${where}
       ORDER BY act.created_at DESC${limitClause}`,
      qParams,
    );
    if (!pg) return rows.map(rowToActivity);

    const total = extractTotal(rows);
    return { data: rows.map(rowToActivity), total, page: pg.page, pageSize: pg.pageSize };
  }

  async create(data: any): Promise<Activity> {
    const { rows } = await this.db.query(
      `INSERT INTO activities (id, type, text, user_id, user_name, account_id, opportunity_id)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        data.type,
        data.text,
        data.userId  ?? null,          // UUID FK (preferred)
        data.user    ?? 'System',      // display name (backward compat)
        data.accountId     ?? null,
        data.opportunityId ?? null,
      ],
    );
    return rowToActivity(rows[0]);
  }
}
