import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';
import { CreateProjectHealthDto } from './dto/project-health.dto';
import { insertHealthHistory } from './project-health-history.util';

const TABLE = 'project_health_updates';

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
  };
}

@Injectable()
export class ProjectHealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async assertProjectAccess(projectId: string, userId?: string): Promise<void> {
    await this.projectsService.findOne(projectId, userId);
  }

  async findAll(projectId: string, userId?: string) {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT h.*, 
              u_rev.name AS reviewed_by_name,
              u_upd.name AS updated_by_name
       FROM ${TABLE} h
       LEFT JOIN users u_rev ON h.reviewed_by_id = u_rev.id
       LEFT JOIN users u_upd ON h.updated_by_id = u_upd.id
       WHERE h.project_id = $1
       ORDER BY h.created_at DESC`,
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

    // Fetch the fully populated record
    const { rows } = await this.db.query(
      `SELECT h.*, 
              u_rev.name AS reviewed_by_name,
              u_upd.name AS updated_by_name
       FROM ${TABLE} h
       LEFT JOIN users u_rev ON h.reviewed_by_id = u_rev.id
       LEFT JOIN users u_upd ON h.updated_by_id = u_upd.id
       WHERE h.id = $1`,
      [result]
    );

    return rowToHealthUpdate(rows[0]);
  }
}
