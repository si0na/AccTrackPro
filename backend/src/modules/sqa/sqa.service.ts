import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectHealthService, ProjectWeeklyHealth } from '../projects/project-health.service';
import { SqaAvailableProject, SqaRecord, SqaTrackerSnapshot } from '../../types';
import { extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';
import { isoWeekOf, trailingIsoWeeks } from '../../common/utils/iso-week.util';

/** Default and maximum width of the weekly health window. */
export const DEFAULT_HEALTH_WEEKS = 3;
export const MAX_HEALTH_WEEKS = 52;

/**
 * Fixed schema fields — anything else in the request body is a dynamic
 * custom-column value routed into custom_data. Includes the derived/read-only
 * fields the frontend echoes back on save (accountName, pmName, revenue, …) so
 * inherited values are never mistaken for custom columns and duplicated into
 * custom_data.
 */
const KNOWN = new Set([
  'id', 'projectId', 'projectName', 'projectStatus', 'projectHealth',
  'accountId', 'accountName', 'opportunityId', 'opportunityName',
  'ownerId', 'ownerName', 'startDate', 'endDate',
  'importance', 'deliveryModel',
  'billingModel', 'billingModelOverride', 'billingModelInherited',
  'tower', 'towerOverride', 'towerInherited',
  'fte', 'fteOverride', 'fteInherited',
  'revenue', 'revenueOverride', 'revenueInherited', 'revenueSource', 'revenueInheritedSource',
  'pmId', 'pmName', 'clientPmName', 'teamMemberCount',
  'wsrPublished', 'clientEscalation',
  'currentWeekUpdate', 'nextWeekPlan', 'issuesChallenges', 'pathToGreen',
  'resourcingStatus', 'currentSdlcPhase', 'sqaRemarks',
  'weeklyHealth', 'createdAt', 'updatedAt',
]);

const num = (v: any): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);

/**
 * Maps a joined row to the API shape.
 *
 * The SQA table stores almost nothing: Account, Project, PM, Revenue, Billing
 * Model and Tower all arrive on the row from the JOINed Project / Opportunity /
 * Account. For the four fields SQA may legitimately restate, the response
 * carries three values so the UI can show provenance rather than guessing:
 * `<field>Inherited` (what the application already knows), `<field>Override`
 * (what SQA said instead, if anything) and `<field>` (the effective value).
 */
/** What a project supplies to an SQA record, before any SQA override. */
export interface SqaInheritedValues {
  billingModelInherited?: string;
  towerInherited?: string;
  serviceLineInherited?: string;
  revenueInherited?: number;
  revenueInheritedSource: 'project' | 'opportunity' | 'none';
  fteInherited?: number;
  teamMemberCount: number;
}

/**
 * The inheritance rules, in one place.
 *
 * Used both by the record mapper and by the Create form's project preview, so
 * the values a user sees before saving are computed by exactly the same code
 * that will serve the saved record — the frontend never re-derives them.
 */
function deriveInherited(row: any): SqaInheritedValues {
  // Project Deal Value first, then the originating Opportunity's value — the
  // project figure is the later, delivery-side number where both exist.
  const projectDealValue = num(row.project_deal_value);
  const opportunityValue = num(row.opportunity_value);
  // Team size is the only FTE-shaped figure the application holds; 0 means
  // "no team recorded", which is an absent source rather than an FTE of zero.
  const teamMemberCount = Number(row.team_member_count ?? 0);
  return {
    billingModelInherited: row.project_billing_model ?? row.opportunity_billing_model ?? undefined,
    towerInherited: row.project_tower ?? row.opportunity_tower ?? row.account_tower ?? undefined,
    serviceLineInherited: row.service_line ?? undefined,
    revenueInherited: projectDealValue ?? opportunityValue,
    revenueInheritedSource: projectDealValue !== undefined
      ? 'project'
      : opportunityValue !== undefined ? 'opportunity' : 'none',
    fteInherited: teamMemberCount > 0 ? teamMemberCount : undefined,
    teamMemberCount,
  };
}

