import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { Stakeholder } from '../../types';
import { validateDto } from '../../common/utils/validate-dto.util';
import { CreateStakeholderDto } from './dto/stakeholder.dto';
import { STAKEHOLDER_FIELDS } from '../import-export/import-field-schemas';
import { BulkModuleAdapter } from '../import-export/bulk-adapter';

function rowToStakeholder(row: any): Stakeholder {
  const { is_deleted, created_at, updated_at, account_id, account_name, stakeholder_type, user_id, ...base } = row;
  return {
    ...base,
    accountId:       account_id,
    accountName:     account_name ?? undefined,
    stakeholderType: stakeholder_type,
    userId:          user_id ?? undefined,
  } as Stakeholder;
}

@Injectable()
export class StakeholdersService {
  private readonly logger = new Logger(StakeholdersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly access: AccessScopeService,
    private readonly bus: NotificationEventBus,
  ) {}

  /**
   * Role-aware visibility fragment for the stakeholders alias `s`. A stakeholder
   * is visible only when its parent account is visible to the user. When userId
   * is absent (internal calls) no scoping is applied; view-all roles get no
   * restriction.
   */
  private async childScope(userId: string | null, startIdx: number) {
    if (!userId) return { conditions: [], params: [], nextIdx: startIdx };
    const ctx = await this.access.getContext(userId);
    return this.access.buildChildVisibility('s', ctx, startIdx);
  }

  /**
   * Bulk adapter used by the Global Import/Export service. Each stakeholder row
   * is validated against CreateStakeholderDto and created/updated via the
   * standard paths, so account relational checks, per-account email uniqueness,
   * audit activity and notifications all apply per row. Duplicates are matched
   * by email within the account (case-insensitive), scoped to the requesting
   * user's accounts. The Account reference (name → id, incl. a parent defined in
   * the same workbook) is resolved centrally by the global service beforehand.
   */
  bulkAdapter(userId: string): BulkModuleAdapter {
    return {
      moduleKey: 'stakeholders',
      fields: STAKEHOLDER_FIELDS,
      validate: (row) => validateDto(CreateStakeholderDto, row),
      naturalKey: (row) =>
        row.accountId && row.email ? `${row.accountId}::${String(row.email).trim().toLowerCase()}` : null,
      findExistingId: (row) => this.findActiveByEmail(row.accountId, row.email, userId),
      create: (row) => this.create(row, userId),
      update: (id, row) => this.update(id, row, userId),
    };
  }

  private async findActiveByEmail(
    accountId?: string,
    email?: string,
    ownerId?: string,
  ): Promise<string | null> {
    const e = String(email ?? '').trim().toLowerCase();
    if (!accountId || !e) return null;
    const { rows } = await this.db.query(
      `SELECT s.id FROM stakeholders s
       INNER JOIN accounts a ON s.account_id = a.id
       WHERE s.account_id = $1 AND LOWER(s.email) = $2 AND s.is_deleted = FALSE
         AND ($3::TEXT IS NULL OR a.owner_id = $3)
       LIMIT 1`,
      [accountId, e, ownerId ?? null],
    );
    return rows[0]?.id ?? null;
  }

  /** Returns the UUID of the account's owner (owner_id FK). */
  private async accountOwner(accountId: string): Promise<string | null> {
    const { rows } = await this.db.query(
      `SELECT owner_id FROM accounts WHERE id = $1 AND is_deleted = FALSE`,
      [accountId],
    );
    return rows[0]?.owner_id ?? null;
  }

  // Stakeholders belong to an account and have no fiscal dimension — they are
  // never period-filtered. Visibility follows the parent account (role-aware).
  async findAll(params: FilterParams = {}): Promise<Stakeholder[]> {
    const f = this.filter.normalize(params);
    const scope = await this.childScope(f.userId, 1);
    const conditions: string[] = ['s.is_deleted = FALSE', ...scope.conditions];

    const { rows } = await this.db.query(
      `SELECT s.*, a.name AS account_name
       FROM stakeholders s
       INNER JOIN accounts a ON s.account_id = a.id AND a.is_deleted = FALSE
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC`,
      scope.params,
    );
    return rows.map(rowToStakeholder);
  }

  async findAllDeactivated(params: FilterParams = {}): Promise<Stakeholder[]> {
    const f = this.filter.normalize(params);
    const scope = await this.childScope(f.userId, 1);
    const conditions: string[] = ['s.is_deleted = TRUE', ...scope.conditions];

    // The accounts join has no is_deleted condition: the parent may itself be
    // deactivated (cascade) and its name must still appear in the list.
    const { rows } = await this.db.query(
      `SELECT s.*, a.name AS account_name
       FROM stakeholders s
       LEFT JOIN accounts a ON s.account_id = a.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.updated_at DESC`,
      scope.params,
    );
    return rows.map(rowToStakeholder);
  }

