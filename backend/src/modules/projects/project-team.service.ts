import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';
import { ProjectTeamMember } from '../../types';

function rowToTeamMember(row: any): ProjectTeamMember {
  const { project_id, employee_name, seniority_level, created_at, ...base } = row;
  return {
    ...base,
    projectId: project_id,
    employeeName: employee_name,
    seniorityLevel: seniority_level ?? undefined,
    createdAt: created_at ?? undefined,
  } as ProjectTeamMember;
}

/**
 * Team members for a Project — the simplest of the Phase 3 child tables
 * (project_team_members, migration 042), built ahead of schedule in Phase 2
 * so the Project Details "Team" tab is backend-wired rather than a
 * local-only placeholder. Hard delete (no is_deleted/restore), same
 * precedent as `comments` — a leaf record with no dependents.
 */
@Injectable()
export class ProjectTeamService {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(projectId: string, userId?: string): Promise<ProjectTeamMember[]> {
    await this.projectsService.findOne(projectId, userId); // existence + ownership check
    const { rows } = await this.db.query(
      `SELECT * FROM project_team_members WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId],
    );
    return rows.map(rowToTeamMember);
  }

  async create(projectId: string, data: any, userId?: string): Promise<ProjectTeamMember> {
    await this.projectsService.findOne(projectId, userId);
    const { rows } = await this.db.query(
      `INSERT INTO project_team_members (id, project_id, role, employee_name, seniority_level, location)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5)
       RETURNING id`,
      [projectId, data.role, data.employeeName, data.seniorityLevel ?? null, data.location ?? null],
    );
    return this.findOneScoped(projectId, rows[0].id);
  }

  async update(projectId: string, id: string, data: any, userId?: string): Promise<ProjectTeamMember> {
    await this.projectsService.findOne(projectId, userId);
    await this.db.query(
      `UPDATE project_team_members SET role=$1, employee_name=$2, seniority_level=$3, location=$4
       WHERE id=$5 AND project_id=$6`,
      [data.role, data.employeeName, data.seniorityLevel ?? null, data.location ?? null, id, projectId],
    );
    return this.findOneScoped(projectId, id);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    await this.projectsService.findOne(projectId, userId);
    await this.db.query(`DELETE FROM project_team_members WHERE id=$1 AND project_id=$2`, [id, projectId]);
    return { success: true };
  }

  private async findOneScoped(projectId: string, id: string): Promise<ProjectTeamMember> {
    const { rows } = await this.db.query(
      `SELECT * FROM project_team_members WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Team member "${id}" not found`);
    return rowToTeamMember(rows[0]);
  }
}
