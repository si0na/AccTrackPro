import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import type {
  NotificationCategory,
  NotificationType,
  NotificationEventType,
  NotificationSeverity,
} from '../../common/events/notification.events';
import { toIsoString } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';

// Re-export types so that legacy imports of these names from this file continue to resolve.
export type { NotificationCategory, NotificationType, NotificationEventType, NotificationSeverity };

export interface CreateNotificationDto {
  userId:               string;
  type:                 NotificationType;
  eventType:            NotificationEventType;
  title:                string;
  message:              string;
  severity:             NotificationSeverity;
  notificationCategory: NotificationCategory;
  accountId?:           string;
  opportunityId?:       string;
  actionItemId?:        string;
  stakeholderId?:       string;
  documentId?:          string;
  metadata?:            Record<string, unknown>;
}

function rowToNotification(row: any): any {
  return {
    id:                   row.id,
    userId:               row.user_id,
    type:                 row.type,
    eventType:            row.event_type,
    title:                row.title,
    message:              row.message,
    severity:             row.severity,
    notificationCategory: row.notification_category,
    accountId:            row.account_id     ?? undefined,
    opportunityId:        row.opportunity_id ?? undefined,
    actionItemId:         row.action_item_id ?? undefined,
    stakeholderId:        row.stakeholder_id ?? undefined,
    documentId:           row.document_id    ?? undefined,
    isRead:               row.is_read,
    createdAt:            toIsoString(row.created_at),
    readAt:               toIsoString(row.read_at),
    metadata: row.metadata || {},
  };
}

/**
 * Shared WHERE fragment for findAll and getUnreadCount.
 *
 * Notifications are scoped to the authenticated user only. They are never
 * fiscal-period-filtered: accounts (their usual anchor) have no fiscal
 * dimension in the date-driven model, and a notification is relevant to its
 * recipient regardless of the reporting period selected in the UI.
 */
const NOTIFICATION_WHERE = `n.user_id = $1`;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
  ) {}

  /**
   * Persist a notification.
   *
   * Guards:
   *  • Returns early (with a warn log) when userId is empty.
   *  • Validates userId exists in users table before INSERT to give a clear
   *    error instead of an FK violation at the DB level.
   *  • Throws on all other DB errors so the caller (listener) can log them.
   */
  async create(dto: CreateNotificationDto): Promise<void> {
    if (!dto.userId) {
      this.logger.warn(
        `Notification dropped — empty userId [type=${dto.type} eventType=${dto.eventType}]`,
      );
      return;
    }

    // Validate FK before inserting — gives a structured error instead of a pg FK violation
    const { rows: userRows } = await this.db.query(
      `SELECT id FROM users WHERE id = $1`,
      [dto.userId],
    );
    if (!userRows.length) {
      this.logger.warn(
        `Notification dropped — userId not found in users table [userId=${dto.userId} type=${dto.type}]`,
      );
      return;
    }

    await this.db.query(
      `INSERT INTO notifications
         (id, user_id, type, event_type, title, message, severity, notification_category,
          account_id, opportunity_id, action_item_id, stakeholder_id, document_id, metadata)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        dto.userId,
        dto.type,
        dto.eventType,
        dto.title,
        dto.message,
        dto.severity,
        dto.notificationCategory,
        dto.accountId      ?? null,
        dto.opportunityId  ?? null,
        dto.actionItemId   ?? null,
        dto.stakeholderId  ?? null,
        dto.documentId     ?? null,
        JSON.stringify(dto.metadata ?? {}),
      ],
    );

    this.logger.log(
      `Notification persisted [type=${dto.type} eventType=${dto.eventType} userId=${dto.userId} category=${dto.notificationCategory}]`,
    );
  }

  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
    filters: { category?: string; unreadOnly?: boolean } = {},
  ): Promise<any[] | Paginated<any>> {
    const f = this.filter.normalize(params);
    if (!f.userId) return pg ? { data: [], total: 0, page: pg.page, pageSize: pg.pageSize } : [];

    // Optional list filters: notification category (BUSINESS/SYSTEM, backed by
    // idx_notif_user_cat) and unread-only (backed by idx_notif_unread).
    const conditions = [NOTIFICATION_WHERE];
    const qParams: any[] = [f.userId];
    if (filters.category === 'BUSINESS' || filters.category === 'SYSTEM') {
      qParams.push(filters.category);
      conditions.push(`n.notification_category = $${qParams.length}`);
    }
    if (filters.unreadOnly) conditions.push('n.is_read = FALSE');
    const where = conditions.join(' AND ');

    if (!pg) {
      // Legacy behaviour: newest 200 as a plain array.
      const { rows } = await this.db.query(
        `SELECT n.*
         FROM notifications n
         WHERE ${where}
         ORDER BY n.created_at DESC
         LIMIT 200`,
        qParams,
      );
      this.logger.debug(`findAll returned ${rows.length} notifications [userId=${f.userId}]`);
      return rows.map(rowToNotification);
    }

    const { rows } = await this.db.query(
      `SELECT n.*, COUNT(*) OVER()::INTEGER AS __total
       FROM notifications n
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT $${qParams.length + 1} OFFSET $${qParams.length + 2}`,
      [...qParams, pg.limit, pg.offset],
    );
    const total = extractTotal(rows);
    return { data: rows.map(rowToNotification), total, page: pg.page, pageSize: pg.pageSize };
  }

  async getUnreadCount(params: FilterParams = {}): Promise<number> {
    const f = this.filter.normalize(params);
    if (!f.userId) return 0;

    const { rows } = await this.db.query(
      `SELECT COUNT(*)::INTEGER AS count
       FROM notifications n
       WHERE ${NOTIFICATION_WHERE}
         AND n.is_read = FALSE`,
      [f.userId],
    );
    return rows[0]?.count ?? 0;
  }

  async markRead(id: string, userId?: string): Promise<{ success: boolean }> {
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND ($2::TEXT IS NULL OR user_id = $2)`,
      [id, userId ?? null],
    );
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: boolean }> {
    if (!userId) return { success: false };
    await this.db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    );
    return { success: true };
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    await this.db.query(
      `DELETE FROM notifications WHERE id = $1 AND ($2::TEXT IS NULL OR user_id = $2)`,
      [id, userId ?? null],
    );
    return { success: true };
  }

  async clearRead(userId: string): Promise<{ success: boolean }> {
    if (!userId) return { success: false };
    await this.db.query(
      `DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE`,
      [userId],
    );
    return { success: true };
  }
}
