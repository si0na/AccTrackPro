import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';
import { CreateProjectHealthDto, UpdateProjectHealthDto } from './dto/project-health.dto';
import { insertHealthHistory } from './project-health-history.util';

const TABLE = 'project_health_updates';

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
}