  async findOne(id: string, userId?: string): Promise<Stakeholder> {
    const { conditions, params } = await this.childScope(userId ?? null, 2);
    const scopeClause = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `SELECT s.*, a.name AS account_name
       FROM stakeholders s
       INNER JOIN accounts a ON s.account_id = a.id
       WHERE s.id = $1 AND s.is_deleted = FALSE${scopeClause}`,
      [id, ...params],
    );
    if (!rows.length) throw new NotFoundException(`Stakeholder "${id}" not found`);
    return rowToStakeholder(rows[0]);
  }

  async create(data: any, userId?: string): Promise<Stakeholder> {
    await this.assertAccountExists(data.accountId, userId);
    await this.assertEmailAvailable(data.accountId, data.email);

    const { rows } = await this.db.query(
      `INSERT INTO stakeholders (id, name, account_id, designation, influence, relationship, email, phone, stakeholder_type, department)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [data.name, data.accountId, data.designation ?? '', data.influence,
       data.relationship, data.email ?? '', data.phone ?? '',
       data.stakeholderType, data.department ?? null],
    );
    const stk = rowToStakeholder(rows[0]);
    this.logger.log(`Stakeholder created [id=${stk.id} name="${stk.name}" accountId=${stk.accountId}]`);
    await this.log(`Added Stakeholder '${stk.name}'`, stk.accountId);

    const notifyUserId = await this.accountOwner(stk.accountId);
    if (notifyUserId) {
      this.logger.log(`Emitting Stakeholder:Created notification [userId=${notifyUserId} stakeholderId=${stk.id}]`);
      this.bus.emit({
        userId:               notifyUserId,
        type:                 'Stakeholder',
        eventType:            'Created',
        title:                'Stakeholder Added',
        message:              `Stakeholder "${stk.name}" (${stk.designation || stk.influence}) has been added.`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId:            stk.accountId,
        stakeholderId:        stk.id,
      });
    } else {
      this.logger.warn(`Stakeholder created but account has no owner_id — notification suppressed [accountId=${stk.accountId}]`);
    }
    return stk;
  }

  async update(id: string, data: any, userId?: string): Promise<Stakeholder> {
    const existing = await this.findOne(id, userId);
    if (data.accountId !== existing.accountId) {
      await this.assertAccountExists(data.accountId, userId);
    }
    await this.assertEmailAvailable(data.accountId, data.email, id);
    const { rows } = await this.db.query(
      `UPDATE stakeholders SET
         name=$1, account_id=$2, designation=$3, influence=$4,
         relationship=$5, email=$6, phone=$7, stakeholder_type=$8, department=$9, updated_at=NOW()
       WHERE id=$10 AND is_deleted=FALSE RETURNING *`,
      [data.name, data.accountId, data.designation ?? '', data.influence,
       data.relationship, data.email ?? '', data.phone ?? '',
       data.stakeholderType, data.department ?? null, id],
    );
    const stk = rowToStakeholder(rows[0]);
    await this.log(`Updated Stakeholder '${stk.name}'`, stk.accountId);

    const notifyUserId = await this.accountOwner(stk.accountId);
    if (notifyUserId) {
      this.logger.log(`Emitting Stakeholder:Updated notification [userId=${notifyUserId} stakeholderId=${stk.id}]`);
      this.bus.emit({
        userId:               notifyUserId,
        type:                 'Stakeholder',
        eventType:            'Updated',
        title:                'Stakeholder Updated',
        message:              `Stakeholder "${stk.name}" details have been updated.`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId:            stk.accountId,
        stakeholderId:        stk.id,
      });
    } else {
      this.logger.warn(`Stakeholder updated but account has no owner_id — notification suppressed [accountId=${stk.accountId}]`);
    }
    return stk;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const stk = await this.findOne(id, userId);
    await this.db.query(
      `UPDATE stakeholders SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1`,
      [id],
    );
    await this.log(`Removed Stakeholder '${stk.name}'`, stk.accountId);

    const notifyUserId = await this.accountOwner(stk.accountId);
    if (notifyUserId) {
      this.logger.log(`Emitting Stakeholder:Deleted notification [userId=${notifyUserId} stakeholderId=${stk.id}]`);
      this.bus.emit({
        userId:               notifyUserId,
        type:                 'Stakeholder',
        eventType:            'Deleted',
        title:                'Stakeholder Removed',
        message:              `Stakeholder "${stk.name}" has been removed.`,
        severity:             'Warning',
        notificationCategory: 'BUSINESS',
        accountId:            stk.accountId,
        stakeholderId:        stk.id,
      });
    }
    return { success: true };
  }

  /** Relational rule: the parent account must exist, be active, and be visible to the requesting user. */
  private async assertAccountExists(accountId: string, userId?: string): Promise<void> {
    const scope = userId
      ? this.access.buildAccountVisibility('a', await this.access.getContext(userId), 2)
      : { conditions: [] as string[], params: [] as any[] };
    const clause = scope.conditions.length ? ` AND ${scope.conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE${clause}`,
      [accountId, ...scope.params],
    );
    if (!rows.length) throw new BadRequestException('The selected account does not exist');
  }

  /** Business rule: a stakeholder email is unique within its account (when provided). */
  private async assertEmailAvailable(accountId: string, email?: string, excludeId?: string): Promise<void> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return;
    const { rows } = await this.db.query(
      `SELECT id FROM stakeholders
       WHERE account_id = $1 AND LOWER(email) = $2 AND is_deleted = FALSE
         AND ($3::TEXT IS NULL OR id <> $3)`,
      [accountId, normalized, excludeId ?? null],
    );
    if (rows.length) {
      throw new ConflictException(`A stakeholder with email "${email!.trim()}" already exists for this account`);
    }
  }

  private async log(text: string, accountId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'stakeholder', $1, 'System', $2)`,
        [text, accountId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
