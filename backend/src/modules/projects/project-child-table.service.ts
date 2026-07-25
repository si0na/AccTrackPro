import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';

/**
 * Shared base for the five Phase-3 "leaf" child tables scoped to a project
 * (project_milestones / project_risks / project_assumptions / project_issues /
 * project_dependencies): identical ownership-check + list + read + hard-delete
 * logic, differing only in table name and the typed column set each concrete
 * service inserts/updates. Generalizes the precedent in `project-team.service.ts`
 * (Phase 2's project_team_members CRUD).
 *
 * `table` arguments below are always code-defined constants supplied by the
 * concrete subclass (e.g. 'project_milestones') — never derived from request
 * input — so interpolating them into SQL carries no injection risk. Row data,
 * by contrast, is always passed as parameterized `$1..$n` values.
 */
@Injectable()
export class ProjectChildTableService {
  constructor(
    protected readonly db: DatabaseService,
    protected readonly projectsService: ProjectsService,
  ) {}

  /** Confirms the project exists, isn't deleted, and belongs to userId. Throws NotFoundException otherwise. */
  protected async assertProjectAccess(projectId: string, userId?: string): Promise<void> {
    await this.projectsService.findOne(projectId, userId);
  }

  /** Asserts project access, then returns every row for the project (raw snake_case). */
  protected async selectAllForProject(table: string, projectId: string, userId?: string): Promise<any[]> {
    await this.assertProjectAccess(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT * FROM ${table} WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId],
    );
    return rows;
  }

  /** Returns one row scoped to the project (raw snake_case), or throws NotFoundException. */
  protected async selectOneScoped(table: string, projectId: string, id: string): Promise<any> {
    const { rows } = await this.db.query(
      `SELECT * FROM ${table} WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Record "${id}" not found`);
    return rows[0];
  }

  /**
   * Parameterized INSERT. `columns` is a code-defined, whitelisted array of
   * DB column names (never request-body keys); `values` line up positionally.
   * `id`/`project_id`/`created_at`/`updated_at` are always handled here, not
   * passed in by callers. Returns the new row's id.
   */
  protected async insertRow(table: string, projectId: string, columns: string[], values: any[]): Promise<string> {
    const allColumns = ['id', 'project_id', ...columns];
    const placeholders = ['gen_random_uuid()::TEXT', '$1', ...columns.map((_, i) => `$${i + 2}`)];
    const { rows } = await this.db.query(
      `INSERT INTO ${table} (${allColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
      [projectId, ...values],
    );
    return rows[0].id;
  }

  /**
   * Parameterized UPDATE scoped to `id AND project_id`. `columns`/`values`
   * follow the same whitelist convention as {@link insertRow}. Throws
   * NotFoundException if no row matched (id not found under this project).
   */
  protected async updateRow(table: string, projectId: string, id: string, columns: string[], values: any[]): Promise<void> {
    const setClause = columns.map((col, i) => `${col}=$${i + 1}`).join(', ');
    const idIdx = values.length + 1;
    const projIdx = values.length + 2;
    const result = await this.db.query(
      `UPDATE ${table} SET ${setClause}, updated_at=NOW() WHERE id=$${idIdx} AND project_id=$${projIdx}`,
      [...values, id, projectId],
    );
    if (!result.rowCount) throw new NotFoundException(`Record "${id}" not found`);
  }

  /** Asserts project access, then hard-deletes the row (no is_deleted/restore — same precedent as `comments`). */
  protected async deleteRow(table: string, projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    await this.assertProjectAccess(projectId, userId);
    await this.db.query(`DELETE FROM ${table} WHERE id=$1 AND project_id=$2`, [id, projectId]);
    return { success: true };
  }
}
