import { Injectable, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PermissionsService } from '../rbac/permissions.service';
import { AccountRisk } from '../../types';
import { CreateAccountRiskDto, UpdateAccountRiskDto } from './dto/account-risk.dto';

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

function rowToAccountRisk(row: any): AccountRisk {
  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name ?? undefined,
    riskType: row.risk_type,
    description: row.description,
    priority: row.priority,
    rag: row.rag ?? undefined,
    impact: row.impact ?? undefined,
    likelihood: row.likelihood ?? undefined,
    severity: row.severity ?? undefined,
    ownerId: row.owner_id ?? undefined,
    ownerName: row.owner_name ?? undefined,
    mitigationPlan: row.mitigation_plan ?? '',
    impactDescription: row.impact_description ?? undefined,
    contingencyPlan: row.contingency_plan ?? undefined,
    riskOpenDate: row.risk_open_date ? new Date(row.risk_open_date).toISOString().split('T')[0] : undefined,
    classification: row.classification ?? undefined,
    status: row.status,
    targetResolutionDate: row.target_resolution_date ? new Date(row.target_resolution_date).toISOString().split('T')[0] : undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

@Injectable()
export class AccountRisksService implements OnModuleInit {
  private schemaEnsured = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async onModuleInit() {
    await this.ensureSchema();
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    try {
      await this.db.query(`
        ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS impact_description TEXT;
        ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS contingency_plan TEXT;
        ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS risk_open_date DATE;
        ALTER TABLE account_risks ADD COLUMN IF NOT EXISTS classification TEXT;
      `);
      this.schemaEnsured = true;
    } catch {
      // Ignore if table does not exist yet or connection failing
    }
  }

  async assertAccountAccess(accountId: string, userId?: string): Promise<void> {
    if (!userId) return;
    const ctx = await this.permissions.getUserAccessContext(userId);
    if (ctx.canViewAllAccounts) return;
    const { rows } = await this.db.query(
      `SELECT id FROM accounts WHERE id = $1 AND is_deleted = FALSE`,
      [accountId],
    );
    if (!rows.length) throw new NotFoundException(`Account ${accountId} not found`);
  }

  async findAll(accountId?: string, userId?: string): Promise<AccountRisk[]> {
    await this.ensureSchema();
    if (accountId) {
      await this.assertAccountAccess(accountId, userId);
    }
    const params: any[] = [];
    let whereClause = `WHERE r.is_deleted = FALSE`;
    if (accountId) {
      params.push(accountId);
      whereClause += ` AND r.account_id = $${params.length}`;
    }

    const { rows } = await this.db.query(
      `SELECT r.*, a.name AS account_name, u.name AS owner_name
       FROM account_risks r
       LEFT JOIN accounts a ON r.account_id = a.id
       LEFT JOIN users u ON r.owner_id = u.id
       ${whereClause}
       ORDER BY r.created_at DESC`,
      params,
    );
    return rows.map(rowToAccountRisk);
  }

  async findOne(id: string, userId?: string): Promise<AccountRisk> {
    const { rows } = await this.db.query(
      `SELECT r.*, a.name AS account_name, u.name AS owner_name
       FROM account_risks r
       LEFT JOIN accounts a ON r.account_id = a.id
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE r.id = $1 AND r.is_deleted = FALSE`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Account risk "${id}" not found`);
    await this.assertAccountAccess(rows[0].account_id, userId);
    return rowToAccountRisk(rows[0]);
  }

  async create(dto: CreateAccountRiskDto, userId?: string): Promise<AccountRisk> {
    await this.ensureSchema();
    await this.assertAccountAccess(dto.accountId, userId);
    const computedSeverity = calculateRiskSeverity(dto.impact, dto.likelihood) ?? (dto.priority === 'High' ? 'High' : dto.priority);

    const { rows } = await this.db.query(
      `INSERT INTO account_risks
         (account_id, risk_type, description, priority, rag, impact, likelihood, severity, owner_id, mitigation_plan, status, target_resolution_date, impact_description, contingency_plan, risk_open_date, classification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        dto.accountId,
        dto.riskType || 'Risk',
        dto.description,
        dto.priority,
        dto.rag || null,
        dto.impact || null,
        dto.likelihood || null,
        computedSeverity,
        dto.ownerId || null,
        dto.mitigationPlan || '',
        dto.status || 'Open',
        dto.targetResolutionDate || null,
        dto.impactDescription || null,
        dto.contingencyPlan || null,
        dto.riskOpenDate || null,
        dto.classification || null,
      ],
    );

    return this.findOne(rows[0].id, userId);
  }

  async update(id: string, dto: UpdateAccountRiskDto, userId?: string): Promise<AccountRisk> {
    const existing = await this.findOne(id, userId);

    const impact = dto.impact !== undefined ? dto.impact : existing.impact;
    const likelihood = dto.likelihood !== undefined ? dto.likelihood : existing.likelihood;
    const priority = dto.priority !== undefined ? dto.priority : existing.priority;
    const computedSeverity = calculateRiskSeverity(impact, likelihood) ?? (priority === 'High' ? 'High' : priority);

    await this.db.query(
      `UPDATE account_risks SET
         risk_type = COALESCE($1, risk_type),
         description = COALESCE($2, description),
         priority = COALESCE($3, priority),
         rag = $4,
         impact = $5,
         likelihood = $6,
         severity = $7,
         owner_id = $8,
         mitigation_plan = COALESCE($9, mitigation_plan),
         status = COALESCE($10, status),
         target_resolution_date = $11,
         impact_description = $12,
         contingency_plan = $13,
         risk_open_date = $14,
         classification = $15,
         updated_at = NOW()
       WHERE id = $16 AND is_deleted = FALSE`,
      [
        dto.riskType ?? null,
        dto.description ?? null,
        dto.priority ?? null,
        dto.rag !== undefined ? dto.rag : (existing.rag ?? null),
        impact ?? null,
        likelihood ?? null,
        computedSeverity,
        dto.ownerId !== undefined ? dto.ownerId : (existing.ownerId ?? null),
        dto.mitigationPlan ?? null,
        dto.status ?? null,
        dto.targetResolutionDate !== undefined ? dto.targetResolutionDate : (existing.targetResolutionDate ?? null),
        dto.impactDescription !== undefined ? dto.impactDescription : (existing.impactDescription ?? null),
        dto.contingencyPlan !== undefined ? dto.contingencyPlan : (existing.contingencyPlan ?? null),
        dto.riskOpenDate !== undefined ? dto.riskOpenDate : (existing.riskOpenDate ?? null),
        dto.classification !== undefined ? dto.classification : (existing.classification ?? null),
        id,
      ],
    );

    return this.findOne(id, userId);
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    await this.findOne(id, userId);
    await this.db.query(
      `UPDATE account_risks SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { success: true };
  }
}
