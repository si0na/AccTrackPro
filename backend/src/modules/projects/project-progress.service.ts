import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';
import { CreateProjectProgressDto, UpdateProjectProgressDto } from './dto/project-progress.dto';

const TABLE = 'project_progress_updates';

import { assertNotFutureDate, isFutureDateString } from './project-progress-date.util';
export { assertNotFutureDate, isFutureDateString };

function rowToProgressUpdate(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    asOnDate: row.as_on_date ? new Date(row.as_on_date).toISOString().slice(0, 10) : '',
    plannedCompletionPct: row.planned_completion_pct !== null ? Number(row.planned_completion_pct) : undefined,
    actualCompletionPct: row.actual_completion_pct !== null ? Number(row.actual_completion_pct) : undefined,
    plannedEffortHours: row.planned_effort_hours !== null ? Number(row.planned_effort_hours) : undefined,
    actualEffortHours: row.actual_effort_hours !== null ? Number(row.actual_effort_hours) : undefined,
    plannedCost: row.planned_cost !== null ? Number(row.planned_cost) : undefined,
    actualCost: row.actual_cost !== null ? Number(row.actual_cost) : undefined,
    notes: row.notes || '',
    updatedById: row.updated_by_id ?? undefined,
    updatedByName: row.updated_by_name ?? undefined,
    editedById: row.edited_by_id ?? undefined,
    editedByName: row.edited_by_name ?? undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
  };
}

const SELECT_WITH_NAMES = `
  SELECT p.*,
         u_upd.name AS updated_by_name,
         u_edt.name AS edited_by_name
  FROM ${TABLE} p
  LEFT JOIN users u_upd ON p.updated_by_id = u_upd.id
  LEFT JOIN users u_edt ON p.edited_by_id = u_edt.id`;

const ORDER_NEWEST_FIRST = 'ORDER BY p.as_on_date DESC, p.created_at DESC, p.id DESC';

@Injectable()
export class ProjectProgressService {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  private async assertProjectAccess(projectId: string, userId?: string): Promise<void> {
    await this.projectsService.findOne(projectId, userId);
  }

  private async findById(id: string) {
    const { rows } = await this.db.query(`${SELECT_WITH_NAMES} WHERE p.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException(`Progress update ${id} not found`);
    return rowToProgressUpdate(rows[0]);
  }

  async findAll(projectId: string, userId?: string) {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `${SELECT_WITH_NAMES} WHERE p.project_id = $1 ${ORDER_NEWEST_FIRST}`,
      [projectId],
    );
    return rows.map(rowToProgressUpdate);
  }

  private async syncLatestProjectProgress(client: any, projectId: string): Promise<void> {
    const { rows } = await client.query(
      `SELECT as_on_date, planned_completion_pct, actual_completion_pct,
              planned_effort_hours, actual_effort_hours, planned_cost, actual_cost
       FROM ${TABLE}
       WHERE project_id = $1
       ORDER BY as_on_date DESC, created_at DESC, id DESC
       LIMIT 1`,
      [projectId],
    );

    if (rows.length > 0) {
      const latest = rows[0];
      await client.query(
        `UPDATE projects SET
           as_on_date = $1,
           planned_completion_pct = $2,
           actual_completion_pct = $3,
           planned_effort_hours = $4,
           actual_effort_hours = $5,
           planned_cost = $6,
           actual_cost = $7,
           updated_at = NOW()
         WHERE id = $8 AND is_deleted = FALSE`,
        [
          latest.as_on_date,
          latest.planned_completion_pct,
          latest.actual_completion_pct,
          latest.planned_effort_hours,
          latest.actual_effort_hours,
          latest.planned_cost,
          latest.actual_cost,
          projectId,
        ],
      );
    }
  }

  async create(projectId: string, data: CreateProjectProgressDto, userId?: string) {
    await this.assertProjectAccess(projectId, userId);

    const asOnDate = data.asOnDate || new Date().toLocaleDateString('en-CA');
    assertNotFutureDate(asOnDate);

    const resultId = await this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO ${TABLE} (
           project_id, as_on_date, planned_completion_pct, actual_completion_pct,
           planned_effort_hours, actual_effort_hours, planned_cost, actual_cost,
           notes, updated_by_id, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [
          projectId,
          asOnDate,
          data.plannedCompletionPct ?? null,
          data.actualCompletionPct ?? null,
          data.plannedEffortHours ?? null,
          data.actualEffortHours ?? null,
          data.plannedCost ?? null,
          data.actualCost ?? null,
          data.notes ?? '',
          userId ?? null,
        ],
      );

      const newId = rows[0].id;

      // Sync parent projects table with the newest progress entry by progress date
      await this.syncLatestProjectProgress(client, projectId);

      return newId;
    });

    return this.findById(resultId);
  }

  async update(projectId: string, id: string, data: UpdateProjectProgressDto, userId?: string) {
    await this.assertProjectAccess(projectId, userId);

    const { rows: existing } = await this.db.query(
      `SELECT id FROM ${TABLE} WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    if (existing.length === 0) {
      throw new NotFoundException(`Progress update ${id} not found`);
    }

    const asOnDate = data.asOnDate || new Date().toLocaleDateString('en-CA');
    assertNotFutureDate(asOnDate);

    await this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE ${TABLE} SET
           as_on_date = $1,
           planned_completion_pct = $2,
           actual_completion_pct = $3,
           planned_effort_hours = $4,
           actual_effort_hours = $5,
           planned_cost = $6,
           actual_cost = $7,
           notes = $8,
           edited_by_id = $9,
           edited_at = NOW()
         WHERE id = $10 AND project_id = $11`,
        [
          asOnDate,
          data.plannedCompletionPct ?? null,
          data.actualCompletionPct ?? null,
          data.plannedEffortHours ?? null,
          data.actualEffortHours ?? null,
          data.plannedCost ?? null,
          data.actualCost ?? null,
          data.notes ?? '',
          userId ?? null,
          id,
          projectId,
        ],
      );

      // Re-sync parent project if latest entry changed
      await this.syncLatestProjectProgress(client, projectId);
    });

    return this.findById(id);
  }
}
