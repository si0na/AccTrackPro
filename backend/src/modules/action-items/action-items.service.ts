import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams, FiscalContext } from '../../common/services/filter-context.service';
import { AccessScopeService } from '../rbac/access-scope.service';
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
  'id','title','accountId','accountName','opportunityId','projectId','projectName','owner','ownerId','ownerStakeholderId',
  'ownerName','ownerDesignation','ownerStakeholderType',
  'openDate','dueDate','priority','status','notes','risksAndDependencies','completedDate',
  'financialYear','quarter',
]);

/** Default open_date for rows created without one (e.g. older API clients). */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function rowToActionItem(row: any, derive: (date: string) => { financialYear: string; quarter: string }): ActionItem {
  const {
    custom_data, is_deleted, created_at, updated_at,
    account_id, account_name, opportunity_id, project_id, project_name, open_date, due_date, completed_date,
    risks_and_dependencies,
    owner_id, owner_name,
    owner_stakeholder_id, stakeholder_owner_name, stakeholder_owner_designation, stakeholder_owner_type,
    ...base
  } = row;
  return {
    ...base,
    accountId:     account_id,
    accountName:   account_name ?? undefined,
    opportunityId: opportunity_id ?? undefined,
    projectId:     project_id ?? undefined,
    projectName:   project_name ?? undefined,
    ownerId:       owner_id   ?? undefined,
    // Legacy free-text fallback, shown only for historical rows a stakeholder
    // backfill couldn't resolve (owner_stakeholder_id is NULL).
    owner:                base.owner ?? undefined,
    ownerStakeholderId:   owner_stakeholder_id ?? undefined,
    ownerName:            stakeholder_owner_name ?? base.owner ?? '',
    ownerDesignation:     stakeholder_owner_designation ?? undefined,
    ownerStakeholderType: stakeholder_owner_type ?? undefined,
    openDate:      open_date,
    dueDate:       due_date,
    completedDate: completed_date ?? undefined,
    risksAndDependencies: risks_and_dependencies ?? '',
    // Read-only reporting labels derived from the business date (due date).
    ...derive(due_date),
    ...(custom_data || {}),
  } as ActionItem;
}