function rowToSqaRecord(row: any): SqaRecord {
  const {
    billingModelInherited, towerInherited,
    revenueInherited, revenueInheritedSource,
    fteInherited, teamMemberCount,
  } = deriveInherited(row);
  const revenueOverride = num(row.revenue_override);
  const fteOverride = num(row.fte_override);

  return {
    id: row.id,

    // ── Inherited through the Project relationship (never stored on SQA) ──────
    projectId: row.project_id,
    projectName: row.project_name ?? undefined,
    projectStatus: row.project_status ?? undefined,
    projectHealth: row.project_health ?? undefined,
    accountId: row.account_id,
    accountName: row.account_name ?? undefined,
    opportunityId: row.opportunity_id ?? undefined,
    opportunityName: row.opportunity_name ?? undefined,
    serviceLine: row.service_line ?? undefined,
    serviceLineInherited: row.service_line ?? undefined,
    pmId: row.service_provider_pm_id ?? undefined,
    pmName: row.pm_name ?? undefined,
    clientPmName: row.client_pm_name ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    teamMemberCount,

    ownerId: row.owner_id ?? undefined,
    ownerName: row.owner_name ?? undefined,

    // ── SQA's own ────────────────────────────────────────────────────────────
    importance: row.importance,
    deliveryModel: row.delivery_model ?? undefined,

    // ── Inherited, with an SQA override ──────────────────────────────────────
    billingModel: row.billing_model_override ?? billingModelInherited,
    billingModelOverride: row.billing_model_override ?? undefined,
    billingModelInherited,
    tower: row.tower_override ?? towerInherited,
    towerOverride: row.tower_override ?? undefined,
    towerInherited,
    fte: fteOverride ?? fteInherited,
    fteOverride,
    fteInherited,
    revenue: revenueOverride ?? revenueInherited,
    revenueOverride,
    revenueInherited,
    // Two distinct questions the UI asks: which value is in force, and where
    // the inherited number came from (still meaningful under an override).
    revenueSource: revenueOverride !== undefined ? 'sqa' : revenueInheritedSource,
    revenueInheritedSource,

    // ── SQA weekly tracking ──────────────────────────────────────────────────
    wsrPublished: row.wsr_published,
    clientEscalation: row.client_escalation,
    currentWeekUpdate: row.current_week_update,
    nextWeekPlan: row.next_week_plan,
    issuesChallenges: row.issues_challenges,
    pathToGreen: row.path_to_green,
    resourcingStatus: row.resourcing_status ?? undefined,
    currentSdlcPhase: row.current_sdlc_phase ?? undefined,
    sqaRemarks: row.sqa_remarks,

    // Filled in by attachWeeklyHealth(); an empty window until then.
    weeklyHealth: [],

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.custom_data || {}),
  } as SqaRecord;
}

/**
 * Every inherited value the API exposes, resolved in SQL. `p.deal_value` is
 * aliased so it can never collide with the SQA row's own columns spread by `s.*`.
 *
 * @param opts.accountJoin `'inner'` for the active list (a row whose account was
 *   deactivated must not appear); `'left'` for findOne/deactivated, where the
 *   parent may itself be deactivated and the row still has to be readable.
 * @param opts.withTotal adds the window-function count backing the paginated
 *   envelope.
 */
function sqaSelect(opts: { accountJoin: 'inner' | 'left'; withTotal?: boolean }): string {
  const accountJoin = opts.accountJoin === 'inner' ? 'INNER JOIN' : 'LEFT  JOIN';
  const totalCol = opts.withTotal ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
  return `
  SELECT s.*${totalCol},
         p.name        AS project_name,
         p.status      AS project_status,
         p.health      AS project_health,
         p.tower       AS project_tower,
         p.account_id  AS account_id,
         p.opportunity_id,
         p.start_date, p.end_date,
         p.deal_value  AS project_deal_value,
         p.service_provider_pm_id,
         p.client_pm_name,
         p.billing_model AS project_billing_model,
         pm.name       AS pm_name,
         a.name        AS account_name,
         a.tower       AS account_tower,
         o.name        AS opportunity_name,
         o.value       AS opportunity_value,
         o.billing_model AS opportunity_billing_model,
         o.tower       AS opportunity_tower,
         o.service_line,
         ou.name       AS owner_name,
         (SELECT COUNT(*) FROM project_team_members ptm WHERE ptm.project_id = p.id)::INTEGER
           AS team_member_count
  FROM sqa_records s
  INNER JOIN projects      p  ON s.project_id = p.id
  ${accountJoin} accounts      a  ON p.account_id = a.id
  LEFT  JOIN opportunities o  ON p.opportunity_id = o.id
  LEFT  JOIN users         pm ON p.service_provider_pm_id = pm.id
  LEFT  JOIN users         ou ON s.owner_id = ou.id
`;
}

