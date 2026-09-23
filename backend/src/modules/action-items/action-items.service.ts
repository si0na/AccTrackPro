import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams, FiscalContext } from '../../common/services/filter-context.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { ActionItem } from '../../types';
import { extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';
import { validateDto } from '../../common/utils/validate-dto.util';
import { CreateActionItemDto } from './dto/action-item.dto';
import { ACTION_ITEM_FIELDS } from '../import-export/import-field-schemas';
import { BulkModuleAdapter } from '../import-export/bulk-adapter';

// 'financialYear'/'quarter' remain listed so payloads from older clients are
// stripped instead of leaking into custom_data — fiscal periods are derived
// from dueDate and never stored.
const KNOWN = new Set([
  'id', 'actionItemNumber', 'title', 'accountId', 'accountName', 'opportunityId', 'opportunityName', 'projectId', 'projectName', 'owner', 'ownerId', 'ownerStakeholderId',
  'ownerName', 'ownerDesignation', 'ownerStakeholderType',
  'openDate', 'dueDate', 'priority', 'status', 'actionItemType', 'notes', 'risksAndDependencies', 'nextAction', 'impediments', 'completedDate',
  'financialYear', 'quarter',
]);

/** Default open_date for rows created without one (e.g. older API clients). */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derives a deterministic 3-character uppercase prefix from an Account name.
 * Takes the first 3 alphabetic characters, upper-cased. If fewer than 3
 * alphabetic characters exist, pads with 'X'.
 */
export function generateAccountPrefix(accountName?: string): string {
  const cleanName = (accountName ?? '').trim();
  const alphas = cleanName.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (alphas.length >= 3) {
    return alphas.slice(0, 3);
  }
  return alphas.padEnd(3, 'X');
}

function rowToActionItem(row: any, derive: (date: string) => { financialYear: string; quarter: string }): ActionItem {
  const {
    custom_data, is_deleted, created_at, updated_at,
    account_id, account_name, opportunity_id, opportunity_name, project_id, project_name, open_date, due_date, completed_date,
    action_item_type, action_item_number,
    risks_and_dependencies, next_action, impediments,
    owner_id, owner_name,
    owner_stakeholder_id, stakeholder_owner_name, stakeholder_owner_designation, stakeholder_owner_type,
    ...base
  } = row;
  return {
    ...base,
    actionItemNumber: action_item_number ?? undefined,
    accountId: account_id,
    accountName: account_name ?? undefined,
    opportunityId: opportunity_id ?? undefined,
    opportunityName: opportunity_name ?? undefined,
    projectId: project_id ?? undefined,
    projectName: project_name ?? undefined,
    ownerId: owner_id ?? undefined,
    // Legacy free-text fallback, shown only for historical rows a stakeholder
    // backfill couldn't resolve (owner_stakeholder_id is NULL).
    owner: base.owner ?? undefined,
    ownerStakeholderId: owner_stakeholder_id ?? undefined,
    ownerName: stakeholder_owner_name ?? base.owner ?? '',
    ownerDesignation: stakeholder_owner_designation ?? undefined,
    ownerStakeholderType: stakeholder_owner_type ?? undefined,
    openDate: open_date,
    dueDate: due_date,
    actionItemType: action_item_type ?? undefined,
    completedDate: completed_date ?? undefined,
    risksAndDependencies: risks_and_dependencies ?? '',
    nextAction: next_action ?? '',
    impediments: impediments ?? '',
    // Read-only reporting labels derived from the business date (due date).
    ...derive(due_date),
    ...(custom_data || {}),
  } as ActionItem;
}

const AI_SELECT = `
  SELECT ai.*, COALESCE(NULLIF(u.name, ''), NULLIF(em_u.name, ''), u.email, em_u.email) AS owner_name, a.name AS account_name, proj.name AS project_name, opp.name AS opportunity_name,
         COALESCE(NULLIF(os.name, ''), os.email) AS stakeholder_owner_name, os.designation AS stakeholder_owner_designation,
         os.stakeholder_type AS stakeholder_owner_type
  FROM action_items ai
  LEFT JOIN accounts     a ON ai.account_id = a.id
  LEFT JOIN users        u ON ai.owner_id   = u.id
  LEFT JOIN employee_master em_u ON ai.owner_id = em_u.id
  LEFT JOIN projects     proj ON ai.project_id = proj.id
  LEFT JOIN opportunities opp ON ai.opportunity_id = opp.id
  LEFT JOIN stakeholders os ON ai.owner_stakeholder_id = os.id AND os.is_deleted = FALSE
`;

@Injectable()
export class ActionItemsService {
  private readonly logger = new Logger(ActionItemsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly access: AccessScopeService,
    private readonly bus: NotificationEventBus,
    private readonly permissions: PermissionsService,
  ) { }

  /**
   * Role-aware visibility fragment for the action_items alias `ai`. An action
   * item is visible when its parent account is visible. When userId is absent
   * (internal calls, e.g. re-reading a row just written) no scoping is applied;
   * view-all roles get no restriction.
   */
  private async childScope(userId: string | null, startIdx: number) {
    if (!userId) return { conditions: [], params: [], nextIdx: startIdx };
    const ctx = await this.access.getContext(userId);
    return this.access.buildActionItemVisibility('ai', ctx, startIdx);
  }

  /**
   * Bulk adapter used by the Global Import/Export service. Each action-item row
   * is validated against CreateActionItemDto and created/updated via the
   * standard paths, so account/opportunity relational checks, custom_data, audit
   * activity and notifications all apply per row. Duplicates are matched by
   * (title, account) within the requesting user's scope. The Account and
   * optional Opportunity references (incl. parents defined in the same workbook)
   * are resolved centrally by the global service before these hooks run.
   */
  bulkAdapter(userId: string): BulkModuleAdapter {
    return {
      moduleKey: 'actionItems',
      fields: ACTION_ITEM_FIELDS,
      postValidate: async (payload, raw) => {
        const errors: string[] = [];
        if (payload.projectId || raw?.projectId || raw?.Project || raw?.['Project Name']) {
          errors.push('Project Action Items cannot be imported or updated via Global Import/Export');
        }
        if (payload.accountId && payload.title) {
          const existingId = await this.findActiveByTitleAndAccount(payload.title, payload.accountId, userId);
          if (existingId) {
            const existing = await this.findOneRaw(existingId);
            if (existing && existing.projectId != null) {
              errors.push('Project Action Items cannot be imported or updated via Global Import/Export');
            }
          }
        }
        return errors;
      },
      validate: (row) => validateDto(CreateActionItemDto, row),
      naturalKey: (row) =>
        row.accountId && row.title ? `${row.accountId}::${String(row.title).trim().toLowerCase()}` : null,
      findExistingId: (row) => this.findActiveByTitleAndAccount(row.title, row.accountId, userId),
      create: (row) => {
        if (row.projectId) {
          throw new BadRequestException('Project Action Items cannot be imported or updated via Global Import/Export');
        }
        const { projectId, ...cleanRow } = row;
        return this.create({ ...cleanRow, ownerId: userId });
      },
      update: async (id, row) => {
        const existing = await this.findOneRaw(id);
        if (existing && existing.projectId != null) {
          throw new ForbiddenException('Project Action Items cannot be imported or updated via Global Import/Export');
        }
        if (row.projectId) {
          throw new BadRequestException('Project Action Items cannot be imported or updated via Global Import/Export');
        }
        const { projectId, ...cleanRow } = row;
        return this.update(id, cleanRow, userId);
      },
    };
  }

  private async findActiveByTitleAndAccount(
    title?: string,
    accountId?: string,
    ownerId?: string,
  ): Promise<string | null> {
    const t = String(title ?? '').trim();
    if (!t || !accountId) return null;
    const { rows } = await this.db.query(
      `SELECT id FROM action_items
       WHERE LOWER(TRIM(title)) = LOWER($1) AND account_id = $2 AND is_deleted = FALSE
         AND ($3::TEXT IS NULL OR owner_id = $3)
       LIMIT 1`,
      [t, accountId, ownerId ?? null],
    );
    return rows[0]?.id ?? null;
  }

  /** Row mapper that derives financialYear/quarter labels from due_date. */
  private async mapper(ctx?: FiscalContext): Promise<(row: any) => ActionItem> {
    const fiscal = ctx ?? await this.filter.getFiscalContext();
    return (row) => rowToActionItem(row, (d) => this.filter.derivePeriod(d, fiscal));
  }

  /**
   * Operational task list — never fiscal-period-filtered. Module-specific
   * filtering (owner, status, priority, due date) happens in the UI. The
   * response still carries financialYear/quarter labels derived from the due
   * date for reporting views.
   */
  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<ActionItem[] | Paginated<ActionItem>> {
    const f = this.filter.normalize(params);
    const scope = await this.childScope(f.userId, 1);
    const where = ['ai.is_deleted = FALSE', ...scope.conditions].join(' AND ');

    const totalCol = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${scope.nextIdx} OFFSET $${scope.nextIdx + 1}` : '';
    const qParams = pg ? [...scope.params, pg.limit, pg.offset] : scope.params;

    const { rows } = await this.db.query(
      `SELECT ai.*, u.name AS owner_name, a.name AS account_name, proj.name AS project_name, opp.name AS opportunity_name,
              COALESCE(NULLIF(os.name, ''), os.email) AS stakeholder_owner_name, os.designation AS stakeholder_owner_designation,
              os.stakeholder_type AS stakeholder_owner_type${totalCol}
       FROM action_items ai
       INNER JOIN accounts     a ON ai.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN users        u ON ai.owner_id   = u.id
       LEFT  JOIN projects     proj ON ai.project_id = proj.id
       LEFT  JOIN opportunities opp ON ai.opportunity_id = opp.id
       LEFT  JOIN stakeholders os ON ai.owner_stakeholder_id = os.id AND os.is_deleted = FALSE
       WHERE ${where}
       ORDER BY ai.created_at DESC${limitClause}`,
      qParams,
    );
    if (!pg) return rows.map(await this.mapper());

    const total = extractTotal(rows);
    return { data: rows.map(await this.mapper()), total, page: pg.page, pageSize: pg.pageSize };
  }

  async findAllDeactivated(params: FilterParams = {}): Promise<ActionItem[]> {
    const f = this.filter.normalize(params);
    const scope = await this.childScope(f.userId, 1);
    const where = ['ai.is_deleted = TRUE', ...scope.conditions].join(' AND ');
    // The accounts join has no is_deleted condition: the parent may itself be
    // deactivated (cascade) and its name must still appear in the list.
    const { rows } = await this.db.query(
      `${AI_SELECT} WHERE ${where} ORDER BY ai.updated_at DESC`,
      scope.params,
    );
    return rows.map(await this.mapper());
  }

  async findOne(id: string, userId?: string): Promise<ActionItem> {
    const { conditions, params } = await this.childScope(userId ?? null, 2);
    const scopeClause = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `${AI_SELECT} WHERE ai.id = $1 AND ai.is_deleted = FALSE${scopeClause}`,
      [id, ...params],
    );
    if (!rows.length) throw new NotFoundException(`ActionItem "${id}" not found`);
    return (await this.mapper())(rows[0]);
  }

  /** Unscoped raw fetch helper for internal permission checking before row scoping. */
  private async findOneRaw(id: string): Promise<{ id: string; projectId: string | null; accountId: string; title: string } | null> {
    const { rows } = await this.db.query(
      `SELECT ai.id, ai.project_id AS "projectId", ai.account_id AS "accountId", ai.title
       FROM action_items ai
       WHERE ai.id = $1 AND ai.is_deleted = FALSE`,
      [id],
    );
    return rows[0] ?? null;
  }

  async assertUpdatePermission(id: string, updateData: any, requestingUserId: string): Promise<void> {
    const existing = await this.findOneRaw(id);
    if (!existing) throw new NotFoundException(`ActionItem "${id}" not found`);

    const sourceModule = existing.projectId ? 'project-action-items' : 'action-items';
    const targetProjectId = 'projectId' in updateData ? updateData.projectId : existing.projectId;
    const targetModule = targetProjectId ? 'project-action-items' : 'action-items';

    const canSource = await this.permissions.can(requestingUserId, sourceModule, 'update');
    if (!canSource) {
      throw new ForbiddenException(`You do not have permission to update ${sourceModule}.`);
    }

    if (sourceModule !== targetModule) {
      const canTarget = await this.permissions.can(requestingUserId, targetModule, 'update');
      if (!canTarget) {
        throw new ForbiddenException(`You do not have permission to update ${targetModule}.`);
      }
    }
  }

  async assertDeletePermission(id: string, requestingUserId: string): Promise<void> {
    const existing = await this.findOneRaw(id);
    if (!existing) throw new NotFoundException(`ActionItem "${id}" not found`);

    const requiredModule = existing.projectId ? 'project-action-items' : 'action-items';
    const allowed = await this.permissions.can(requestingUserId, requiredModule, 'delete');
    if (!allowed) {
      throw new ForbiddenException(`You do not have permission to delete ${requiredModule}.`);
    }
  }

  async create(data: any, requestingUserId?: string): Promise<ActionItem> {
    this.logger.log(`Creating action item [title="${data.title}" accountId=${data.accountId} ownerId=${data.ownerId ?? 'MISSING'}]`);

    if (!data.ownerId) {
      this.logger.error(
        'ActionItem creation attempted without ownerId — JwtAuthGuard may not be active on this route.',
      );
    }

    await this.assertValidRelations(data.accountId, data.opportunityId, data.projectId, requestingUserId ?? data.ownerId);
    if (data.ownerStakeholderId) {
      await this.assertOwnerStakeholder(data.ownerStakeholderId, data.accountId);
    }

    const cd = extractCustomData(data, KNOWN);

    // Fetch account name to derive prefix
    const { rows: acctRows } = await this.db.query(`SELECT name FROM accounts WHERE id = $1`, [data.accountId]);
    const accountName = acctRows[0]?.name ?? '';
    const prefix = generateAccountPrefix(accountName);

    const createdId = await this.db.withTransaction(async (client) => {
      // Lock and increment sequence counter row per account prefix atomically
      const { rows: seqRows } = await client.query(
        `INSERT INTO action_item_sequences (prefix, last_seq)
         VALUES ($1, 1)
         ON CONFLICT (prefix) DO UPDATE SET last_seq = action_item_sequences.last_seq + 1
         RETURNING last_seq`,
        [prefix],
      );
      const seqNum = seqRows[0].last_seq;
      const formattedNum = `${prefix}-${String(seqNum).padStart(4, '0')}`;

      const { rows } = await client.query(
        `INSERT INTO action_items
           (id, action_item_number, title, account_id, opportunity_id, project_id, owner_id, owner_stakeholder_id, open_date, due_date, priority, status, action_item_type, notes, risks_and_dependencies, next_action, impediments, completed_date, custom_data)
         VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          formattedNum,
          data.title, data.accountId, data.opportunityId ?? null, data.projectId ?? null,
          data.ownerId ?? null, data.ownerStakeholderId ?? null,
          data.openDate || todayIsoDate(), data.dueDate ?? '', data.priority, data.status,
          data.actionItemType ?? null, data.notes ?? '',
          data.risksAndDependencies ?? '',
          data.nextAction ?? '',
          data.impediments ?? '',
          data.completedDate ?? null, JSON.stringify(cd),
        ],
      );
      return rows[0].id;
    });

    const item = await this.findOne(createdId);
    this.logger.log(`Action item created [id=${item.id} ownerId=${item.ownerId ?? 'NULL'}]`);
    await this.log(`Created Action Item '${item.title}'`, item.accountId, data.ownerId);

    if (item.ownerId) {
      this.logger.log(`Emitting ActionItem:Created notification [userId=${item.ownerId} actionItemId=${item.id}]`);
      this.bus.emit({
        userId: item.ownerId,
        type: 'ActionItem',
        eventType: 'Created',
        title: 'Action Item Created',
        message: `Action item "${item.title}" has been created.`,
        severity: 'Info',
        notificationCategory: 'BUSINESS',
        accountId: item.accountId,
        actionItemId: item.id,
      });
    } else {
      this.logger.warn(`ActionItem created without ownerId — notification suppressed [actionItemId=${item.id}]`);
    }
    return item;
  }

  /**
   * @param requestingUserId UUID of the authenticated user (enforces ownership + audit).
   */
  async update(id: string, data: any, requestingUserId?: string): Promise<ActionItem> {
    const existing = await this.findOne(id, requestingUserId);

    const targetActionItemNumber = ('actionItemNumber' in data && data.actionItemNumber !== undefined)
      ? (data.actionItemNumber?.trim() || existing.actionItemNumber)
      : existing.actionItemNumber;
    const targetTitle = data.title ?? existing.title;
    const targetAccountId = data.accountId ?? existing.accountId;
    const targetOpportunityId = 'opportunityId' in data ? (data.opportunityId ?? null) : existing.opportunityId;
    const targetProjectId = 'projectId' in data ? (data.projectId ?? null) : existing.projectId;
    const ownerStakeholderId = ('ownerStakeholderId' in data && data.ownerStakeholderId !== undefined)
      ? (data.ownerStakeholderId || null)
      : existing.ownerStakeholderId;
    const openDate = data.openDate || existing.openDate;
    const dueDate = 'dueDate' in data ? (data.dueDate ?? '') : existing.dueDate;
    const priority = data.priority ?? existing.priority;
    const status = data.status ?? existing.status;
    const actionItemType = 'actionItemType' in data ? (data.actionItemType ?? null) : (existing.actionItemType ?? null);
    const notes = 'notes' in data ? (data.notes ?? '') : existing.notes;
    const risksAndDependencies = 'risksAndDependencies' in data ? (data.risksAndDependencies ?? '') : existing.risksAndDependencies;
    const completedDate = 'completedDate' in data ? (data.completedDate ?? null) : existing.completedDate;

    const nextAction = 'nextAction' in data ? (data.nextAction ?? '') : existing.nextAction;
    const impediments = 'impediments' in data ? (data.impediments ?? '') : existing.impediments;

    if (targetAccountId !== existing.accountId || targetOpportunityId !== existing.opportunityId || targetProjectId !== existing.projectId) {
      await this.assertValidRelations(targetAccountId, targetOpportunityId, targetProjectId, requestingUserId);
    }
    if (ownerStakeholderId && (ownerStakeholderId !== existing.ownerStakeholderId || targetAccountId !== existing.accountId)) {
      await this.assertOwnerStakeholder(ownerStakeholderId, targetAccountId);
    }

    // Application-level uniqueness validation for Action Item #
    if (targetActionItemNumber && targetActionItemNumber !== existing.actionItemNumber) {
      const { rows: dupRows } = await this.db.query(
        `SELECT id FROM action_items WHERE LOWER(TRIM(action_item_number)) = LOWER(TRIM($1)) AND id != $2 AND is_deleted = FALSE LIMIT 1`,
        [targetActionItemNumber, id],
      );
      if (dupRows.length > 0) {
        throw new ConflictException(`Action Item # "${targetActionItemNumber}" is already in use`);
      }
    }

    const cd = extractCustomData(data, KNOWN);

    // Ownership (owner_id) is preserved from DB — never changed by a regular update.
    const effectiveOwnerId = existing.ownerId ?? null;

    try {
      await this.db.query(
        `UPDATE action_items SET
           action_item_number=$1, title=$2, account_id=$3, opportunity_id=$4, project_id=$5, owner_id=$6, owner_stakeholder_id=$7, open_date=$8, due_date=$9,
           priority=$10, status=$11, action_item_type=$12, notes=$13, risks_and_dependencies=$14, next_action=$15, impediments=$16, completed_date=$17,
           custom_data=$18, updated_at=NOW()
         WHERE id=$19 AND is_deleted=FALSE`,
        [
          targetActionItemNumber, targetTitle, targetAccountId, targetOpportunityId, targetProjectId,
          effectiveOwnerId, ownerStakeholderId,
          openDate, dueDate, priority, status, actionItemType, notes,
          risksAndDependencies, nextAction, impediments, completedDate, JSON.stringify(cd),
          id,
        ],
      );
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('idx_ai_action_item_number')) {
        throw new ConflictException(`Action Item # "${targetActionItemNumber}" is already in use`);
      }
      throw err;
    }
    const item = await this.findOne(id);

    // Track field changes for history
    const changes: string[] = [];
    const normStr = (v: unknown) => String(v ?? '').trim();
    if ('actionItemNumber' in data && normStr(existing.actionItemNumber) !== normStr(targetActionItemNumber)) {
      const oldVal = normStr(existing.actionItemNumber) || 'None';
      const newVal = normStr(targetActionItemNumber) || 'None';
      changes.push(`Action Item #: [ ${oldVal} ] → [ ${newVal} ]`);
    }
    if ('nextAction' in data && normStr(existing.nextAction) !== normStr(nextAction)) {
      const oldVal = normStr(existing.nextAction) || 'None';
      const newVal = normStr(nextAction) || 'None';
      changes.push(`Next Action: [ ${oldVal} ] → [ ${newVal} ]`);
    }
    if ('impediments' in data && normStr(existing.impediments) !== normStr(impediments)) {
      const oldVal = normStr(existing.impediments) || 'None';
      const newVal = normStr(impediments) || 'None';
      changes.push(`Impediments: [ ${oldVal} ] → [ ${newVal} ]`);
    }

    let logMessage = `Updated Action Item '${item.title}'`;
    if (changes.length > 0) {
      logMessage += ` — ${changes.join(' | ')}`;
    }
    await this.log(logMessage, item.accountId, requestingUserId);

    if (item.ownerId) {
      if (item.status === 'Completed' && existing.status !== 'Completed') {
        this.logger.log(`Emitting ActionItem:Completed [userId=${item.ownerId} actionItemId=${item.id}]`);
        this.bus.emit({
          userId: item.ownerId,
          type: 'ActionItem',
          eventType: 'Completed',
          title: 'Action Item Completed',
          message: `Action item "${item.title}" has been marked as completed.`,
          severity: 'Success',
          notificationCategory: 'BUSINESS',
          accountId: item.accountId,
          actionItemId: item.id,
        });
      } else if (item.status !== existing.status) {
        this.logger.log(`Emitting ActionItem:StatusChanged [userId=${item.ownerId} ${existing.status}→${item.status}]`);
        this.bus.emit({
          userId: item.ownerId,
          type: 'ActionItem',
          eventType: 'StatusChanged',
          title: 'Action Item Status Updated',
          message: `Action item "${item.title}" status changed to ${item.status}.`,
          severity: 'Info',
          notificationCategory: 'BUSINESS',
          accountId: item.accountId,
          actionItemId: item.id,
        });
      } else {
        this.logger.log(`Emitting ActionItem:Updated [userId=${item.ownerId} actionItemId=${item.id}]`);
        this.bus.emit({
          userId: item.ownerId,
          type: 'ActionItem',
          eventType: 'Updated',
          title: 'Action Item Updated',
          message: `Action item "${item.title}" has been updated.`,
          severity: 'Info',
          notificationCategory: 'BUSINESS',
          accountId: item.accountId,
          actionItemId: item.id,
        });
      }
    }
    return item;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const item = await this.findOne(id, userId);
    await this.db.query(`UPDATE action_items SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1`, [id]);
    await this.log(`Deleted Action Item '${item.title}'`, item.accountId);

    if (item.ownerId) {
      this.bus.emit({
        userId: item.ownerId,
        type: 'ActionItem',
        eventType: 'Deactivated',
        title: 'Action Item Removed',
        message: `Action item "${item.title}" has been removed.`,
        severity: 'Warning',
        notificationCategory: 'BUSINESS',
        accountId: item.accountId,
        actionItemId: item.id,
      });
    }
    return { success: true };
  }

  /**
   * Relational & authorization rules:
   * 1. The parent account must exist and be active.
   * 2. If opportunityId is provided, it must exist and belong to accountId.
   * 3. If projectId is provided, it must exist, be active, belong to accountId, AND be visible to requestingUserId via canonical buildProjectVisibility.
   * 4. If projectId is NOT provided, accountId must be visible to requestingUserId via buildAccountVisibility.
   */
  private async assertValidRelations(
    accountId: string,
    opportunityId?: string | null,
    projectId?: string | null,
    requestingUserId?: string,
  ): Promise<void> {
    const { rows: acct } = await this.db.query(
      `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE`,
      [accountId],
    );
    if (!acct.length) throw new BadRequestException('The selected account does not exist');

    if (opportunityId) {
      const { rows: opp } = await this.db.query(
        `SELECT account_id, stage FROM opportunities WHERE id = $1 AND is_deleted = FALSE`,
        [opportunityId],
      );
      if (!opp.length) throw new BadRequestException('The linked opportunity does not exist');
      if (opp[0].account_id !== accountId) {
        throw new BadRequestException('The linked opportunity belongs to a different account');
      }
    }

    if (projectId) {
      const scope = requestingUserId
        ? await this.access.buildProjectVisibility('p', await this.access.getContext(requestingUserId), 2)
        : { conditions: [] as string[], params: [] as any[], nextIdx: 2 };
      const scopeClause = scope.conditions.length ? ` AND ${scope.conditions.join(' AND ')}` : '';
      const { rows: proj } = await this.db.query(
        `SELECT p.account_id FROM projects p WHERE p.id = $1 AND p.is_deleted = FALSE${scopeClause}`,
        [projectId, ...scope.params],
      );
      if (!proj.length) throw new BadRequestException('The selected project does not exist');
      if (proj[0].account_id !== accountId) {
        throw new BadRequestException('The linked project belongs to a different account');
      }
    } else if (requestingUserId) {
      const scope = this.access.buildAccountVisibility('a', await this.access.getContext(requestingUserId), 2);
      const scopeClause = scope.conditions.length ? ` AND ${scope.conditions.join(' AND ')}` : '';
      const { rows: acctWithScope } = await this.db.query(
        `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE${scopeClause}`,
        [accountId, ...scope.params],
      );
      if (!acctWithScope.length) throw new BadRequestException('The selected account does not exist');
    }
  }

  /** Owner must be an active stakeholder (Client or Service Provider). */
  private async assertOwnerStakeholder(stakeholderId?: string | null, accountId?: string): Promise<void> {
    if (!stakeholderId || !stakeholderId.trim()) return;
    const { rows } = await this.db.query(
      `SELECT id FROM stakeholders WHERE id = $1 AND is_deleted = FALSE`,
      [stakeholderId],
    );
    if (!rows.length) throw new BadRequestException('The selected Owner is not a valid active stakeholder');
  }

  private async log(text: string, accountId?: string, userId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'actionItem', $1, $2, 'System', $3)`,
        [text, userId ?? null, accountId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
