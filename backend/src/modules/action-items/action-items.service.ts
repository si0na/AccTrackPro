import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams, FiscalContext } from '../../common/services/filter-context.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { ActionItem } from '../../types';
import { resolveOwnerName, extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';

// 'financialYear'/'quarter' remain listed so payloads from older clients are
// stripped instead of leaking into custom_data — fiscal periods are derived
// from dueDate and never stored.
const KNOWN = new Set([
  'id','title','accountId','accountName','opportunityId','owner','ownerId',
  'dueDate','priority','status','notes','completedDate',
  'financialYear','quarter',
]);

function rowToActionItem(row: any, derive: (date: string) => { financialYear: string; quarter: string }): ActionItem {
  const {
    custom_data, is_deleted, created_at, updated_at,
    account_id, account_name, opportunity_id, due_date, completed_date,
    owner_id, owner_name,
    ...base
  } = row;
  return {
    ...base,
    accountId:     account_id,
    accountName:   account_name ?? undefined,
    opportunityId: opportunity_id ?? undefined,
    ownerId:       owner_id   ?? undefined,
    owner:         base.owner || owner_name || '',
    dueDate:       due_date,
    completedDate: completed_date ?? undefined,
    // Read-only reporting labels derived from the business date (due date).
    ...derive(due_date),
    ...(custom_data || {}),
  } as ActionItem;
}

const AI_SELECT = `
  SELECT ai.*, u.name AS owner_name, a.name AS account_name
  FROM action_items ai
  LEFT JOIN accounts a ON ai.account_id = a.id
  LEFT JOIN users    u ON ai.owner_id   = u.id
`;

@Injectable()
export class ActionItemsService {
  private readonly logger = new Logger(ActionItemsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly bus: NotificationEventBus,
  ) {}

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
    const owner = this.filter.buildOwnerConditions('ai', f, 1);
    const where = ['ai.is_deleted = FALSE', ...owner.conditions].join(' AND ');

    const totalCol    = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${owner.nextIdx} OFFSET $${owner.nextIdx + 1}` : '';
    const qParams     = pg ? [...owner.params, pg.limit, pg.offset] : owner.params;

    const { rows } = await this.db.query(
      `SELECT ai.*, u.name AS owner_name, a.name AS account_name${totalCol}
       FROM action_items ai
       INNER JOIN accounts a ON ai.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN users    u ON ai.owner_id   = u.id
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
    const owner = this.filter.buildOwnerConditions('ai', f, 1);
    const where = ['ai.is_deleted = TRUE', ...owner.conditions].join(' AND ');
    // The accounts join has no is_deleted condition: the parent may itself be
    // deactivated (cascade) and its name must still appear in the list.
    const { rows } = await this.db.query(
      `${AI_SELECT} WHERE ${where} ORDER BY ai.updated_at DESC`,
      owner.params,
    );
    return rows.map(await this.mapper());
  }

  async findOne(id: string, userId?: string): Promise<ActionItem> {
    const { rows } = await this.db.query(
      `${AI_SELECT} WHERE ai.id = $1 AND ai.is_deleted = FALSE
       AND ($2::TEXT IS NULL OR ai.owner_id = $2)`,
      [id, userId ?? null],
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

    await this.assertValidRelations(data.accountId, data.opportunityId, data.ownerId);

    const cd   = extractCustomData(data, KNOWN);
    const ownerDisplayName = data.owner?.trim()
      ? data.owner.trim()
      : await resolveOwnerName(this.db, data.ownerId);

    const { rows } = await this.db.query(
      `INSERT INTO action_items
         (id, title, account_id, opportunity_id, owner_id, owner, due_date, priority, status, notes, completed_date, custom_data)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        data.title, data.accountId, data.opportunityId ?? null,
        data.ownerId ?? null, ownerDisplayName,
        data.dueDate ?? '', data.priority, data.status, data.notes ?? '',
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
    if (data.accountId !== existing.accountId || data.opportunityId !== existing.opportunityId) {
      await this.assertValidRelations(data.accountId, data.opportunityId, requestingUserId);
    }
    const cd = extractCustomData(data, KNOWN);

    // Ownership (owner_id) is preserved from DB — never changed by a regular
    // update. The owner *display name* is user-editable.
    const effectiveOwnerId = existing.ownerId ?? null;
    const ownerDisplayName =
      typeof data.owner === 'string' && data.owner.trim() ? data.owner.trim() : existing.owner;

    await this.db.query(
      `UPDATE action_items SET
         title=$1, account_id=$2, opportunity_id=$3, owner_id=$4, owner=$5, due_date=$6,
         priority=$7, status=$8, notes=$9, completed_date=$10,
         custom_data=$11, updated_at=NOW()
       WHERE id=$12 AND is_deleted=FALSE`,
      [
        data.title, data.accountId, data.opportunityId ?? null,
        effectiveOwnerId, ownerDisplayName,
        data.dueDate ?? '', data.priority, data.status, data.notes ?? '',
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
   * Relational rules: the parent account must exist, be active, and belong to the
   * requesting user; a linked opportunity (optional) must exist and belong to the same account.
   */
  private async assertValidRelations(accountId: string, opportunityId?: string | null, ownerId?: string): Promise<void> {
    const { rows: acct } = await this.db.query(
      `SELECT id FROM accounts WHERE id = $1 AND is_deleted = FALSE
       AND ($2::TEXT IS NULL OR owner_id = $2)`,
      [accountId, ownerId ?? null],
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
