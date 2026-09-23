import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { NormalizedRisk } from '../../types';

@Injectable()
export class CentralRisksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
    private readonly access: AccessScopeService,
  ) {}

  async findAll(
    source?: string,
    accountId?: string,
    rag?: string,
    priority?: string,
    status?: string,
    userId?: string,
  ): Promise<NormalizedRisk[]> {
    const accessCtx = userId ? await this.access.getContext(userId) : null;

    const normalizedRisks: NormalizedRisk[] = [];

    // Helper: account filter check
    const matchesAccountFilter = (accId: string) => {
      if (accountId && accountId !== 'All' && accId !== accountId) return false;
      return true;
    };

    // 1. Account Risks
    if (!source || source === 'All' || source === 'Accounts' || source === 'Account') {
      const params: any[] = [];
      let sql = `
        SELECT r.*, a.name AS account_name, COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS owner_name
        FROM account_risks r
        JOIN accounts a ON r.account_id = a.id
        LEFT JOIN users u ON r.owner_id = u.id
        LEFT JOIN employee_master em ON r.owner_id = em.id
        WHERE r.is_deleted = FALSE AND a.is_deleted = FALSE
      `;
      if (accountId && accountId !== 'All') {
        params.push(accountId);
        sql += ` AND r.account_id = $${params.length}`;
      }
      if (accessCtx) {
        const childScope = this.access.buildChildVisibility('r', accessCtx, params.length + 1, 'risks');
        if (childScope.conditions.length > 0) {
          sql += ` AND ${childScope.conditions.join(' AND ')}`;
          params.push(...childScope.params);
        }
      }
      sql += ` ORDER BY r.created_at DESC`;

      const { rows } = await this.db.query(sql, params);
      for (const row of rows) {
        normalizedRisks.push({
          id: `acc-${row.id}`,
          sourceType: 'Account',
          sourceId: row.id,
          sourceName: row.account_name ?? 'Account',
          accountId: row.account_id,
          accountName: row.account_name ?? 'Account',
          riskType: row.risk_type === 'Dependency' ? 'Issue' : (row.risk_type || 'Risk'),
          classification: row.classification ?? undefined,
          description: row.description,
          priority: row.priority || 'Medium',
          rag: row.rag ?? undefined,
          severity: row.severity ?? row.priority,
          impact: row.impact ?? undefined,
          likelihood: row.likelihood ?? undefined,
          ownerId: row.owner_id ?? undefined,
          ownerName: row.owner_name ?? undefined,
          mitigationPlan: row.mitigation_plan ?? '',
          impactDescription: row.impact_description ?? undefined,
          contingencyPlan: row.contingency_plan ?? undefined,
          riskOpenDate: row.risk_open_date ? new Date(row.risk_open_date).toISOString().split('T')[0] : undefined,
          status: row.status || 'Open',
          targetResolutionDate: row.target_resolution_date ? new Date(row.target_resolution_date).toISOString().split('T')[0] : undefined,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        });
      }
    }

    // 2. Project Risks
    if (!source || source === 'All' || source === 'Projects' || source === 'Project') {
      const params: any[] = [];
      let sql = `
        SELECT r.*, p.name AS project_name, p.account_id, a.name AS account_name, COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS owner_name
        FROM project_risks r
        JOIN projects p ON r.project_id = p.id
        JOIN accounts a ON p.account_id = a.id
        LEFT JOIN users u ON r.owner_id = u.id
        LEFT JOIN employee_master em ON r.owner_id = em.id
        WHERE p.is_deleted = FALSE AND a.is_deleted = FALSE
      `;
      if (accountId && accountId !== 'All') {
        params.push(accountId);
        sql += ` AND p.account_id = $${params.length}`;
      }
      if (accessCtx) {
        const projScope = this.access.buildProjectVisibility('p', accessCtx, params.length + 1);
        if (projScope.conditions.length > 0) {
          sql += ` AND ${projScope.conditions.join(' AND ')}`;
          params.push(...projScope.params);
        }
      }
      sql += ` ORDER BY r.created_at DESC`;

      const { rows } = await this.db.query(sql, params);
      for (const row of rows) {
        normalizedRisks.push({
          id: `proj-${row.id}`,
          sourceType: 'Project',
          sourceId: row.id,
          sourceName: row.project_name ?? 'Project',
          accountId: row.account_id,
          accountName: row.account_name ?? 'Account',
          projectId: row.project_id,
          projectName: row.project_name ?? 'Project',
          riskType: (row.classification === 'Dependency' || row.classification === 'Issue') ? 'Issue' : 'Risk',
          classification: row.classification ?? undefined,
          description: row.description,
          priority: row.priority || 'Medium',
          rag: row.rag ?? undefined,
          severity: row.severity ?? row.priority,
          impact: row.impact ?? undefined,
          likelihood: row.likelihood ?? undefined,
          impactDescription: row.impact_description ?? undefined,
          contingencyPlan: row.contingency_plan ?? undefined,
          riskOpenDate: row.risk_open_date ? new Date(row.risk_open_date).toISOString().split('T')[0] : undefined,
          ownerId: row.owner_id ?? undefined,
          ownerName: row.owner_name ?? undefined,
          mitigationPlan: row.mitigation_plan ?? '',
          status: row.status || 'Open',
          targetResolutionDate: row.target_resolution_date ? new Date(row.target_resolution_date).toISOString().split('T')[0] : undefined,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        });
      }
    }

    // 3. Project Issues
    if (!source || source === 'All' || source === 'Projects' || source === 'Project') {
      const params: any[] = [];
      let sql = `
        SELECT i.*, p.name AS project_name, p.account_id, a.name AS account_name, COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS owner_name
        FROM project_issues i
        JOIN projects p ON i.project_id = p.id
        JOIN accounts a ON p.account_id = a.id
        LEFT JOIN users u ON i.owner_id = u.id
        LEFT JOIN employee_master em ON i.owner_id = em.id
        WHERE p.is_deleted = FALSE AND a.is_deleted = FALSE
      `;
      if (accountId && accountId !== 'All') {
        params.push(accountId);
        sql += ` AND p.account_id = $${params.length}`;
      }
      if (accessCtx) {
        const projIssueScope = this.access.buildProjectVisibility('p', accessCtx, params.length + 1);
        if (projIssueScope.conditions.length > 0) {
          sql += ` AND ${projIssueScope.conditions.join(' AND ')}`;
          params.push(...projIssueScope.params);
        }
      }
      sql += ` ORDER BY i.created_at DESC`;

      const { rows } = await this.db.query(sql, params);
      for (const row of rows) {
        normalizedRisks.push({
          id: `proj-issue-${row.id}`,
          sourceType: 'Project',
          sourceId: row.id,
          sourceName: row.project_name ?? 'Project',
          accountId: row.account_id,
          accountName: row.account_name ?? 'Account',
          projectId: row.project_id,
          projectName: row.project_name ?? 'Project',
          riskType: 'Issue',
          description: row.description,
          priority: row.priority || 'Medium',
          impact: row.impact ?? undefined,
          riskOpenDate: row.date_identified ? new Date(row.date_identified).toISOString().split('T')[0] : undefined,
          ownerId: row.owner_id ?? undefined,
          ownerName: row.owner_name ?? undefined,
          mitigationPlan: row.resolution_plan ?? '',
          contingencyPlan: row.remarks ?? '',
          status: row.status || 'Open',
          targetResolutionDate: row.target_resolution_date ? new Date(row.target_resolution_date).toISOString().split('T')[0] : undefined,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        });
      }
    }

    // Filter in memory for RAG, Priority, Status if requested
    return normalizedRisks.filter((r) => {
      if (rag && rag !== 'All' && r.rag !== rag) return false;
      if (priority && priority !== 'All' && r.priority !== priority && r.severity !== priority) return false;
      if (status && status !== 'All') {
        if (status === 'Open' && r.status !== 'Open' && r.status !== 'In Progress') return false;
        if (status === 'Closed' && r.status !== 'Closed' && r.status !== 'Resolved' && r.status !== 'Mitigated') return false;
        if (status !== 'Open' && status !== 'Closed' && r.status !== status) return false;
      }
      return true;
    });
  }
}
