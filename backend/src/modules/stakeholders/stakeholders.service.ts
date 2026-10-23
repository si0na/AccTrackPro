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

function formatDate(d: any): string | undefined {
  if (!d) return undefined;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function rowToStakeholder(row: any): Stakeholder {
  const {
    is_deleted, created_at, updated_at, account_id, account_name,
    stakeholder_type, user_id, employee_id, linkedin_profile_url,
    primary_owner_id, primary_owner_name,
    secondary_owner_id, secondary_owner_name,
    tertiary_owner_id, tertiary_owner_name,
    key_priorities, pain_points_insights, last_connect, next_connect, next_connect_status,
    action_follow_ups, estimated_budget_available, role_in_decision,
    ...base
  } = row;
  return {
    ...base,
    area: row.area ?? undefined,
    keyPriorities: key_priorities ?? undefined,
    painPointsInsights: pain_points_insights ?? undefined,
    lastConnect: formatDate(last_connect),
    nextConnect: formatDate(next_connect),
    nextConnectStatus: next_connect_status ?? undefined,
    actionFollowUps: action_follow_ups ?? undefined,
    comments: row.comments ?? undefined,
    country: row.country ?? undefined,
    location: row.location ?? undefined,
    estimatedBudgetAvailable: estimated_budget_available != null && !isNaN(Number(estimated_budget_available)) ? Number(estimated_budget_available) : undefined,
    roleInDecision: role_in_decision ?? undefined,
    level: row.level ?? 'Level 3',
    accountId: account_id,
    accountName: account_name ?? undefined,
    stakeholderType: stakeholder_type,
    userId: user_id ?? undefined,
    employeeId: employee_id ?? undefined,
    linkedinProfileUrl: linkedin_profile_url ?? undefined,
    primaryOwnerId: primary_owner_id ?? undefined,
    primaryOwnerName: primary_owner_name ?? undefined,
    secondaryOwnerId: secondary_owner_id ?? undefined,
    secondaryOwnerName: secondary_owner_name ?? undefined,
    tertiaryOwnerId: tertiary_owner_id ?? undefined,
    tertiaryOwnerName: tertiary_owner_name ?? undefined,
    thirdOwnerId: tertiary_owner_id ?? undefined,
    thirdOwnerName: tertiary_owner_name ?? undefined,
    // A whitelist link with no user link means the person was assigned as a
    // Service Provider before completing registration.
    pendingRegistration: !!employee_id && !user_id,
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
  ) { }

  /**
   * Role-aware visibility fragment for the stakeholders alias `s`. A stakeholder
   * is visible only when its parent account is visible to the user. When userId
   * is absent (internal calls) no scoping is applied; view-all roles get no
   * restriction.
   */
  private async childScope(userId: string | null, startIdx: number) {
    if (!userId) return { conditions: [], params: [], nextIdx: startIdx };
    const ctx = await this.access.getContext(userId);
    return this.access.buildStakeholderVisibility('s', ctx, startIdx);
  }

  /**
   * Bulk adapter used by the Global Import/Export service. Each stakeholder row
   * is validated against CreateStakeholderDto and created/updated via the
   * standard paths, so account relational checks, per-account email uniqueness,
   * audit activity and notifications all apply per row. Duplicates are matched
   * by email within the account (case-insensitive), scoped to the requesting
   * user's accounts. The Account reference (name → id, incl. a parent defined in
   * the same workbook) is resolved centrally by the global service beforehand.
   *
   * For updates during bulk import, omitted columns and blank cells preserve
   * existing database values, while manual edit operations continue to allow
   * explicitly clearing values.
   */
  bulkAdapter(userId: string): BulkModuleAdapter {
    return {
      moduleKey: 'stakeholders',
      fields: STAKEHOLDER_FIELDS,
      validate: (row) => validateDto(CreateStakeholderDto, { stakeholderType: 'CLIENT', ...row }),
      naturalKey: (row) =>
        row.accountId && row.email ? `${row.accountId}::${String(row.email).trim().toLowerCase()}` : null,
      findExistingId: (row) => this.findActiveByEmail(row.accountId, row.email, userId),
      create: (row) => this.create({ stakeholderType: 'CLIENT', ...row }, userId),
      update: async (id, row) => {
        const existing = await this.findOne(id, userId);
        const merged = this.mergeImportRowWithExisting(existing, row);
        return this.update(id, merged, userId);
      },
    };
  }

  private mergeImportRowWithExisting(existing: Stakeholder, row: any): any {
    const isBlank = (val: any) =>
      val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    const merged: Record<string, any> = { ...existing, stakeholderType: 'CLIENT' };

    for (const [key, val] of Object.entries(row)) {
      if (isBlank(val)) {
        // Blank cell or omitted value -> preserve existing value from DB
        continue;
      }
      merged[key] = val;
    }
    return merged;
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
       LIMIT 1`,
      [accountId, e],
    );
    return rows[0]?.id ?? null;
  }

  /** Returns the UUID of the account's owner (owner_id FK). */
  private async accountOwner(accountId?: string): Promise<string | null> {
    if (!accountId) return null;
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
      `SELECT s.*, a.name AS account_name,
              sp1.name AS primary_owner_name,
              sp2.name AS secondary_owner_name,
              sp3.name AS tertiary_owner_name
       FROM stakeholders s
       LEFT JOIN accounts a ON s.account_id = a.id AND a.is_deleted = FALSE
       LEFT JOIN stakeholders sp1 ON s.primary_owner_id = sp1.id
       LEFT JOIN stakeholders sp2 ON s.secondary_owner_id = sp2.id
       LEFT JOIN stakeholders sp3 ON s.tertiary_owner_id = sp3.id
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
      `SELECT s.*, a.name AS account_name,
              sp1.name AS primary_owner_name,
              sp2.name AS secondary_owner_name,
              sp3.name AS tertiary_owner_name
       FROM stakeholders s
       LEFT JOIN accounts a ON s.account_id = a.id
       LEFT JOIN stakeholders sp1 ON s.primary_owner_id = sp1.id
       LEFT JOIN stakeholders sp2 ON s.secondary_owner_id = sp2.id
       LEFT JOIN stakeholders sp3 ON s.tertiary_owner_id = sp3.id
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
      `SELECT s.*, a.name AS account_name,
              sp1.name AS primary_owner_name,
              sp2.name AS secondary_owner_name,
              sp3.name AS tertiary_owner_name
       FROM stakeholders s
       LEFT JOIN accounts a ON s.account_id = a.id
       LEFT JOIN stakeholders sp1 ON s.primary_owner_id = sp1.id
       LEFT JOIN stakeholders sp2 ON s.secondary_owner_id = sp2.id
       LEFT JOIN stakeholders sp3 ON s.tertiary_owner_id = sp3.id
       WHERE s.id = $1 AND s.is_deleted = FALSE${scopeClause}`,
      [id, ...params],
    );
    if (!rows.length) throw new NotFoundException(`Stakeholder "${id}" not found`);
    return rowToStakeholder(rows[0]);
  }

  async create(data: any, userId?: string): Promise<Stakeholder> {
    const accountId = data.accountId && String(data.accountId).trim() ? data.accountId : null;
    await this.assertAccountExists(accountId, userId);
    await this.assertEmailAvailable(accountId, data.email);
    if (!data.email || !String(data.email).trim()) {
      await this.assertNameAvailable(accountId, data.name);
    }

    const primaryOwnerId = data.primaryOwnerId && String(data.primaryOwnerId).trim()
      ? data.primaryOwnerId
      : (data.primary_owner_id && String(data.primary_owner_id).trim() ? data.primary_owner_id : null);
    const secondaryOwnerId = data.secondaryOwnerId && String(data.secondaryOwnerId).trim()
      ? data.secondaryOwnerId
      : (data.secondary_owner_id && String(data.secondary_owner_id).trim() ? data.secondary_owner_id : null);
    const tertiaryOwnerId = data.tertiaryOwnerId && String(data.tertiaryOwnerId).trim()
      ? data.tertiaryOwnerId
      : (data.thirdOwnerId && String(data.thirdOwnerId).trim()
        ? data.thirdOwnerId
        : (data.tertiary_owner_id && String(data.tertiary_owner_id).trim() ? data.tertiary_owner_id : null));

    const level = data.level && String(data.level).trim() ? data.level : 'Level 3';

    const area = data.area && String(data.area).trim() ? data.area.trim() : null;
    const keyPriorities = data.keyPriorities && String(data.keyPriorities).trim() ? data.keyPriorities.trim() : null;
    const painPointsInsights = data.painPointsInsights && String(data.painPointsInsights).trim() ? data.painPointsInsights.trim() : null;
    const lastConnect = data.lastConnect && String(data.lastConnect).trim() ? String(data.lastConnect).trim().slice(0, 10) : null;
    const nextConnect = data.nextConnect && String(data.nextConnect).trim() ? String(data.nextConnect).trim().slice(0, 10) : null;
    const nextConnectStatus = data.nextConnectStatus && String(data.nextConnectStatus).trim() ? data.nextConnectStatus.trim() : null;
    const actionFollowUps = data.actionFollowUps && String(data.actionFollowUps).trim() ? data.actionFollowUps.trim() : null;
    const comments = data.comments && String(data.comments).trim() ? data.comments.trim() : null;
    const country = data.country && String(data.country).trim() ? data.country.trim() : null;
    const location = data.location && String(data.location).trim() ? data.location.trim() : null;
    const estimatedBudgetAvailable = data.estimatedBudgetAvailable != null && data.estimatedBudgetAvailable !== '' && !isNaN(Number(data.estimatedBudgetAvailable)) ? Number(data.estimatedBudgetAvailable) : null;
    const roleInDecision = data.roleInDecision && String(data.roleInDecision).trim() ? data.roleInDecision.trim() : null;

    const { rows } = await this.db.query(
      `INSERT INTO stakeholders (
         id, name, account_id, designation, influence, relationship, email, phone,
         stakeholder_type, department, linkedin_profile_url, primary_owner_id, secondary_owner_id, tertiary_owner_id, level,
         area, key_priorities, pain_points_insights, last_connect, next_connect, next_connect_status,
         action_follow_ups, comments, country, location, estimated_budget_available, role_in_decision
       )
       VALUES (
         gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
       )
       RETURNING *`,
      [
        data.name, accountId, data.designation ?? '', data.influence,
        data.relationship, data.email ?? '', data.phone ?? '',
        data.stakeholderType, data.department ?? null, data.linkedinProfileUrl ?? null,
        primaryOwnerId, secondaryOwnerId, tertiaryOwnerId, level,
        area, keyPriorities, painPointsInsights, lastConnect, nextConnect, nextConnectStatus,
        actionFollowUps, comments, country, location, estimatedBudgetAvailable, roleInDecision,
      ],
    );
    const stk = await this.findOne(rows[0].id, userId);
    this.logger.log(`Stakeholder created [id=${stk.id} name="${stk.name}" accountId=${stk.accountId ?? 'NULL'}]`);
    await this.log(`Added Stakeholder '${stk.name}'`, stk.accountId);

    const notifyUserId = await this.accountOwner(stk.accountId);
    if (notifyUserId) {
      this.logger.log(`Emitting Stakeholder:Created notification [userId=${notifyUserId} stakeholderId=${stk.id}]`);
      this.bus.emit({
        userId: notifyUserId,
        type: 'Stakeholder',
        eventType: 'Created',
        title: 'Stakeholder Added',
        message: `Stakeholder "${stk.name}" (${stk.designation || stk.influence}) has been added.`,
        severity: 'Info',
        notificationCategory: 'BUSINESS',
        accountId: stk.accountId,
        stakeholderId: stk.id,
      });
    } else {
      this.logger.warn(`Stakeholder created but account has no owner_id — notification suppressed [accountId=${stk.accountId}]`);
    }
    return stk;
  }

  async update(id: string, data: any, userId?: string): Promise<Stakeholder> {
    const existing = await this.findOne(id, userId);
    const accountId = data.accountId && String(data.accountId).trim() ? data.accountId : null;
    if (accountId !== null && accountId !== existing.accountId) {
      await this.assertAccountExists(accountId, userId);
    }
    await this.assertEmailAvailable(accountId ?? existing.accountId, data.email, id);

    const name = data.name !== undefined ? data.name : existing.name;
    const targetAccountId = accountId !== null ? accountId : existing.accountId;
    const designation = data.designation !== undefined ? (data.designation ?? '') : (existing.designation ?? '');
    const influence = data.influence !== undefined ? data.influence : existing.influence;
    const relationship = data.relationship !== undefined ? data.relationship : existing.relationship;
    const email = data.email !== undefined ? (data.email ?? '') : (existing.email ?? '');
    const phone = data.phone !== undefined ? (data.phone ?? '') : (existing.phone ?? '');
    const stakeholderType = data.stakeholderType !== undefined ? data.stakeholderType : existing.stakeholderType;
    const department = data.department !== undefined ? (data.department && String(data.department).trim() ? data.department.trim() : null) : (existing.department ?? null);
    const linkedinProfileUrl = data.linkedinProfileUrl !== undefined ? (data.linkedinProfileUrl && String(data.linkedinProfileUrl).trim() ? data.linkedinProfileUrl.trim() : null) : (existing.linkedinProfileUrl ?? null);

    const primaryOwnerId = data.primaryOwnerId !== undefined
      ? (data.primaryOwnerId && String(data.primaryOwnerId).trim() ? data.primaryOwnerId : null)
      : (existing.primaryOwnerId ?? null);
    const secondaryOwnerId = data.secondaryOwnerId !== undefined
      ? (data.secondaryOwnerId && String(data.secondaryOwnerId).trim() ? data.secondaryOwnerId : null)
      : (existing.secondaryOwnerId ?? null);
    const tertiaryOwnerId = data.tertiaryOwnerId !== undefined
      ? (data.tertiaryOwnerId && String(data.tertiaryOwnerId).trim() ? data.tertiaryOwnerId : null)
      : (data.thirdOwnerId !== undefined
        ? (data.thirdOwnerId && String(data.thirdOwnerId).trim() ? data.thirdOwnerId : null)
        : (existing.tertiaryOwnerId ?? null));
    const level = data.level !== undefined
      ? (data.level && String(data.level).trim() ? data.level : 'Level 3')
      : (existing.level ?? 'Level 3');

    // Manual edits allow intentionally clearing fields (sending null or empty string evaluates to null)
    const area = data.area !== undefined
      ? (data.area && String(data.area).trim() ? data.area.trim() : null)
      : (existing.area ?? null);
    const keyPriorities = data.keyPriorities !== undefined
      ? (data.keyPriorities && String(data.keyPriorities).trim() ? data.keyPriorities.trim() : null)
      : (existing.keyPriorities ?? null);
    const painPointsInsights = data.painPointsInsights !== undefined
      ? (data.painPointsInsights && String(data.painPointsInsights).trim() ? data.painPointsInsights.trim() : null)
      : (existing.painPointsInsights ?? null);
    const lastConnect = data.lastConnect !== undefined
      ? (data.lastConnect && String(data.lastConnect).trim() ? String(data.lastConnect).trim().slice(0, 10) : null)
      : (existing.lastConnect ?? null);
    const nextConnect = data.nextConnect !== undefined
      ? (data.nextConnect && String(data.nextConnect).trim() ? String(data.nextConnect).trim().slice(0, 10) : null)
      : (existing.nextConnect ?? null);
    const nextConnectStatus = data.nextConnectStatus !== undefined
      ? (data.nextConnectStatus && String(data.nextConnectStatus).trim() ? data.nextConnectStatus.trim() : null)
      : (existing.nextConnectStatus ?? null);
    const actionFollowUps = data.actionFollowUps !== undefined
      ? (data.actionFollowUps && String(data.actionFollowUps).trim() ? data.actionFollowUps.trim() : null)
      : (existing.actionFollowUps ?? null);
    const comments = data.comments !== undefined
      ? (data.comments && String(data.comments).trim() ? data.comments.trim() : null)
      : (existing.comments ?? null);
    const country = data.country !== undefined
      ? (data.country && String(data.country).trim() ? data.country.trim() : null)
      : (existing.country ?? null);
    const location = data.location !== undefined
      ? (data.location && String(data.location).trim() ? data.location.trim() : null)
      : (existing.location ?? null);
    const estimatedBudgetAvailable = data.estimatedBudgetAvailable !== undefined
      ? (data.estimatedBudgetAvailable != null && data.estimatedBudgetAvailable !== '' && !isNaN(Number(data.estimatedBudgetAvailable)) ? Number(data.estimatedBudgetAvailable) : null)
      : (existing.estimatedBudgetAvailable ?? null);
    const roleInDecision = data.roleInDecision !== undefined
      ? (data.roleInDecision && String(data.roleInDecision).trim() ? data.roleInDecision.trim() : null)
      : (existing.roleInDecision ?? null);

    const { rows } = await this.db.query(
      `UPDATE stakeholders SET
         name=$1, account_id=$2, designation=$3, influence=$4,
         relationship=$5, email=$6, phone=$7, stakeholder_type=$8, department=$9, linkedin_profile_url=$10,
         primary_owner_id=$11, secondary_owner_id=$12, tertiary_owner_id=$13, level=$14,
         area=$15, key_priorities=$16, pain_points_insights=$17, last_connect=$18, next_connect=$19,
         next_connect_status=$20, action_follow_ups=$21, comments=$22, country=$23, location=$24,
         estimated_budget_available=$25, role_in_decision=$26, updated_at=NOW()
       WHERE id=$27 AND is_deleted=FALSE RETURNING *`,
      [
        name, targetAccountId, designation, influence,
        relationship, email, phone,
        stakeholderType, department, linkedinProfileUrl,
        primaryOwnerId, secondaryOwnerId, tertiaryOwnerId, level,
        area, keyPriorities, painPointsInsights, lastConnect, nextConnect,
        nextConnectStatus, actionFollowUps, comments, country, location,
        estimatedBudgetAvailable, roleInDecision, id,
      ],
    );
    const stk = await this.findOne(rows[0].id, userId);
    await this.log(`Updated Stakeholder '${stk.name}'`, stk.accountId);

    const notifyUserId = await this.accountOwner(stk.accountId);
    if (notifyUserId) {
      this.logger.log(`Emitting Stakeholder:Updated notification [userId=${notifyUserId} stakeholderId=${stk.id}]`);
      this.bus.emit({
        userId: notifyUserId,
        type: 'Stakeholder',
        eventType: 'Updated',
        title: 'Stakeholder Updated',
        message: `Stakeholder "${stk.name}" details have been updated.`,
        severity: 'Info',
        notificationCategory: 'BUSINESS',
        accountId: stk.accountId,
        stakeholderId: stk.id,
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
        userId: notifyUserId,
        type: 'Stakeholder',
        eventType: 'Deleted',
        title: 'Stakeholder Removed',
        message: `Stakeholder "${stk.name}" has been removed.`,
        severity: 'Warning',
        notificationCategory: 'BUSINESS',
        accountId: stk.accountId,
        stakeholderId: stk.id,
      });
    }
    return { success: true };
  }

  /** Relational rule: the parent account must exist, be active, and be visible to the requesting user. */
  private async assertAccountExists(accountId?: string, userId?: string): Promise<void> {
    if (!accountId) return;
    if (userId) {
      const ctx = await this.access.getContext(userId);
      if (ctx.canViewAllAccounts || ctx.permissions.has('stakeholders:view-all')) {
        const { rows } = await this.db.query(
          `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE`,
          [accountId],
        );
        if (!rows.length) throw new BadRequestException('The selected account does not exist');
        return;
      }
    }
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

  /** Business rule: a stakeholder email is unique within its account or globally when unassociated. */
  private async assertEmailAvailable(accountId?: string | null, email?: string, excludeId?: string): Promise<void> {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return;
    const { rows } = await this.db.query(
      `SELECT s.id, a.name AS account_name FROM stakeholders s
       LEFT JOIN accounts a ON s.account_id = a.id
       WHERE LOWER(s.email) = $1 AND s.is_deleted = FALSE
         AND ($2::TEXT IS NULL OR s.account_id = $2 OR s.account_id IS NULL)
         AND ($3::TEXT IS NULL OR s.id <> $3)
       LIMIT 1`,
      [normalized, accountId ?? null, excludeId ?? null],
    );
    if (rows.length) {
      const accStr = rows[0].account_name ? ` for account "${rows[0].account_name}"` : '';
      throw new ConflictException(`A stakeholder with email "${email!.trim()}" already exists${accStr}.`);
    }
  }

  /** Business rule: a stakeholder name is unique within its account when email is not provided. */
  private async assertNameAvailable(accountId?: string | null, name?: string, excludeId?: string): Promise<void> {
    const normalized = name?.trim().toLowerCase();
    if (!normalized || !accountId) return;
    const { rows } = await this.db.query(
      `SELECT s.id FROM stakeholders s
       WHERE s.account_id = $1 AND LOWER(s.name) = $2 AND s.is_deleted = FALSE
         AND ($3::TEXT IS NULL OR s.id <> $3)
       LIMIT 1`,
      [accountId, normalized, excludeId ?? null],
    );
    if (rows.length) {
      throw new ConflictException(`A stakeholder named "${name!.trim()}" already exists for this account.`);
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
