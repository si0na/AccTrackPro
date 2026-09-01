import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectChildTableService } from './project-child-table.service';
import { ProjectRisk } from '../../types';

const TABLE = 'project_risks';

const COLUMNS = [
  'priority', 'description', 'impact', 'likelihood', 'severity',
  'owner_id', 'mitigation_plan', 'status', 'target_resolution_date',
  'rag', 'impact_description', 'classification', 'contingency_plan', 'risk_open_date',
];

function calculateRiskSeverity(impact?: string, likelihood?: string): string | null {
  const imp = (impact || '').trim();
  const lik = (likelihood || '').trim();

  if (imp === 'High') {
    if (lik === 'Low') return 'Medium';
    if (lik === 'Medium') return 'High';
    if (lik === 'High') return 'Critical';
  }

  if (imp === 'Medium') {
    if (lik === 'Low') return 'Low';
    if (lik === 'Medium') return 'Medium';
    if (lik === 'High') return 'High';
  }

  if (imp === 'Low') {
    if (lik === 'Low') return 'Low';
    if (lik === 'Medium') return 'Low';
    if (lik === 'High') return 'Medium';
  }

  return null;
}

function toValues(data: any): any[] {
  const computedSeverity = calculateRiskSeverity(data.impact, data.likelihood) ?? data.severity ?? null;
  return [
    data.priority, data.description,
    data.impact ?? null, data.likelihood ?? null, computedSeverity,
    data.ownerId ?? null, data.mitigationPlan ?? '', data.status || 'Open',
    data.targetResolutionDate || null,
    data.rag ?? null,
    data.impactDescription ?? null,
    data.classification ?? null,
    data.contingencyPlan ?? null,
    data.riskOpenDate || null,
  ];
}

function rowToRisk(row: any): ProjectRisk {
  const {
    project_id, owner_id, owner_name, mitigation_plan, target_resolution_date,
    impact_description, contingency_plan, risk_open_date,
    created_at, updated_at, ...base
  } = row;
  return {
    ...base,
    projectId: project_id,
    ownerId: owner_id ?? undefined,
    ownerName: owner_name ?? undefined,
    mitigationPlan: mitigation_plan,
    targetResolutionDate: target_resolution_date ?? undefined,
    rag: base.rag ?? undefined,
    impactDescription: impact_description ?? undefined,
    classification: base.classification ?? undefined,
    contingencyPlan: contingency_plan ?? undefined,
    riskOpenDate: risk_open_date ?? undefined,
    createdAt: created_at ?? undefined,
    updatedAt: updated_at ?? undefined,
  } as ProjectRisk;
}

/** Risks tab of a Project. `owner_id` is an optional FK to `users`; joined here for display, same as `project-team.service.ts`'s employee join. */
@Injectable()
export class ProjectRisksService extends ProjectChildTableService {
  async findAll(projectId: string, userId?: string): Promise<ProjectRisk[]> {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT r.*, u.name AS owner_name
       FROM ${TABLE} r
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE r.project_id = $1
       ORDER BY r.created_at ASC`,
      [projectId],
    );
    return rows.map(rowToRisk);
  }

  async create(projectId: string, data: any, userId?: string): Promise<ProjectRisk> {
    await this.assertProjectAccess(projectId, userId);
    const id = await this.insertRow(TABLE, projectId, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async update(projectId: string, id: string, data: any, userId?: string): Promise<ProjectRisk> {
    await this.assertProjectAccess(projectId, userId);
    await this.updateRow(TABLE, projectId, id, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    return this.deleteRow(TABLE, projectId, id, userId);
  }

  private async findOneMapped(projectId: string, id: string): Promise<ProjectRisk> {
    const { rows } = await this.db.query(
      `SELECT r.*, u.name AS owner_name
       FROM ${TABLE} r
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE r.id = $1 AND r.project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Risk "${id}" not found`);
    return rowToRisk(rows[0]);
  }
}
