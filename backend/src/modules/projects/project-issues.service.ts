import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectChildTableService } from './project-child-table.service';
import { ProjectIssue } from '../../types';

const TABLE = 'project_issues';

const COLUMNS = [
  'priority', 'description', 'impact', 'owner_id', 'date_identified',
  'status', 'resolution_plan', 'target_resolution_date', 'remarks',
];

function toValues(data: any): any[] {
  return [
    data.priority, data.description, data.impact ?? null, data.ownerId ?? null,
    data.dateIdentified || null, data.status || 'Open', data.resolutionPlan ?? '',
    data.targetResolutionDate || null, data.remarks ?? '',
  ];
}

function rowToIssue(row: any): ProjectIssue {
  const {
    project_id, owner_id, owner_name, date_identified, resolution_plan,
    target_resolution_date, created_at, updated_at, ...base
  } = row;
  return {
    ...base,
    projectId: project_id,
    ownerId: owner_id ?? undefined,
    ownerName: owner_name ?? undefined,
    dateIdentified: date_identified ?? undefined,
    resolutionPlan: resolution_plan,
    targetResolutionDate: target_resolution_date ?? undefined,
    createdAt: created_at ?? undefined,
    updatedAt: updated_at ?? undefined,
  } as ProjectIssue;
}

/** Issues tab of a Project. `owner_id` is an optional FK to `users`; joined here for display. */
@Injectable()
export class ProjectIssuesService extends ProjectChildTableService {
  async findAll(projectId: string, userId?: string): Promise<ProjectIssue[]> {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT i.*, u.name AS owner_name
       FROM ${TABLE} i
       LEFT JOIN users u ON i.owner_id = u.id
       WHERE i.project_id = $1
       ORDER BY i.created_at ASC`,
      [projectId],
    );
    return rows.map(rowToIssue);
  }

  async create(projectId: string, data: any, userId?: string): Promise<ProjectIssue> {
    await this.assertProjectAccess(projectId, userId);
    const id = await this.insertRow(TABLE, projectId, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async update(projectId: string, id: string, data: any, userId?: string): Promise<ProjectIssue> {
    await this.assertProjectAccess(projectId, userId);
    await this.updateRow(TABLE, projectId, id, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    return this.deleteRow(TABLE, projectId, id, userId);
  }

  private async findOneMapped(projectId: string, id: string): Promise<ProjectIssue> {
    const { rows } = await this.db.query(
      `SELECT i.*, u.name AS owner_name
       FROM ${TABLE} i
       LEFT JOIN users u ON i.owner_id = u.id
       WHERE i.id = $1 AND i.project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Issue "${id}" not found`);
    return rowToIssue(rows[0]);
  }
}