/** Read path for a single record / the deactivated list. */
const SQA_SELECT = sqaSelect({ accountJoin: 'left' });

/** Fields written straight through from the request body to the row. */
interface SqaWritable {
  importance?: string;
  deliveryModel?: string;
  billingModelOverride?: string;
  towerOverride?: string;
  fteOverride?: number;
  revenueOverride?: number;
  wsrPublished?: boolean;
  clientEscalation?: boolean;
  currentWeekUpdate?: string;
  nextWeekPlan?: string;
  issuesChallenges?: string;
  pathToGreen?: string;
  resourcingStatus?: string;
  currentSdlcPhase?: string;
  sqaRemarks?: string;
  weeklyHealth?: Array<{ isoYear: number; weekNumber: number; health: string }>;
}

@Injectable()
export class SqaService {
  private readonly logger = new Logger(SqaService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly projects: ProjectsService,
    private readonly projectHealth: ProjectHealthService,
  ) {}

  /** Clamp a caller-supplied `?weeks=` to a sane window. */
  static normalizeWeeks(weeks?: string | number): number {
    const n = Number(weeks);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_HEALTH_WEEKS;
    return Math.min(Math.floor(n), MAX_HEALTH_WEEKS);
  }

  /** The ISO weeks the current window covers — the "Health Week NN" columns. */
  weekWindow(weeks: number) {
    return trailingIsoWeeks(weeks);
  }