const AI_SELECT = `
  SELECT ai.*, u.name AS owner_name, a.name AS account_name, proj.name AS project_name,
         COALESCE(NULLIF(os.name, ''), os.email) AS stakeholder_owner_name, os.designation AS stakeholder_owner_designation,
         os.stakeholder_type AS stakeholder_owner_type
  FROM action_items ai
  LEFT JOIN accounts     a ON ai.account_id = a.id
  LEFT JOIN users        u ON ai.owner_id   = u.id
  LEFT JOIN projects     proj ON ai.project_id = proj.id
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
  ) {}

  /**
   * Role-aware visibility fragment for the action_items alias `ai`. An action
   * item is visible when its parent account is visible. When userId is absent
   * (internal calls, e.g. re-reading a row just written) no scoping is applied;
   * view-all roles get no restriction.
   */
  private async childScope(userId: string | null, startIdx: number) {
    if (!userId) return { conditions: [], params: [], nextIdx: startIdx };
    const ctx = await this.access.getContext(userId);
    return this.access.buildChildVisibility('ai', ctx, startIdx);
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
      validate: (row) => validateDto(CreateActionItemDto, row),
      naturalKey: (row) =>
        row.accountId && row.title ? `${row.accountId}::${String(row.title).trim().toLowerCase()}` : null,
      findExistingId: (row) => this.findActiveByTitleAndAccount(row.title, row.accountId, userId),
      create: (row) => this.create({ ...row, ownerId: userId }),
      update: (id, row) => this.update(id, row, userId),
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

    const totalCol    = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${scope.nextIdx} OFFSET $${scope.nextIdx + 1}` : '';
    const qParams     = pg ? [...scope.params, pg.limit, pg.offset] : scope.params;

    const { rows } = await this.db.query(
      `SELECT ai.*, u.name AS owner_name, a.name AS account_name, proj.name AS project_name,
              COALESCE(NULLIF(os.name, ''), os.email) AS stakeholder_owner_name, os.designation AS stakeholder_owner_designation,
              os.stakeholder_type AS stakeholder_owner_type${totalCol}
       FROM action_items ai
       INNER JOIN accounts     a ON ai.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN users        u ON ai.owner_id   = u.id
       LEFT  JOIN projects     proj ON ai.project_id = proj.id
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

  async create(data: any): Promise<ActionItem> {
    this.logger.log(`Creating action item [title="${data.title}" accountId=${data.accountId} ownerId=${data.ownerId ?? 'MISSING'}]`);

    if (!data.ownerId) {
      this.logger.error(
        'ActionItem creation attempted without ownerId — JwtAuthGuard may not be active on this route.',
      );
    }

    await this.assertValidRelations(data.accountId, data.opportunityId, data.projectId, data.ownerId);
    await this.assertOwnerStakeholder(data.ownerStakeholderId, data.accountId);

    const cd = extractCustomData(data, KNOWN);

    const { rows } = await this.db.query(
      `INSERT INTO action_items
         (id, title, account_id, opportunity_id, project_id, owner_id, owner_stakeholder_id, open_date, due_date, priority, status, notes, risks_and_dependencies, completed_date, custom_data)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        data.title, data.accountId, data.opportunityId ?? null, data.projectId ?? null,
        data.ownerId ?? null, data.ownerStakeholderId,
        data.openDate || todayIsoDate(), data.dueDate ?? '', data.priority, data.status, data.notes ?? '',
        data.risksAndDependencies ?? '',
        data.completedDate ?? null, JSON.stringify(cd),
      ],
    );
    const item = await this.findOne(rows[0].id);
    this.logger.log(`Action item created [id=${item.id} ownerId=${item.ownerId ?? 'NULL'}]`);
    await this.log(`Created Action Item '${item.title}'`, item.accountId, data.ownerId);

    if (item.ownerId) {
      this.logger.log(`Emitting ActionItem:Created notification [userId=${item.ownerId} actionItemId=${item.id}]`);
      this.bus.emit({
        userId:               item.ownerId,
        type:                 'ActionItem',
        eventType:            'Created',
        title:                'Action Item Created',
        message:              `Action item "${item.title}" has been created.`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId:            item.accountId,
        actionItemId:         item.id,
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
    if (data.accountId !== existing.accountId || data.opportunityId !== existing.opportunityId || data.projectId !== existing.projectId) {
      await this.assertValidRelations(data.accountId, data.opportunityId, data.projectId, requestingUserId);
    }
    if (data.ownerStakeholderId !== existing.ownerStakeholderId || data.accountId !== existing.accountId) {
      await this.assertOwnerStakeholder(data.ownerStakeholderId, data.accountId);
    }
    const cd = extractCustomData(data, KNOWN);

    // Ownership (owner_id) is preserved from DB — never changed by a regular update.
    const effectiveOwnerId = existing.ownerId ?? null;

    await this.db.query(
      `UPDATE action_items SET
         title=$1, account_id=$2, opportunity_id=$3, project_id=$4, owner_id=$5, owner_stakeholder_id=$6, open_date=$7, due_date=$8,
         priority=$9, status=$10, notes=$11, risks_and_dependencies=$12, completed_date=$13,
         custom_data=$14, updated_at=NOW()
       WHERE id=$15 AND is_deleted=FALSE`,
      [
        data.title, data.accountId, data.opportunityId ?? null, data.projectId ?? null,
        effectiveOwnerId, data.ownerStakeholderId,
        data.openDate || existing.openDate, data.dueDate ?? '', data.priority, data.status, data.notes ?? '',
        data.risksAndDependencies ?? '',
        data.completedDate ?? null, JSON.stringify(cd),
        id,
      ],
    );
    const item = await this.findOne(id);
    await this.log(`Updated Action Item '${item.title}'`, item.accountId, requestingUserId);

    if (item.ownerId) {
      if (item.status === 'Completed' && existing.status !== 'Completed') {
        this.logger.log(`Emitting ActionItem:Completed [userId=${item.ownerId} actionItemId=${item.id}]`);
        this.bus.emit({
          userId:               item.ownerId,
          type:                 'ActionItem',
          eventType:            'Completed',
          title:                'Action Item Completed',
          message:              `Action item "${item.title}" has been marked as completed.`,
          severity:             'Success',
          notificationCategory: 'BUSINESS',
          accountId:            item.accountId,
          actionItemId:         item.id,
        });
      } else if (item.status !== existing.status) {
        this.logger.log(`Emitting ActionItem:StatusChanged [userId=${item.ownerId} ${existing.status}→${item.status}]`);
        this.bus.emit({
          userId:               item.ownerId,
          type:                 'ActionItem',
          eventType:            'StatusChanged',
          title:                'Action Item Status Updated',
          message:              `Action item "${item.title}" status changed to ${item.status}.`,
          severity:             'Info',
          notificationCategory: 'BUSINESS',
          accountId:            item.accountId,
          actionItemId:         item.id,
        });
      } else {
        this.logger.log(`Emitting ActionItem:Updated [userId=${item.ownerId} actionItemId=${item.id}]`);
        this.bus.emit({
          userId:               item.ownerId,
          type:                 'ActionItem',
          eventType:            'Updated',
          title:                'Action Item Updated',
          message:              `Action item "${item.title}" has been updated.`,
          severity:             'Info',
          notificationCategory: 'BUSINESS',
          accountId:            item.accountId,
          actionItemId:         item.id,
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
        userId:               item.ownerId,
        type:                 'ActionItem',
        eventType:            'Deactivated',
        title:                'Action Item Removed',
        message:              `Action item "${item.title}" has been removed.`,
        severity:             'Warning',
        notificationCategory: 'BUSINESS',
        accountId:            item.accountId,
        actionItemId:         item.id,
      });
    }
    return { success: true };
  }

  /**
   * Relational rules: the parent account must exist, be active, and be VISIBLE to
   * the requesting user (role-aware, not owner-only); a linked opportunity
   * (optional) must exist and belong to the same account; a linked project
   * (optional) must exist, be active, and belong to the same account.
   */
  private async assertValidRelations(
    accountId: string,
    opportunityId?: string | null,
    projectId?: string | null,
    ownerId?: string,
  ): Promise<void> {
    const scope = ownerId
      ? this.access.buildAccountVisibility('a', await this.access.getContext(ownerId), 2)
      : { conditions: [] as string[], params: [] as any[], nextIdx: 2 };
    const scopeClause = scope.conditions.length ? ` AND ${scope.conditions.join(' AND ')}` : '';
    const { rows: acct } = await this.db.query(
      `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE${scopeClause}`,
      [accountId, ...scope.params],
    );
    if (!acct.length) throw new BadRequestException('The selected account does not exist');

    if (opportunityId) {
      const { rows: opp } = await this.db.query(
        `SELECT account_id FROM opportunities WHERE id = $1 AND is_deleted = FALSE
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [opportunityId, ownerId ?? null],
      );
      if (!opp.length) throw new BadRequestException('The linked opportunity does not exist');
      if (opp[0].account_id !== accountId) {
        throw new BadRequestException('The linked opportunity belongs to a different account');
      }
    }

    if (projectId) {
      const { rows: proj } = await this.db.query(
        `SELECT account_id FROM projects WHERE id = $1 AND is_deleted = FALSE
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [projectId, ownerId ?? null],
      );
      if (!proj.length) throw new BadRequestException('The linked project does not exist');
      if (proj[0].account_id !== accountId) {
        throw new BadRequestException('The linked project belongs to a different account');
      }
    }
  }

  /** Owner must be an active stakeholder (Client or Service Provider). */
  private async assertOwnerStakeholder(stakeholderId: string, accountId: string): Promise<void> {
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
