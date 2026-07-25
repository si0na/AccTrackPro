import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectChildTableService } from './project-child-table.service';
import { ProjectDependency } from '../../types';

const TABLE = 'project_dependencies';

const COLUMNS = [
  'priority', 'description', 'dependency_type', 'dependent_task',
  'owner_id', 'external_party', 'status', 'target_resolution_date', 'remarks',
];

function toValues(data: any): any[] {
  return [
    data.priority, data.description, data.dependencyType ?? null, data.dependentTask ?? null,
    data.ownerId ?? null, data.externalParty ?? null, data.status || 'Open',
    data.targetResolutionDate || null, data.remarks ?? '',
  ];
}

function rowToDependency(row: any): ProjectDependency {
  const {
    project_id, owner_id, owner_name, dependency_type, dependent_task,
    external_party, target_resolution_date, created_at, updated_at, ...base
  } = row;
  return {
    ...base,
    projectId: project_id,
    ownerId: owner_id ?? undefined,
    ownerName: owner_name ?? undefined,
    dependencyType: dependency_type ?? undefined,
    dependentTask: dependent_task ?? undefined,
    externalParty: external_party ?? undefined,
    targetResolutionDate: target_resolution_date ?? undefined,
    createdAt: created_at ?? undefined,
    updatedAt: updated_at ?? undefined,
  } as ProjectDependency;
}

/** Dependencies tab of a Project. `owner_id` is an optional FK to `users`; joined here for display. */
@Injectable()
export class ProjectDependenciesService extends ProjectChildTableService {
  async findAll(projectId: string, userId?: string): Promise<ProjectDependency[]> {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT d.*, u.name AS owner_name
       FROM ${TABLE} d
       LEFT JOIN users u ON d.owner_id = u.id
       WHERE d.project_id = $1
       ORDER BY d.created_at ASC`,
      [projectId],
    );
    return rows.map(rowToDependency);
  }

  async create(projectId: string, data: any, userId?: string): Promise<ProjectDependency> {
    await this.assertProjectAccess(projectId, userId);
    const id = await this.insertRow(TABLE, projectId, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async update(projectId: string, id: string, data: any, userId?: string): Promise<ProjectDependency> {
    await this.assertProjectAccess(projectId, userId);
    await this.updateRow(TABLE, projectId, id, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    return this.deleteRow(TABLE, projectId, id, userId);
  }

  private async findOneMapped(projectId: string, id: string): Promise<ProjectDependency> {
    const { rows } = await this.db.query(
      `SELECT d.*, u.name AS owner_name
       FROM ${TABLE} d
       LEFT JOIN users u ON d.owner_id = u.id
       WHERE d.id = $1 AND d.project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Dependency "${id}" not found`);
    return rowToDependency(rows[0]);
  }
}
