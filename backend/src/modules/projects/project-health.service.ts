import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';
import { CreateProjectHealthDto, UpdateProjectHealthDto } from './dto/project-health.dto';
import { insertHealthHistory } from './project-health-history.util';
import { ProjectHealth } from '../../types';
import {
  IsoWeek, isoWeekKey, isoWeekOf, isoWeekStart, isoWeekStartOf, trailingIsoWeeks,
} from '../../common/utils/iso-week.util';

const TABLE = 'project_health_updates';

/** One ISO week of a project's health trail — see weeklyHealthByProject(). */
export interface ProjectWeeklyHealth extends IsoWeek {
  /** e.g. "Week 31". */
  label: string;
  /** RAG for the week; null only when the project has no health entry at or before it. */
  health: ProjectHealth | null;
  /** True when no entry falls in this week and the previous week's RAG carries over. */
  carriedForward: boolean;
  /** The project_health_updates row backing this week, when one exists. */
  entryId?: string;
  statusSummary?: string;
}

/**
 * Newest first. `id` breaks created_at ties so "the latest entry" means the same
 * row here as it does in the frontend, which reads history[0].
 */
const ORDER_NEWEST_FIRST = 'ORDER BY h.created_at DESC, h.id DESC';

function rowToHealthUpdate(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    health: row.health,
    statusSummary: row.status_summary,
    keyAchievements: row.key_achievements,
    currentChallenges: row.current_challenges,
    risksImpactingHealth: row.risks_impacting_health,
    mitigationPlan: row.mitigation_plan,
    supportRequired: row.support_required,
    nextReviewDate: row.next_review_date ?? undefined,
    overallConfidencePct: row.overall_confidence_pct !== null ? Number(row.overall_confidence_pct) : undefined,
    reviewedById: row.reviewed_by_id ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    updatedById: row.updated_by_id ?? undefined,
    updatedByName: row.updated_by_name ?? undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    editedByName: row.edited_by_name ?? undefined,
  };
}

const SELECT_WITH_NAMES = `
  SELECT h.*,
         u_rev.name AS reviewed_by_name,
         u_upd.name AS updated_by_name,
         u_edt.name AS edited_by_name
  FROM ${TABLE} h
  LEFT JOIN users u_rev ON h.reviewed_by_id = u_rev.id
  LEFT JOIN users u_upd ON h.updated_by_id = u_upd.id
  LEFT JOIN users u_edt ON h.edited_by_id = u_edt.id`;

