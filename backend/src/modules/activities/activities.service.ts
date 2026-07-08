import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
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
  ) {}

  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Activity[] | Paginated<Activity>> {
    const f = this.filter.normalize(params);

    // The activity feed is operational data — always accessible, never
    // fiscal-period-filtered. Owner scoping goes through the parent account;
    // activities with no account_id are included only when their user_id
    // matches the requesting user (so each user sees their own global activities).
    const owner = this.filter.buildOwnerConditions('a', f, 1);
    const conditions = owner.conditions.map(
      (c) => `(${c} OR (act.account_id IS NULL AND act.user_id = $1))`,
    );
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalCol    = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${owner.nextIdx} OFFSET $${owner.nextIdx + 1}` : '';
    const qParams     = pg ? [...owner.params, pg.limit, pg.offset] : owner.params;

    const { rows } = await this.db.query(
      `SELECT act.*, u.name AS user_display_name${totalCol}
       FROM activities act
       LEFT JOIN accounts a ON act.account_id = a.id
       LEFT JOIN users    u ON act.user_id    = u.id
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
