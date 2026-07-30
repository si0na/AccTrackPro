import { Injectable } from '@nestjs/common';
import { ProjectChildTableService } from './project-child-table.service';
import { ProjectMilestone } from '../../types';

const TABLE = 'project_milestones';

const COLUMNS = [
  'name',
  'milestone_no', 'activities', 'deliverables', 'acceptance_criteria',
  'payment_trigger', 'payment_pct', 'payment_amount', 'target_date',
  'sprints', 'planned_start', 'planned_end', 'actual_start', 'actual_end',
  'status', 'remarks', 'effort_planned', 'effort_spent', 'cost_planned', 'cost_spent', 'completion_pct',
];

function toValues(data: any): any[] {
  return [
    data.name,
    data.milestoneNo ?? null, data.activities ?? null, data.deliverables ?? null, data.acceptanceCriteria ?? null,
    data.paymentTrigger ?? null, data.paymentPct ?? null, data.paymentAmount ?? null, data.targetDate || null,
    data.sprints ?? null,
    data.plannedStart || null, data.plannedEnd || null, data.actualStart || null, data.actualEnd || null,
    data.status || 'Not Started', data.remarks ?? '',
    data.effortPlanned ?? null, data.effortSpent ?? null,
    data.costPlanned ?? null, data.costSpent ?? null, data.completionPct ?? null,
  ];
}

function rowToMilestone(row: any): ProjectMilestone {
  const {
    project_id, planned_start, planned_end, actual_start, actual_end,
    effort_planned, effort_spent, cost_planned, cost_spent, completion_pct,
    milestone_no, acceptance_criteria, payment_trigger, payment_pct, payment_amount, target_date,
    created_at, updated_at, ...base
  } = row;
  return {
    ...base,
    projectId: project_id,
    milestoneNo: milestone_no ?? undefined,
    acceptanceCriteria: acceptance_criteria ?? undefined,
    paymentTrigger: payment_trigger ?? undefined,
    paymentPct: payment_pct !== null && payment_pct !== undefined ? Number(payment_pct) : undefined,
    paymentAmount: payment_amount !== null && payment_amount !== undefined ? Number(payment_amount) : undefined,
    targetDate: target_date ?? undefined,
    plannedStart: planned_start ?? undefined,
    plannedEnd: planned_end ?? undefined,
    actualStart: actual_start ?? undefined,
    actualEnd: actual_end ?? undefined,
    effortPlanned: effort_planned !== null && effort_planned !== undefined ? Number(effort_planned) : undefined,
    effortSpent: effort_spent !== null && effort_spent !== undefined ? Number(effort_spent) : undefined,
    costPlanned: cost_planned !== null && cost_planned !== undefined ? Number(cost_planned) : undefined,
    costSpent: cost_spent !== null && cost_spent !== undefined ? Number(cost_spent) : undefined,
    completionPct: completion_pct !== null && completion_pct !== undefined ? Number(completion_pct) : undefined,
    createdAt: created_at ?? undefined,
    updatedAt: updated_at ?? undefined,
  } as ProjectMilestone;
}

/** Milestones tab of a Project — no owner FK, so no `users` join is needed (unlike risks/assumptions/issues/dependencies). */
@Injectable()
export class ProjectMilestonesService extends ProjectChildTableService {
  async findAll(projectId: string, userId?: string): Promise<ProjectMilestone[]> {
    const rows = await this.selectAllForProject(TABLE, projectId, userId);
    return rows.map(rowToMilestone);
  }

  async create(projectId: string, data: any, userId?: string): Promise<ProjectMilestone> {
    await this.assertProjectAccess(projectId, userId);
    const id = await this.insertRow(TABLE, projectId, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async update(projectId: string, id: string, data: any, userId?: string): Promise<ProjectMilestone> {
    await this.assertProjectAccess(projectId, userId);
    await this.updateRow(TABLE, projectId, id, COLUMNS, toValues(data));
    return this.findOneMapped(projectId, id);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    return this.deleteRow(TABLE, projectId, id, userId);
  }

  private async findOneMapped(projectId: string, id: string): Promise<ProjectMilestone> {
    return rowToMilestone(await this.selectOneScoped(TABLE, projectId, id));
  }
}
