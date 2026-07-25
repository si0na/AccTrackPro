import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectChildTableService } from './project-child-table.service';
import { ProjectAssumption } from '../../types';

const TABLE = 'project_assumptions';

const COLUMNS = [
  'priority', 'description', 'impact_if_false', 'validation_status',
  'owner_id', 'date_identified', 'target_validation_date', 'remarks',
];

function toValues(data: any): any[] {
  return [
    data.priority, data.description, data.impactIfFalse ?? null,
    data.validationStatus || 'Unvalidated', data.ownerId ?? null,
    data.dateIdentified || null, data.targetValidationDate || null, data.remarks ?? '',
  ];
}

function rowToAssumption(row: any): ProjectAssumption {
  const {
    project_id, owner_id, owner_name, impact_if_false, validation_status,
    date_identified, target_validation_date, created_at, updated_at, ...base
  } = row;
  return {
    ...base,
    projectId: project_id,
    ownerId: owner_id ?? undefined,
    ownerName: owner_name ?? undefined,
    impactIfFalse: impact_if_false ?? undefined,
    validationStatus: validation_status,
    dateIdentified: date_identified ?? undefined,
    targetValidationDate: target_validation_date ?? undefined,
    createdAt: created_at ?? undefined,
    updatedAt: updated_at ?? undefined,
  } as ProjectAssumption;
}

/** Assumptions tab of a Project. `owner_id` is an optional FK to `users`; joined here for display. */
@Injectable()
export class ProjectAssumptionsService extends ProjectChildTableService {
  async findAll(projectId: string, userId?: string): Promise<ProjectAssumption[]> {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT a.*, u.name AS owner_name
       FROM ${TABLE} a
       LEFT JOIN users u ON a.owner_id = u.id
       WHERE a.project_id = $1
       ORDER BY a.created_at ASC`,
      [projectId],
    );
    return rows.map(rowToAssumption);
  }

  async create(projectId: string, data: any, userId?: string): Promise<ProjectAssumption> {
    await this.assertProjectAccess(projectId, userId);
    const id = await this.insertRow(TABLE, projectId, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async update(projectId: string, id: string, data: any, userId?: string): Promise<ProjectAssumption> {
    await this.assertProjectAccess(projectId, userId);
    await this.updateRow(TABLE, projectId, id, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    return this.deleteRow(TABLE, projectId, id, userId);
  }

  private async findOneMapped(projectId: string, id: string): Promise<ProjectAssumption> {
    const { rows } = await this.db.query(
      `SELECT a.*, u.name AS owner_name
       FROM ${TABLE} a
       LEFT JOIN users u ON a.owner_id = u.id
       WHERE a.id = $1 AND a.project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Assumption "${id}" not found`);
    return rowToAssumption(rows[0]);
  }
}