  /**
   * Auto-provisions SQA records for any active projects that do not have one yet,
   * ensuring every project in the system automatically appears in SQA.
   */
  async autoProvisionSqaRecords(): Promise<void> {
    try {
      await this.db.query(
        `UPDATE sqa_records SET is_deleted = FALSE, updated_at = NOW()
         WHERE is_deleted = TRUE
           AND project_id IN (SELECT id FROM projects WHERE is_deleted = FALSE)`,
      );

      await this.db.query(
        `INSERT INTO sqa_records
           (id, project_id, owner_id, importance, wsr_published, client_escalation,
            current_week_update, next_week_plan, issues_challenges, path_to_green, sqa_remarks)
         SELECT
           gen_random_uuid()::TEXT, p.id, p.owner_id, 'Medium', FALSE, FALSE,
           '', '', '', '', ''
         FROM projects p
         WHERE p.is_deleted = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM sqa_records s
             WHERE s.project_id = p.id AND s.is_deleted = FALSE
           )`,
      );
    } catch (err) {
      this.logger.error('Failed to auto-provision SQA records for projects', err);
    }
  }

  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
    weeks: number = DEFAULT_HEALTH_WEEKS,
  ): Promise<SqaRecord[] | Paginated<SqaRecord>> {
    await this.autoProvisionSqaRecords();
    const f = this.filter.normalize(params);
    const owner = this.filter.buildOwnerConditions('s', f, 1);
    const where = [
      's.is_deleted = FALSE',
      'p.is_deleted = FALSE',
      'a.is_deleted = FALSE',
      ...owner.conditions,
    ].join(' AND ');

    const limitClause = pg ? ` LIMIT $${owner.nextIdx} OFFSET $${owner.nextIdx + 1}` : '';
    const qParams = pg ? [...owner.params, pg.limit, pg.offset] : owner.params;

    const { rows } = await this.db.query(
      `${sqaSelect({ accountJoin: 'inner', withTotal: !!pg })}
       WHERE ${where}
       ORDER BY s.updated_at DESC${limitClause}`,
      qParams,
    );

    const records = rows.map(rowToSqaRecord);
    if (!pg) {
      await this.attachWeeklyHealth(records, weeks);
      return records;
    }

    const total = extractTotal(rows);
    await this.attachWeeklyHealth(records, weeks);
    return { data: records, total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(
    id: string,
    userId?: string,
    weeks: number = DEFAULT_HEALTH_WEEKS,
  ): Promise<SqaRecord> {
    const { rows } = await this.db.query(
      `${SQA_SELECT} WHERE s.id = $1 AND s.is_deleted = FALSE
       AND ($2::TEXT IS NULL OR s.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`SQA record "${id}" not found`);
    const record = rowToSqaRecord(rows[0]);
    await this.attachWeeklyHealth([record], weeks);
    return record;
  }

  async findAllDeactivated(params: FilterParams = {}): Promise<SqaRecord[]> {
    const f = this.filter.normalize(params);
    const owner = this.filter.buildOwnerConditions('s', f, 1);
    const where = ['s.is_deleted = TRUE', ...owner.conditions].join(' AND ');
    const { rows } = await this.db.query(
      `${SQA_SELECT} WHERE ${where} ORDER BY s.updated_at DESC`,
      owner.params,
    );
    // No weekly window for the deactivated list — it shows identity only.
    return rows.map(rowToSqaRecord);
  }

  async create(data: any, userId: string, weeks = DEFAULT_HEALTH_WEEKS): Promise<SqaRecord> {
    const projectId = String(data.projectId ?? '').trim();
    if (!projectId) throw new BadRequestException('Project is required');
    // Authoritative relational + visibility check in one: the project must exist,
    // be active, and belong to the requesting user.
    await this.assertProjectVisible(projectId, userId);

    const cd = extractCustomData(data, KNOWN);
    const w = this.writable(data);

    const { rows } = await this.db.query(
      `INSERT INTO sqa_records
         (project_id, owner_id, importance, delivery_model,
          billing_model_override, tower_override, fte_override, revenue_override,
          wsr_published, client_escalation,
          current_week_update, next_week_plan, issues_challenges, path_to_green,
          resourcing_status, current_sdlc_phase, sqa_remarks, custom_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        projectId, userId, w.importance ?? 'Medium', w.deliveryModel ?? null,
        w.billingModelOverride ?? null, w.towerOverride ?? null,
        w.fteOverride ?? null, w.revenueOverride ?? null,
        w.wsrPublished ?? false, w.clientEscalation ?? false,
        w.currentWeekUpdate ?? '', w.nextWeekPlan ?? '',
        w.issuesChallenges ?? '', w.pathToGreen ?? '',
        w.resourcingStatus ?? null, w.currentSdlcPhase ?? null,
        w.sqaRemarks ?? '', JSON.stringify(cd),
      ],
    ).catch((err) => { throw this.mapProjectConflict(err); });

    const id = rows[0].id as string;
    await this.applyWeeklyHealth(projectId, w.weeklyHealth, weeks, userId);
    const record = await this.findOne(id, undefined, weeks);
    await this.upsertTrackerSnapshot(record, userId);
    this.logger.log(`SQA record created [id=${id} projectId=${projectId}]`);
    await this.log(`Created SQA record for '${record.projectName}'`, record.accountId, userId);
    return record;
  }

  async update(id: string, data: any, userId?: string, weeks = DEFAULT_HEALTH_WEEKS): Promise<SqaRecord> {
    const existing = await this.findOne(id, userId, weeks);

    // Re-pointing a record at a different project would silently change which
    // account, PM and revenue it reports on. Deactivate and create instead.
    if (data.projectId && data.projectId !== existing.projectId) {
      throw new BadRequestException(
        'An SQA record cannot be moved to a different project. Create a new SQA record for that project instead.',
      );
    }

    const cd = extractCustomData(data, KNOWN);
    const w = this.writable(data);

    await this.db.query(
      `UPDATE sqa_records SET
         importance = $1, delivery_model = $2,
         billing_model_override = $3, tower_override = $4,
         fte_override = $5, revenue_override = $6,
         wsr_published = $7, client_escalation = $8,
         current_week_update = $9, next_week_plan = $10,
         issues_challenges = $11, path_to_green = $12,
         resourcing_status = $13, current_sdlc_phase = $14, sqa_remarks = $15,
         custom_data = $16, updated_at = NOW()
       WHERE id = $17 AND is_deleted = FALSE`,
      [
        w.importance ?? existing.importance, w.deliveryModel ?? null,
        w.billingModelOverride ?? null, w.towerOverride ?? null,
        w.fteOverride ?? null, w.revenueOverride ?? null,
        w.wsrPublished ?? false, w.clientEscalation ?? false,
        w.currentWeekUpdate ?? '', w.nextWeekPlan ?? '',
        w.issuesChallenges ?? '', w.pathToGreen ?? '',
        w.resourcingStatus ?? null, w.currentSdlcPhase ?? null,
        w.sqaRemarks ?? '', JSON.stringify(cd),
        id,
      ],
    );

    await this.applyWeeklyHealth(existing.projectId, w.weeklyHealth, weeks, userId, existing.weeklyHealth);
    const record = await this.findOne(id, undefined, weeks);
    await this.upsertTrackerSnapshot(record, userId);
    await this.log(`Updated SQA record for '${record.projectName}'`, record.accountId, userId);
    return record;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const record = await this.findOne(id, userId);
    await this.db.query(
      `UPDATE sqa_records SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await this.log(`Deactivated SQA record for '${record.projectName}'`, record.accountId, userId);
    return { success: true };
  }

  async restore(id: string, userId?: string, weeks = DEFAULT_HEALTH_WEEKS): Promise<SqaRecord> {
    const { rows: existing } = await this.db.query(
      `SELECT s.id, p.is_deleted AS project_deleted
       FROM sqa_records s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1 AND s.is_deleted = TRUE
       AND ($2::TEXT IS NULL OR s.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!existing.length) throw new NotFoundException(`Deactivated SQA record "${id}" not found`);
    // Business rule shared with every other module: no active child under a
    // deactivated parent.
    if (existing[0].project_deleted) {
      throw new ConflictException('Please restore the associated Project before restoring this SQA record.');
    }
    const { rows } = await this.db.query(
      `UPDATE sqa_records SET is_deleted = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_deleted = TRUE RETURNING id`,
      [id],
    ).catch((err) => { throw this.mapProjectConflict(err); });
    if (!rows.length) throw new NotFoundException(`Deactivated SQA record "${id}" not found`);
    const record = await this.findOne(id, undefined, weeks);
    await this.log(`Restored SQA record for '${record.projectName}'`, record.accountId, userId);
    return record;
  }

  /**
   * Sets one week's RAG value on the record's project. Writes into the existing
   * project health trail — SQA keeps no health of its own — and returns the
   * refreshed record so the caller's weekly columns update in one round-trip.
   */
  async setWeekHealth(
    id: string,
    week: { isoYear: number; weekNumber: number; health: string },
    userId?: string,
    weeks = DEFAULT_HEALTH_WEEKS,
  ): Promise<SqaRecord> {
    const record = await this.findOne(id, userId, weeks);
    await this.projectHealth.setWeekHealth(record.projectId, week, week.health, userId);
    const refreshed = await this.findOne(id, undefined, weeks);
    await this.upsertTrackerSnapshot(refreshed, userId);
    return refreshed;
  }

  /**
   * Projects still eligible for a new SQA record — the requesting user's active
   * projects without one. Backs the Create form's Project picker, so the
   * one-record-per-project rule shows up as a missing option rather than a 409
   * after the fact, and carries the inherited preview (account, PM, revenue,
   * billing model, tower, FTE) so the form can show what the record will pick
   * up without the frontend re-implementing the inheritance rules.
   */
  async findAvailableProjects(userId: string): Promise<SqaAvailableProject[]> {
    const { rows } = await this.db.query(
      `SELECT p.id, p.name, p.account_id, p.health AS project_health,
              p.client_pm_name, p.deal_value AS project_deal_value,
              p.billing_model AS project_billing_model,
              a.name  AS account_name,
              pm.name AS pm_name,
              o.value AS opportunity_value,
              o.billing_model AS opportunity_billing_model, o.service_line,
              (SELECT COUNT(*) FROM project_team_members ptm WHERE ptm.project_id = p.id)::INTEGER
                AS team_member_count
       FROM projects p
       INNER JOIN accounts      a  ON p.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN opportunities o  ON p.opportunity_id = o.id
       LEFT  JOIN users         pm ON p.service_provider_pm_id = pm.id
       WHERE p.is_deleted = FALSE
         AND ($1::TEXT IS NULL OR p.owner_id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM sqa_records s
           WHERE s.project_id = p.id AND s.is_deleted = FALSE
         )
       ORDER BY p.name ASC`,
      [userId ?? null],
    );
    return rows.map((r) => {
      const inherited = deriveInherited(r);
      return {
        id: r.id,
        name: String(r.name ?? '').replace(/ — Project$/, ''),
        accountId: r.account_id,
        accountName: r.account_name ?? '',
        projectHealth: r.project_health ?? undefined,
        pmName: r.pm_name ?? undefined,
        clientPmName: r.client_pm_name ?? undefined,
        billingModelInherited: inherited.billingModelInherited,
        towerInherited: inherited.towerInherited,
        revenueInherited: inherited.revenueInherited,
        revenueInheritedSource: inherited.revenueInheritedSource,
        fteInherited: inherited.fteInherited,
        teamMemberCount: inherited.teamMemberCount,
      };
    });
  }

  async findTrackerHistory(
    sqaRecordId?: string,
    params: FilterParams = {},
    pagination?: Pagination,
  ): Promise<Paginated<SqaTrackerSnapshot> | SqaTrackerSnapshot[]> {
    let where = `WHERE p.is_deleted = FALSE`;
    const args: any[] = [];

    if (params.userId) {
      args.push(params.userId);
      where += ` AND p.owner_id = $${args.length}`;
    }

    if (sqaRecordId) {
      args.push(sqaRecordId);
      where += ` AND s.sqa_record_id = $${args.length}`;
    }

    const countSql = `
      SELECT COUNT(*)
      FROM sqa_tracker_snapshots s
      INNER JOIN projects p ON s.project_id = p.id
      INNER JOIN accounts a ON s.account_id = a.id
      ${where}
    `;

    let selectTotal = '';
    let limitSql = '';
    if (pagination) {
      selectTotal = `, COUNT(*) OVER() AS __total`;
      const limit = pagination.pageSize;
      const offset = (pagination.page - 1) * pagination.pageSize;
      args.push(limit, offset);
      limitSql = ` LIMIT $${args.length - 1} OFFSET $${args.length}`;
    }

    const sql = `
      SELECT s.*, p.name AS project_name, a.name AS account_name${selectTotal}
      FROM sqa_tracker_snapshots s
      INNER JOIN projects p ON s.project_id = p.id
      INNER JOIN accounts a ON s.account_id = a.id
      ${where}
      ORDER BY s.iso_year DESC, s.week_number DESC, s.created_at DESC
      ${limitSql}
    `;

    const { rows } = await this.db.query(sql, args);
    const total = pagination ? extractTotal(rows) : rows.length;

    const data: SqaTrackerSnapshot[] = rows.map((r) => ({
      id: r.id,
      sqaRecordId: r.sqa_record_id,
      projectId: r.project_id,
      projectName: r.project_name,
      accountId: r.account_id,
      accountName: r.account_name,
      snapshotDate: r.snapshot_date ? (typeof r.snapshot_date === 'string' ? r.snapshot_date.slice(0, 10) : r.snapshot_date.toISOString().slice(0, 10)) : '',
      isoYear: Number(r.iso_year),
      weekNumber: Number(r.week_number),
      importance: r.importance,
      deliveryModel: r.delivery_model ?? undefined,
      billingModel: r.billing_model ?? undefined,
      billingModelOverride: r.billing_model_override ?? undefined,
      tower: r.tower ?? undefined,
      towerOverride: r.tower_override ?? undefined,
      fte: r.fte !== null && r.fte !== undefined ? Number(r.fte) : undefined,
      fteOverride: r.fte_override !== null && r.fte_override !== undefined ? Number(r.fte_override) : undefined,
      revenue: r.revenue !== null && r.revenue !== undefined ? Number(r.revenue) : undefined,
      revenueOverride: r.revenue_override !== null && r.revenue_override !== undefined ? Number(r.revenue_override) : undefined,
      pmName: r.pm_name ?? undefined,
      wsrPublished: Boolean(r.wsr_published),
      healthStatus: r.health_status ?? undefined,
      clientEscalation: Boolean(r.client_escalation),
      currentWeekUpdate: r.current_week_update || '',
      nextWeekPlan: r.next_week_plan || '',
      issuesChallenges: r.issues_challenges || '',
      pathToGreen: r.path_to_green || '',
      resourcingStatus: r.resourcing_status ?? undefined,
      currentSdlcPhase: r.current_sdlc_phase ?? undefined,
      sqaRemarks: r.sqa_remarks || '',
      updatedById: r.updated_by_id ?? undefined,
      updatedByName: r.updated_by_name ?? undefined,
      createdAt: r.created_at ? (typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString()) : '',
      updatedAt: r.updated_at ? (typeof r.updated_at === 'string' ? r.updated_at : r.updated_at.toISOString()) : '',
    }));

    if (pagination) {
      return { data, total, page: pagination.page, pageSize: pagination.pageSize };
    }
    return data;
  }

  private async upsertTrackerSnapshot(record: SqaRecord, userId?: string): Promise<void> {
    try {
      const now = new Date();
      const iso = isoWeekOf(now);

      let updatedByName: string | undefined = undefined;
      if (userId) {
        const { rows } = await this.db.query(`SELECT name FROM users WHERE id = $1`, [userId]);
        if (rows.length) updatedByName = rows[0].name;
      }

      let healthStatus: string | null = record.projectHealth ?? null;
      if (record.weeklyHealth && record.weeklyHealth.length > 0) {
        const matchingWeek = record.weeklyHealth.find(
          (w) => w.isoYear === iso.isoYear && w.weekNumber === iso.weekNumber,
        );
        if (matchingWeek && matchingWeek.health) {
          healthStatus = matchingWeek.health;
        } else {
          const sortedWeeks = [...record.weeklyHealth].sort(
            (a, b) => (a.isoYear * 100 + a.weekNumber) - (b.isoYear * 100 + b.weekNumber),
          );
          if (sortedWeeks.length > 0 && sortedWeeks[sortedWeeks.length - 1].health) {
            healthStatus = sortedWeeks[sortedWeeks.length - 1].health;
          }
        }
      }

      await this.db.query(
        `INSERT INTO sqa_tracker_snapshots (
           sqa_record_id, project_id, account_id,
           snapshot_date, iso_year, week_number,
           importance, delivery_model, billing_model, billing_model_override,
           tower, tower_override, fte, fte_override,
           revenue, revenue_override, pm_name,
           wsr_published, health_status, client_escalation,
           current_week_update, next_week_plan, issues_challenges, path_to_green,
           resourcing_status, current_sdlc_phase, sqa_remarks,
           updated_by_id, updated_by_name, created_at, updated_at
         )
         VALUES (
           $1, $2, $3,
           CURRENT_DATE, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16,
           $17, $18, $19,
           $20, $21, $22, $23,
           $24, $25, $26,
           $27, $28, NOW(), NOW()
         )`,
        [
          record.id, record.projectId, record.accountId ?? null,
          iso.isoYear, iso.weekNumber,
          record.importance ?? 'Medium', record.deliveryModel ?? null,
          record.billingModel ?? null, record.billingModelOverride ?? null,
          record.tower ?? null, record.towerOverride ?? null,
          record.fte ?? null, record.fteOverride ?? null,
          record.revenue ?? null, record.revenueOverride ?? null,
          record.pmName ?? null,
          record.wsrPublished ?? false, healthStatus, record.clientEscalation ?? false,
          record.currentWeekUpdate ?? '', record.nextWeekPlan ?? '',
          record.issuesChallenges ?? '', record.pathToGreen ?? '',
          record.resourcingStatus ?? null, record.currentSdlcPhase ?? null,
          record.sqaRemarks ?? '',
          userId ?? record.ownerId ?? null, updatedByName ?? null,
        ],
      );
    } catch (err) {
      this.logger.error(`Failed to upsert SQA tracker snapshot for record ${record.id}:`, err);
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  /** Narrows a raw body to the fields this table actually stores. */
  private writable(data: any): SqaWritable {
    return {
      importance: data.importance,
      deliveryModel: data.deliveryModel,
      billingModelOverride: data.billingModelOverride,
      towerOverride: data.towerOverride,
      fteOverride: data.fteOverride,
      revenueOverride: data.revenueOverride,
      wsrPublished: data.wsrPublished,
      clientEscalation: data.clientEscalation,
      currentWeekUpdate: data.currentWeekUpdate,
      nextWeekPlan: data.nextWeekPlan,
      issuesChallenges: data.issuesChallenges,
      pathToGreen: data.pathToGreen,
      resourcingStatus: data.resourcingStatus,
      currentSdlcPhase: data.currentSdlcPhase,
      sqaRemarks: data.sqaRemarks,
      weeklyHealth: Array.isArray(data.weeklyHealth) ? data.weeklyHealth : undefined,
    };
  }

  /** Fills each record's weekly health window from the project health trail. */
  private async attachWeeklyHealth(records: SqaRecord[], weeks: number): Promise<void> {
    if (!records.length) return;
    const projectIds = [...new Set(records.map((r) => r.projectId))];
    const byProject = await this.projectHealth.weeklyHealthByProject(projectIds, weeks);
    for (const record of records) {
      record.weeklyHealth = (byProject.get(record.projectId) ?? []) as ProjectWeeklyHealth[];
    }
  }

  /**
   * Applies the weekly RAG values submitted with the form.
   *
   * Only weeks whose value actually differs from what the trail already reports
   * are written, so re-saving a record does not stamp a fresh "edited" marker
   * across the project's health history. `current` is the window as loaded
   * before the save (absent on create, where nothing has been shown yet and
   * every submitted week is compared against the freshly-read trail).
   */
  private async applyWeeklyHealth(
    projectId: string,
    submitted: SqaWritable['weeklyHealth'],
    weeks: number,
    userId?: string,
    current?: ProjectWeeklyHealth[],
  ): Promise<void> {
    if (!submitted?.length) return;

    const baseline = current?.length
      ? current
      : (await this.projectHealth.weeklyHealthByProject([projectId], weeks)).get(projectId) ?? [];
    const currentByWeek = new Map(
      baseline.map((w) => [`${w.isoYear}-${w.weekNumber}`, w]),
    );

    for (const week of submitted) {
      const existing = currentByWeek.get(`${week.isoYear}-${week.weekNumber}`);
      // A carried-forward week has no entry of its own: recording the same RAG
      // explicitly is a real change (it pins the week), so only an entry-backed
      // week with an identical value is skipped.
      if (existing && !existing.carriedForward && existing.health === week.health) continue;
      await this.projectHealth.setWeekHealth(
        projectId,
        { isoYear: week.isoYear, weekNumber: week.weekNumber },
        week.health,
        userId,
      );
    }
  }

  /** Relational rule: the project must exist, be active, and be visible to the user. */
  private async assertProjectVisible(projectId: string, userId?: string): Promise<void> {
    try {
      await this.projects.findOne(projectId, userId);
    } catch {
      throw new BadRequestException('The selected project does not exist');
    }
  }

  /** Maps the uq_sqa_project unique-index violation to a friendly 409. */
  private mapProjectConflict(err: any): any {
    if (err?.code === '23505' && String(err?.constraint ?? '').includes('uq_sqa_project')) {
      return new ConflictException('An SQA record already exists for this project.');
    }
    return err;
  }

  private async log(text: string, accountId?: string, userId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'sqa', $1, $2, 'System', $3)`,
        [text, userId ?? null, accountId ?? null],
      );
    } catch (err) {
      this.logger.error(
        `Failed to write activity log [text="${text}"]`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