@Injectable()
export class ProjectHealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async assertProjectAccess(projectId: string, userId?: string): Promise<void> {
    await this.projectsService.findOne(projectId, userId);
  }

  private async findById(id: string) {
    const { rows } = await this.db.query(`${SELECT_WITH_NAMES} WHERE h.id = $1`, [id]);
    return rowToHealthUpdate(rows[0]);
  }

  async findAll(projectId: string, userId?: string) {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `${SELECT_WITH_NAMES} WHERE h.project_id = $1 ${ORDER_NEWEST_FIRST}`,
      [projectId],
    );
    return rows.map(rowToHealthUpdate);
  }

  async create(projectId: string, data: CreateProjectHealthDto, userId?: string) {
    await this.assertProjectAccess(projectId, userId);

    const result = await this.db.withTransaction(async (client) => {
      // 1. Insert the new health update history record (shared write path —
      //    Create/Edit Project append to the same trail via the same helper).
      const newId = await insertHealthHistory(client, {
        ...data,
        projectId,
        updatedById: userId ?? null,
      });

      // 2. Update the parent project's health so the Overview/header reflect it
      await client.query(
        `UPDATE projects SET health = $1, updated_at = NOW() WHERE id = $2`,
        [data.health, projectId]
      );

      return newId;
    });

    return this.findById(result);
  }

  /**
   * Corrects an existing entry in place. `created_at` and the original author
   * are preserved — the trail keeps its shape — while `edited_at`/`edited_by_id`
   * record who amended it.
   *
   * `projects.health` is only re-pointed when the edited entry is the newest
   * one, since that is the entry the Overview and the project header read.
   */
  async update(projectId: string, id: string, data: UpdateProjectHealthDto, userId?: string) {
    await this.assertProjectAccess(projectId, userId);

    const { rows: existing } = await this.db.query(
      `SELECT id FROM ${TABLE} WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    if (existing.length === 0) {
      throw new NotFoundException(`Health update ${id} not found`);
    }

    await this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE ${TABLE} SET
           health = $1,
           status_summary = $2,
           key_achievements = $3,
           current_challenges = $4,
           risks_impacting_health = $5,
           mitigation_plan = $6,
           support_required = $7,
           next_review_date = $8,
           overall_confidence_pct = $9,
           reviewed_by_id = $10,
           edited_by_id = $11,
           edited_at = NOW()
         WHERE id = $12`,
        [
          data.health,
          data.statusSummary,
          data.keyAchievements ?? '',
          data.currentChallenges ?? '',
          data.risksImpactingHealth ?? '',
          data.mitigationPlan ?? '',
          data.supportRequired ?? '',
          data.nextReviewDate || null,
          data.overallConfidencePct ?? null,
          data.reviewedById || null,
          userId ?? null,
          id,
        ],
      );

      const { rows: newest } = await client.query(
        `SELECT h.id FROM ${TABLE} h WHERE h.project_id = $1 ${ORDER_NEWEST_FIRST} LIMIT 1`,
        [projectId],
      );
      if (newest[0]?.id === id) {
        await client.query(
          `UPDATE projects SET health = $1, updated_at = NOW() WHERE id = $2`,
          [data.health, projectId],
        );
      }
    });

    return this.findById(id);
  }

  // -- Weekly (ISO-week) view of the trail ------------------------------------
  // Consumed by the SQA module's "Health Week NN" columns. Deliberately lives
  // here rather than in SQA: project_health_updates keeps exactly one
  // reader/writer pair, so an SQA weekly grid can never drift from the Health
  // Tracker.

  /**
   * Buckets each project's health trail into the `weeks` most recent ISO weeks
   * (oldest first). A week with no entry of its own inherits the last known
   * health, flagged `carriedForward` — a RAG status holds until someone changes
   * it, so treating a quiet week as unknown would misreport it.
   *
   * Access is NOT checked here: callers pass project ids they have already
   * authorised (SqaService only ever passes ids from records it has scoped).
   */
  async weeklyHealthByProject(
    projectIds: string[],
    weeks: number,
    anchor: Date = new Date(),
  ): Promise<Map<string, ProjectWeeklyHealth[]>> {
    const window = trailingIsoWeeks(weeks, anchor);
    const result = new Map<string, ProjectWeeklyHealth[]>();
    if (!projectIds.length || !window.length) return result;

    const windowStart = isoWeekStartOf(window[0].isoYear, window[0].weekNumber).toISOString();

    // Two bounded queries instead of the whole trail: everything inside the
    // window, plus the single entry that carries into its first week.
    const [inWindow, baseline] = await Promise.all([
      this.db.query(
        `SELECT project_id, id, health, status_summary, created_at
         FROM ${TABLE}
         WHERE project_id = ANY($1) AND created_at >= $2
         ORDER BY created_at ASC, id ASC`,
        [projectIds, windowStart],
      ),
      this.db.query(
        `SELECT DISTINCT ON (project_id) project_id, health, created_at
         FROM ${TABLE}
         WHERE project_id = ANY($1) AND created_at < $2
         ORDER BY project_id, created_at DESC, id DESC`,
        [projectIds, windowStart],
      ),
    ]);

    // Latest entry per (project, ISO week). Rows arrive oldest-first, so the
    // last one written for a week wins — the same row ORDER BY created_at DESC,
    // id DESC would pick.
    const latestPerWeek = new Map<string, any>();
    for (const row of inWindow.rows) {
      latestPerWeek.set(
        `${row.project_id}|${isoWeekKey(isoWeekOf(new Date(row.created_at)))}`,
        row,
      );
    }
    const carriedInto = new Map<string, ProjectHealth>();
    for (const row of baseline.rows) carriedInto.set(row.project_id, row.health);

    for (const projectId of projectIds) {
      let previous: ProjectHealth | null = carriedInto.get(projectId) ?? null;
      result.set(
        projectId,
        window.map((week) => {
          const entry = latestPerWeek.get(`${projectId}|${isoWeekKey(week)}`);
          if (entry) previous = entry.health;
          return {
            isoYear: week.isoYear,
            weekNumber: week.weekNumber,
            weekStart: week.weekStart,
            label: `Week ${week.weekNumber}`,
            health: entry ? entry.health : previous,
            carriedForward: !entry && previous !== null,
            entryId: entry?.id ?? undefined,
            statusSummary: entry?.status_summary || undefined,
          };
        }),
      );
    }
    return result;
  }

  /**
   * Records `health` as the project's health *for one ISO week*.
   *
   * The week already has an entry -> that entry's RAG value is amended in place
   * (the Health Tracker's own edit path, so `edited_by_id`/`edited_at` record
   * who changed it and nothing else in the entry is lost). The week has no
   * entry -> one is appended, stamped inside the target week rather than "now",
   * so the trail and the week it describes agree.
   *
   * `projects.health` is re-pointed only when the affected entry ends up the
   * newest in the trail — exactly the rule update() follows.
   */
  async setWeekHealth(
    projectId: string,
    week: { isoYear: number; weekNumber: number },
    health: string,
    userId?: string,
  ): Promise<void> {
    await this.assertProjectAccess(projectId, userId);

    const weekStart = isoWeekStartOf(week.isoYear, week.weekNumber);
    if (Number.isNaN(weekStart.getTime())) {
      throw new BadRequestException('Invalid ISO week');
    }
    const currentWeekStart = isoWeekStart(new Date());
    if (weekStart.getTime() > currentWeekStart.getTime()) {
      throw new BadRequestException('Health cannot be recorded for a future week');
    }
    const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

    await this.db.withTransaction(async (client) => {
      const { rows: existing } = await client.query(
        `SELECT id FROM ${TABLE}
         WHERE project_id = $1
           AND created_at >= $2::TIMESTAMPTZ
           AND created_at <  $2::TIMESTAMPTZ + INTERVAL '7 days'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [projectId, weekStart.toISOString()],
      );

      let entryId: string;
      if (existing.length) {
        entryId = existing[0].id;
        await client.query(
          `UPDATE ${TABLE} SET health = $1, edited_by_id = $2, edited_at = NOW() WHERE id = $3`,
          [health, userId ?? null, entryId],
        );
      } else {
        entryId = await insertHealthHistory(client, {
          projectId,
          health,
          // No summary is invented — a weekly RAG value is not a status report.
          statusSummary: '',
          updatedById: userId ?? null,
          // Mid-week for a closed week; "now" for the week in progress, so the
          // entry stays newest and the project header reflects it.
          createdAt: isCurrentWeek
            ? null
            : new Date(weekStart.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        });
      }

      const { rows: newest } = await client.query(
        `SELECT h.id FROM ${TABLE} h WHERE h.project_id = $1 ${ORDER_NEWEST_FIRST} LIMIT 1`,
        [projectId],
      );
      if (newest[0]?.id === entryId) {
        await client.query(
          `UPDATE projects SET health = $1, updated_at = NOW() WHERE id = $2`,
          [health, projectId],
        );
      }
    });
  }
}
