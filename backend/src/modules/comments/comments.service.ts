import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { Comment } from '../../types';
import { toIsoString } from '../../common/utils/db-mapping.util';

function rowToComment(row: any): Comment {
  const { user_name, user_id, user_display_name, target_type, target_id, created_at, ...base } = row;
  return {
    ...base,
    targetType: target_type,
    targetId:   target_id,
    user:       user_display_name ?? user_name ?? '',
    timestamp:  toIsoString(created_at),
  } as Comment;
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly bus: NotificationEventBus,
  ) {}

  /**
   * Returns comments on records owned by the requesting user. When no userId
   * is provided (legacy / admin path) all comments are returned.
   */
  async findAll(userId?: string): Promise<Comment[]> {
    if (!userId) {
      const { rows } = await this.db.query(
        `SELECT c.*, u.name AS user_display_name
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         ORDER BY c.created_at DESC`,
      );
      return rows.map(rowToComment);
    }

    // Only return comments on records the requesting user owns.
    const { rows } = await this.db.query(
      `SELECT c.*, u.name AS user_display_name
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE (
         (c.target_type = 'account' AND EXISTS (
           SELECT 1 FROM accounts WHERE id = c.target_id AND owner_id = $1 AND is_deleted = FALSE
         )) OR
         (c.target_type = 'opportunity' AND EXISTS (
           SELECT 1 FROM opportunities WHERE id = c.target_id AND owner_id = $1 AND is_deleted = FALSE
         )) OR
         (c.target_type = 'actionItem' AND EXISTS (
           SELECT 1 FROM action_items WHERE id = c.target_id AND owner_id = $1 AND is_deleted = FALSE
         ))
       )
       ORDER BY c.created_at DESC`,
      [userId],
    );
    return rows.map(rowToComment);
  }

  async create(data: any): Promise<Comment> {
    // Resolve display name from users table if userId (UUID) is provided
    let displayName = data.user || '';
    if (data.userId) {
      const { rows: uRows } = await this.db.query(
        `SELECT name FROM users WHERE id = $1`, [data.userId],
      );
      displayName = uRows[0]?.name || displayName;
    }

    // Relational rule: the comment target must exist AND belong to the requesting
    // user before the insert — prevents cross-user comment creation.
    let targetName = data.targetId;
    let accountId: string | undefined;
    if (data.targetType === 'account') {
      const { rows: r } = await this.db.query(
        `SELECT name FROM accounts WHERE id = $1
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [data.targetId, data.userId ?? null],
      );
      if (!r.length) throw new BadRequestException('The record being commented on does not exist');
      targetName = r[0].name;
      accountId = data.targetId;
    } else if (data.targetType === 'opportunity') {
      const { rows: r } = await this.db.query(
        `SELECT name, account_id FROM opportunities WHERE id = $1
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [data.targetId, data.userId ?? null],
      );
      if (!r.length) throw new BadRequestException('The record being commented on does not exist');
      targetName = r[0].name; accountId = r[0].account_id;
    } else if (data.targetType === 'actionItem') {
      const { rows: r } = await this.db.query(
        `SELECT title, account_id FROM action_items WHERE id = $1
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [data.targetId, data.userId ?? null],
      );
      if (!r.length) throw new BadRequestException('The record being commented on does not exist');
      targetName = r[0].title; accountId = r[0].account_id;
    }

    const { rows } = await this.db.query(
      `INSERT INTO comments (id, target_type, target_id, user_id, user_name, text)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5)
       RETURNING *`,
      [data.targetType, data.targetId, data.userId ?? null, displayName, data.text],
    );
    const comment = rowToComment(rows[0]);

    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name)
         VALUES (gen_random_uuid()::TEXT, 'general', $1, $2, $3)`,
        [`Comment added by ${displayName} on ${targetName}`, data.userId ?? null, displayName],
      );
    } catch (err) {
      this.logger.warn('Failed to log activity for comment creation', err);
    }

    if (data.userId) {
      // Carry the most specific record reference so clicking the notification
      // opens the commented record, not just its parent account.
      this.bus.emit({
        userId:               data.userId,
        type:                 'Comment',
        eventType:            'CommentAdded',
        title:                'Comment Added',
        message:              `You added a comment on "${targetName}".`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId,
        opportunityId:        data.targetType === 'opportunity' ? data.targetId : undefined,
        actionItemId:         data.targetType === 'actionItem' ? data.targetId : undefined,
        metadata:             { targetType: data.targetType, targetId: data.targetId },
      });
    }

    return comment;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    // Verify the comment was written by the requesting user before deleting.
    const { rowCount } = await this.db.query(
      `DELETE FROM comments WHERE id = $1
       AND ($2::TEXT IS NULL OR user_id = $2)`,
      [id, userId ?? null],
    );
    if (!rowCount) throw new NotFoundException(`Comment "${id}" not found`);
    return { success: true };
  }
}
