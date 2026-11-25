import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GraphMailService } from '../auth/graph-mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  renderActionItemCreatedEmail,
  renderActionItemDueReminderEmail,
  ActionItemCreatedEmailParams,
  ActionItemDueReminderEmailParams,
} from './action-item-email.template';
import {
  getNotificationCutoffDate,
  formatDateInTimezone,
  isDateOnOrAfterCutoff,
} from './action-item-cutoff.util';

export interface ActionItemRecipientInfo {
  actionItemId: string;
  actionItemNumber?: string;
  title: string;
  notes?: string;
  accountId: string;
  accountName: string;
  opportunityId?: string;
  opportunityName?: string;
  projectId?: string;
  priority: string;
  status: string;
  dueDate: string;
  createdAt: string;
  isDeleted: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerUserId: string | null;
  creatorName: string;
}

export interface DualChannelResult {
  inApp: boolean;
  email: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NOTIFICATION_TYPE_CREATED = 'ACTION_ITEM_CREATED';
export const NOTIFICATION_TYPE_DUE = 'ACTION_ITEM_DUE';

@Injectable()
export class ActionItemNotificationsService {
  private readonly logger = new Logger(ActionItemNotificationsService.name);
  private readonly maxAttempts: number;

  constructor(
    private readonly db: DatabaseService,
    private readonly mail: GraphMailService,
    private readonly notifications: NotificationsService,
  ) {
    this.maxAttempts = parseInt(process.env.ACTION_ITEM_DUE_REMINDER_MAX_ATTEMPTS || '3', 10);
  }

  /**
   * Assignment Notification when an Action Item is created and assigned.
   *
   * Dispatches an immediate Outlook email and ReflectOne in-app notification to the assigned owner.
   * Both channels operate independently with separate tracking and failure isolation.
   */
  async sendCreationNotification(
    actionItemId: string,
    creatorUserId?: string,
  ): Promise<DualChannelResult> {
    this.logger.log(`Processing creation notifications [actionItemId=${actionItemId}]`);
    const result: DualChannelResult = { inApp: false, email: false };

    try {
      const info = await this.resolveActionItemInfo(actionItemId, creatorUserId);
      if (!info) {
        this.logger.warn(`Action item not found for creation notification [actionItemId=${actionItemId}]`);
        return result;
      }

      // Check if owner is assigned
      const hasAssignedOwner = Boolean(
        info.ownerUserId ||
        (info.ownerEmail && EMAIL_REGEX.test(info.ownerEmail)) ||
        (info.ownerName && info.ownerName !== 'Task Owner')
      );

      // ── Channel 1: In-App Notification (Preserved) ─────────────────────────
      try {
        result.inApp = await this.dispatchCreationInApp(info);
      } catch (inAppErr: any) {
        this.logger.error(
          `In-app creation notification failed [actionItemId=${actionItemId}]: ${inAppErr.message}`,
          inAppErr.stack,
        );
      }

      // ── Channel 2: Outlook Email Notification ─────────────────────────────
      // Send immediate email to the assigned owner if an owner and valid email are present
      // Safeguard: Check production notification cutoff date against persisted created_at
      const cutoffDate = getNotificationCutoffDate();
      const createdDateInTz = formatDateInTimezone(info.createdAt);
      const isEligibleForCreationEmail = isDateOnOrAfterCutoff(createdDateInTz, cutoffDate);

      if (!isEligibleForCreationEmail) {
        this.logger.log(
          `Outlook creation email suppressed [actionItemId=${actionItemId}]: Persisted created_at (${createdDateInTz}) is before cutoff (${cutoffDate})`,
        );
        result.email = false;
      } else if (hasAssignedOwner && info.ownerEmail && EMAIL_REGEX.test(info.ownerEmail)) {
        try {
          result.email = await this.dispatchCreationEmail(info);
        } catch (emailErr: any) {
          this.logger.error(
            `Outlook email creation notification failed [actionItemId=${actionItemId}]: ${emailErr.message}`,
            emailErr.stack,
          );
        }
      } else {
        this.logger.log(
          `Outlook creation email skipped [actionItemId=${actionItemId}]: No assigned owner or valid recipient email (${info.ownerEmail || 'none'})`,
        );
        result.email = false;
      }

      return result;
    } catch (err: any) {
      this.logger.error(
        `Unexpected error in sendCreationNotification [actionItemId=${actionItemId}]: ${err.message}`,
        err.stack,
      );
      return result;
    }
  }

  /**
   * Dual-Channel Reminder when an Action Item reaches its scheduled due date.
   *
   * Dispatches both Outlook email and ReflectOne in-app notification to the assigned owner.
   * Both channels operate independently with separate tracking and retry capabilities.
   */
  async sendDueReminder(
    actionItemId: string,
    targetDueDate: string,
  ): Promise<DualChannelResult> {
    this.logger.log(`Processing due reminder dual-channel notifications [actionItemId=${actionItemId} dueDate=${targetDueDate}]`);
    const result: DualChannelResult = { inApp: false, email: false };

    try {
      const info = await this.resolveActionItemInfo(actionItemId);
      if (!info) {
        this.logger.warn(`Action item not found for due reminder [actionItemId=${actionItemId}]`);
        return result;
      }

      if (info.isDeleted) {
        this.logger.log(`Action item is deleted — due reminder suppressed [actionItemId=${actionItemId}]`);
        return result;
      }

      if (info.status === 'Completed' || info.status === 'Cancelled') {
        this.logger.log(`Action item status is "${info.status}" — due reminder suppressed [actionItemId=${actionItemId}]`);
        return result;
      }

      if (!info.dueDate || info.dueDate !== targetDueDate) {
        this.logger.log(
          `Action item due date "${info.dueDate}" does not match target "${targetDueDate}" — due reminder skipped [actionItemId=${actionItemId}]`,
        );
        return result;
      }

      // Safeguard: Check production notification cutoff date against targetDueDate
      const cutoffDate = getNotificationCutoffDate();
      if (!isDateOnOrAfterCutoff(targetDueDate, cutoffDate)) {
        this.logger.log(
          `Due reminder suppressed [actionItemId=${actionItemId}]: Due date (${targetDueDate}) is before notification cutoff (${cutoffDate})`,
        );
        return result;
      }

      // ── Channel 1: In-App Due Reminder ────────────────────────────────────
      try {
        result.inApp = await this.dispatchDueReminderInApp(info, targetDueDate);
      } catch (inAppErr: any) {
        this.logger.error(
          `In-app due reminder failed [actionItemId=${actionItemId}]: ${inAppErr.message}`,
          inAppErr.stack,
        );
      }

      // ── Channel 2: Outlook Email Due Reminder ─────────────────────────────
      try {
        result.email = await this.dispatchDueReminderEmail(info, targetDueDate);
      } catch (emailErr: any) {
        this.logger.error(
          `Outlook email due reminder failed [actionItemId=${actionItemId}]: ${emailErr.message}`,
          emailErr.stack,
        );
      }

      return result;
    } catch (err: any) {
      this.logger.error(
        `Unexpected error in sendDueReminder [actionItemId=${actionItemId}]: ${err.message}`,
        err.stack,
      );
      return result;
    }
  }

  /**
   * Handles action item due date changes.
   * Cancels any un-sent (PENDING/FAILED) reminders on both channels for the previous due date,
   * while preserving historical SENT records.
   */
  async handleDueDateChanged(
    actionItemId: string,
    oldDueDate?: string,
    newDueDate?: string,
  ): Promise<void> {
    if (!oldDueDate || oldDueDate === newDueDate) return;

    this.logger.log(
      `Handling due date change [actionItemId=${actionItemId} oldDueDate=${oldDueDate} newDueDate=${newDueDate}]`,
    );

    try {
      await this.db.query(
        `DELETE FROM action_item_notifications
         WHERE action_item_id = $1
           AND notification_type IN ('ACTION_ITEM_DUE', 'DUE')
           AND due_date = $2
           AND status IN ('PENDING', 'FAILED')`,
        [actionItemId, oldDueDate],
      );
    } catch (err: any) {
      this.logger.error(`Failed to cleanup pending due reminder on date change: ${err.message}`);
    }
  }

  /**
   * Handles action item completion.
   * Cancels any un-sent reminders on both channels.
   */
  async handleActionItemCompleted(actionItemId: string): Promise<void> {
    this.logger.log(`Handling completion [actionItemId=${actionItemId}] — cleaning pending reminders`);
    try {
      await this.db.query(
        `DELETE FROM action_item_notifications
         WHERE action_item_id = $1
           AND notification_type IN ('ACTION_ITEM_DUE', 'DUE')
           AND status IN ('PENDING', 'FAILED')`,
        [actionItemId],
      );
    } catch (err: any) {
      this.logger.error(`Failed to cleanup pending due reminder on completion: ${err.message}`);
    }
  }

  /**
   * Handles action item cancellation.
   * Cancels any un-sent reminders on both channels.
   */
  async handleActionItemCancelled(actionItemId: string): Promise<void> {
    return this.handleActionItemCompleted(actionItemId);
  }

  /**
   * Handles action item deletion.
   * Cancels any un-sent reminders on both channels.
   */
  async handleActionItemDeleted(actionItemId: string): Promise<void> {
    this.logger.log(`Handling deletion [actionItemId=${actionItemId}] — cleaning pending reminders`);
    try {
      await this.db.query(
        `DELETE FROM action_item_notifications
         WHERE action_item_id = $1
           AND notification_type IN ('ACTION_ITEM_DUE', 'DUE')
           AND status IN ('PENDING', 'FAILED')`,
        [actionItemId],
      );
    } catch (err: any) {
      this.logger.error(`Failed to cleanup pending due reminder on deletion: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private Channel Dispatch Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async dispatchCreationInApp(info: ActionItemRecipientInfo): Promise<boolean> {
    const { rows: existing } = await this.db.query(
      `SELECT id, status FROM action_item_notifications
       WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'IN_APP'`,
      [info.actionItemId],
    );

    if (existing.length > 0 && existing[0].status === 'SENT') {
      return true;
    }

    if (!info.ownerUserId) {
      const errorMsg = 'Assigned owner has no linked ReflectOne user account for in-app delivery';
      this.logger.warn(`In-app creation notification skipped [actionItemId=${info.actionItemId}]: ${errorMsg}`);
      await this.upsertNotificationRow({
        id: existing[0]?.id || null,
        actionItemId: info.actionItemId,
        notificationType: 'ACTION_ITEM_CREATED',
        channel: 'IN_APP',
        dueDate: '',
        recipientEmail: '',
        recipientUserId: null,
        recipientName: info.ownerName,
        status: 'FAILED',
        errorDetails: errorMsg,
        attemptCount: (existing[0]?.attempt_count || 0) + 1,
      });
      return false;
    }

    await this.upsertNotificationRow({
      id: existing[0]?.id || null,
      actionItemId: info.actionItemId,
      notificationType: 'ACTION_ITEM_CREATED',
      channel: 'IN_APP',
      dueDate: '',
      recipientEmail: '',
      recipientUserId: info.ownerUserId,
      recipientName: info.ownerName,
      status: 'PENDING',
      errorDetails: null,
      attemptCount: (existing[0]?.attempt_count || 0) + 1,
    });

    const notifId = await this.notifications.create({
      userId: info.ownerUserId,
      type: 'ActionItem',
      eventType: 'Assigned',
      title: 'New Action Item Assigned',
      message: `You have been assigned "${info.title}".`,
      severity: 'Info',
      notificationCategory: 'BUSINESS',
      accountId: info.accountId,
      opportunityId: info.opportunityId,
      actionItemId: info.actionItemId,
      metadata: {
        actionItemId: info.actionItemId,
        actionItemNumber: info.actionItemNumber,
        dueDate: info.dueDate,
        priority: info.priority,
        status: info.status,
        creatorName: info.creatorName,
      },
    });

    if (notifId) {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'SENT', sent_at = NOW(), in_app_notification_id = $2, error_details = NULL, updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'IN_APP'`,
        [info.actionItemId, notifId],
      );
      this.logger.log(`In-app creation notification delivered [actionItemId=${info.actionItemId} userId=${info.ownerUserId}]`);
      return true;
    } else {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'FAILED', error_details = 'NotificationsService did not persist row', updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'IN_APP'`,
        [info.actionItemId],
      );
      return false;
    }
  }

  private async dispatchCreationEmail(info: ActionItemRecipientInfo): Promise<boolean> {
    const cutoffDate = getNotificationCutoffDate();
    const createdDateInTz = formatDateInTimezone(info.createdAt);
    if (!isDateOnOrAfterCutoff(createdDateInTz, cutoffDate)) {
      this.logger.log(
        `Outlook creation email suppressed in dispatch [actionItemId=${info.actionItemId}]: created_at (${createdDateInTz}) is before cutoff (${cutoffDate})`,
      );
      return false;
    }

    const { rows: existing } = await this.db.query(
      `SELECT id, status, attempt_count FROM action_item_notifications
       WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'EMAIL'`,
      [info.actionItemId],
    );

    if (existing.length > 0 && existing[0].status === 'SENT') {
      return true;
    }

    const hasValidEmail = Boolean(info.ownerEmail && EMAIL_REGEX.test(info.ownerEmail));
    const notifId = existing[0]?.id || null;

    if (!hasValidEmail) {
      const errorMsg = info.ownerEmail
        ? `Invalid owner email address: "${info.ownerEmail}"`
        : 'Assigned owner has no valid email address';
      this.logger.warn(`Outlook creation email skipped [actionItemId=${info.actionItemId}]: ${errorMsg}`);

      await this.upsertNotificationRow({
        id: notifId,
        actionItemId: info.actionItemId,
        notificationType: 'ACTION_ITEM_CREATED',
        channel: 'EMAIL',
        dueDate: '',
        recipientEmail: info.ownerEmail || 'missing@reflectone.local',
        recipientUserId: info.ownerUserId,
        recipientName: info.ownerName,
        status: 'FAILED',
        errorDetails: errorMsg,
        attemptCount: (existing[0]?.attempt_count || 0) + 1,
      });
      return false;
    }

    await this.upsertNotificationRow({
      id: notifId,
      actionItemId: info.actionItemId,
      notificationType: 'ACTION_ITEM_CREATED',
      channel: 'EMAIL',
      dueDate: '',
      recipientEmail: info.ownerEmail,
      recipientUserId: info.ownerUserId,
      recipientName: info.ownerName,
      status: 'PENDING',
      errorDetails: null,
      attemptCount: (existing[0]?.attempt_count || 0) + 1,
    });

    const emailParams: ActionItemCreatedEmailParams = {
      id: info.actionItemId,
      actionItemNumber: info.actionItemNumber,
      title: info.title,
      notes: info.notes,
      accountName: info.accountName,
      opportunityName: info.opportunityName,
      projectId: info.projectId,
      priority: info.priority,
      status: info.status,
      dueDate: info.dueDate,
      ownerName: info.ownerName,
      creatorName: info.creatorName,
      createdAt: info.createdAt,
    };

    const { subject, html } = renderActionItemCreatedEmail(emailParams);
    const sent = await this.mail.sendMail(info.ownerEmail, subject, html);

    if (sent) {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'SENT', sent_at = NOW(), error_details = NULL, updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'EMAIL'`,
        [info.actionItemId],
      );
      this.logger.log(`Outlook creation email delivered [actionItemId=${info.actionItemId} to=<${info.ownerEmail}>]`);
      return true;
    } else {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'FAILED', error_details = 'Microsoft Graph delivery returned false', updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'EMAIL'`,
        [info.actionItemId],
      );
      return false;
    }
  }

  private async dispatchDueReminderInApp(
    info: ActionItemRecipientInfo,
    targetDueDate: string,
  ): Promise<boolean> {
    const { rows: existing } = await this.db.query(
      `SELECT id, status FROM action_item_notifications
       WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_DUE', 'DUE') AND channel = 'IN_APP' AND due_date = $2`,
      [info.actionItemId, targetDueDate],
    );

    if (existing.length > 0 && existing[0].status === 'SENT') {
      return true;
    }

    if (!info.ownerUserId) {
      const errorMsg = 'Assigned owner has no linked ReflectOne user account for in-app delivery';
      this.logger.warn(`In-app due reminder skipped [actionItemId=${info.actionItemId}]: ${errorMsg}`);
      await this.upsertNotificationRow({
        id: existing[0]?.id || null,
        actionItemId: info.actionItemId,
        notificationType: 'ACTION_ITEM_DUE',
        channel: 'IN_APP',
        dueDate: targetDueDate,
        recipientEmail: '',
        recipientUserId: null,
        recipientName: info.ownerName,
        status: 'FAILED',
        errorDetails: errorMsg,
        attemptCount: (existing[0]?.attempt_count || 0) + 1,
      });
      return false;
    }

    await this.upsertNotificationRow({
      id: existing[0]?.id || null,
      actionItemId: info.actionItemId,
      notificationType: 'ACTION_ITEM_DUE',
      channel: 'IN_APP',
      dueDate: targetDueDate,
      recipientEmail: '',
      recipientUserId: info.ownerUserId,
      recipientName: info.ownerName,
      status: 'PENDING',
      errorDetails: null,
      attemptCount: (existing[0]?.attempt_count || 0) + 1,
    });

    const notifId = await this.notifications.create({
      userId: info.ownerUserId,
      type: 'ActionItem',
      eventType: 'StatusChanged',
      title: 'Action Item Due Today',
      message: `"${info.title}" is due today. Please review its status.`,
      severity: 'Warning',
      notificationCategory: 'BUSINESS',
      accountId: info.accountId,
      opportunityId: info.opportunityId,
      actionItemId: info.actionItemId,
      metadata: {
        actionItemId: info.actionItemId,
        actionItemNumber: info.actionItemNumber,
        dueDate: info.dueDate,
        priority: info.priority,
        status: info.status,
      },
    });

    if (notifId) {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'SENT', sent_at = NOW(), in_app_notification_id = $3, error_details = NULL, updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_DUE', 'DUE') AND channel = 'IN_APP' AND due_date = $2`,
        [info.actionItemId, targetDueDate, notifId],
      );
      this.logger.log(`In-app due reminder delivered [actionItemId=${info.actionItemId} dueDate=${targetDueDate}]`);
      return true;
    } else {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'FAILED', error_details = 'NotificationsService did not persist row', updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_DUE', 'DUE') AND channel = 'IN_APP' AND due_date = $2`,
        [info.actionItemId, targetDueDate],
      );
      return false;
    }
  }

  private async dispatchDueReminderEmail(
    info: ActionItemRecipientInfo,
    targetDueDate: string,
  ): Promise<boolean> {
    const cutoffDate = getNotificationCutoffDate();
    if (!isDateOnOrAfterCutoff(targetDueDate, cutoffDate)) {
      this.logger.log(
        `Outlook due reminder email suppressed in dispatch [actionItemId=${info.actionItemId}]: targetDueDate (${targetDueDate}) is before cutoff (${cutoffDate})`,
      );
      return false;
    }

    const { rows: existing } = await this.db.query(
      `SELECT id, status, attempt_count FROM action_item_notifications
       WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_DUE', 'DUE') AND channel = 'EMAIL' AND due_date = $2`,
      [info.actionItemId, targetDueDate],
    );

    if (existing.length > 0) {
      if (existing[0].status === 'SENT') {
        return true;
      }
      if (existing[0].status === 'FAILED' && existing[0].attempt_count >= this.maxAttempts) {
        this.logger.warn(`Max retry attempts (${this.maxAttempts}) reached for Outlook due reminder [actionItemId=${info.actionItemId}]`);
        return false;
      }
    }

    const hasValidEmail = Boolean(info.ownerEmail && EMAIL_REGEX.test(info.ownerEmail));
    const notifId = existing[0]?.id || null;

    if (!hasValidEmail) {
      const errorMsg = info.ownerEmail
        ? `Invalid owner email address: "${info.ownerEmail}"`
        : 'Assigned owner has no valid email address';
      this.logger.warn(`Outlook due reminder skipped [actionItemId=${info.actionItemId}]: ${errorMsg}`);

      await this.upsertNotificationRow({
        id: notifId,
        actionItemId: info.actionItemId,
        notificationType: 'ACTION_ITEM_DUE',
        channel: 'EMAIL',
        dueDate: targetDueDate,
        recipientEmail: info.ownerEmail || 'missing@reflectone.local',
        recipientUserId: info.ownerUserId,
        recipientName: info.ownerName,
        status: 'FAILED',
        errorDetails: errorMsg,
        attemptCount: (existing[0]?.attempt_count || 0) + 1,
      });
      return false;
    }

    await this.upsertNotificationRow({
      id: notifId,
      actionItemId: info.actionItemId,
      notificationType: 'ACTION_ITEM_DUE',
      channel: 'EMAIL',
      dueDate: targetDueDate,
      recipientEmail: info.ownerEmail,
      recipientUserId: info.ownerUserId,
      recipientName: info.ownerName,
      status: 'PENDING',
      errorDetails: null,
      attemptCount: (existing[0]?.attempt_count || 0) + 1,
    });

    let todayStr: string;
    try {
      const tz = process.env.APP_TIMEZONE || process.env.TZ || 'UTC';
      todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch {
      todayStr = new Date().toISOString().slice(0, 10);
    }
    const isOverdue = Boolean(info.dueDate && info.dueDate < todayStr);

    const emailParams: ActionItemDueReminderEmailParams = {
      id: info.actionItemId,
      actionItemNumber: info.actionItemNumber,
      title: info.title,
      notes: info.notes,
      accountName: info.accountName,
      opportunityName: info.opportunityName,
      projectId: info.projectId,
      priority: info.priority,
      status: info.status,
      dueDate: info.dueDate,
      ownerName: info.ownerName,
      isOverdue,
    };

    const { subject, html } = renderActionItemDueReminderEmail(emailParams);
    const sent = await this.mail.sendMail(info.ownerEmail, subject, html);

    if (sent) {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'SENT', sent_at = NOW(), error_details = NULL, updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_DUE', 'DUE') AND channel = 'EMAIL' AND due_date = $2`,
        [info.actionItemId, targetDueDate],
      );
      this.logger.log(`Outlook due reminder delivered [actionItemId=${info.actionItemId} dueDate=${targetDueDate} to=<${info.ownerEmail}>]`);
      return true;
    } else {
      await this.db.query(
        `UPDATE action_item_notifications
         SET status = 'FAILED', error_details = 'Microsoft Graph delivery returned false', updated_at = NOW()
         WHERE action_item_id = $1 AND notification_type IN ('ACTION_ITEM_DUE', 'DUE') AND channel = 'EMAIL' AND due_date = $2`,
        [info.actionItemId, targetDueDate],
      );
      return false;
    }
  }

  /**
   * Resolves complete Action Item details, including owner email, linked user ID, and creator name.
   */
  private async resolveActionItemInfo(
    actionItemId: string,
    creatorUserId?: string,
  ): Promise<ActionItemRecipientInfo | null> {
    const { rows } = await this.db.query(
      `SELECT
         ai.id,
         ai.action_item_number,
         ai.title,
         ai.notes,
         ai.priority,
         ai.status,
         ai.due_date,
         ai.created_at,
         ai.is_deleted,
         ai.account_id,
         ai.opportunity_id,
         ai.project_id,
         ai.owner_id,
         ai.owner_stakeholder_id,
         a.name AS account_name,
         opp.name AS opportunity_name,
         -- Stakeholder owner info
         os.name AS stakeholder_name,
         os.email AS stakeholder_email,
         os.user_id AS stakeholder_user_id,
         os_u.id AS os_u_id,
         os_u.name AS os_u_name,
         os_u.email AS os_u_email,
         os_em.name AS os_em_name,
         os_em.email AS os_em_email,
         -- Direct user owner info
         u.id AS direct_u_id,
         u.name AS user_name,
         u.email AS user_email,
         em.name AS em_name,
         em.email AS em_email,
         -- Legacy owner text
         ai.owner AS legacy_owner
       FROM action_items ai
       LEFT JOIN accounts a ON ai.account_id = a.id
       LEFT JOIN opportunities opp ON ai.opportunity_id = opp.id
       LEFT JOIN stakeholders os ON ai.owner_stakeholder_id = os.id AND os.is_deleted = FALSE
       LEFT JOIN users os_u ON os.user_id = os_u.id
       LEFT JOIN employee_master os_em ON os.employee_id = os_em.id
       LEFT JOIN users u ON ai.owner_id = u.id
       LEFT JOIN employee_master em ON ai.owner_id = em.id
       WHERE ai.id = $1`,
      [actionItemId],
    );

    if (!rows.length) return null;
    const r = rows[0];

    const ownerEmail = (
      r.stakeholder_email ||
      r.os_u_email ||
      r.os_em_email ||
      r.user_email ||
      r.em_email ||
      ''
    ).trim().toLowerCase();

    const ownerName = (
      r.stakeholder_name ||
      r.os_u_name ||
      r.os_em_name ||
      r.user_name ||
      r.em_name ||
      r.legacy_owner ||
      'Task Owner'
    ).trim();

    // Resolve owner's ReflectOne User ID for in-app delivery
    let ownerUserId: string | null = r.stakeholder_user_id || r.os_u_id || r.direct_u_id || null;

    // If stakeholder has an email but user_id was not explicitly linked, lookup users by email
    if (!ownerUserId && ownerEmail) {
      const { rows: userLookup } = await this.db.query(
        `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [ownerEmail],
      );
      if (userLookup.length > 0) {
        ownerUserId = userLookup[0].id;
      }
    }

    // Resolve creator name
    let creatorName = 'System';
    if (creatorUserId) {
      const { rows: creatorRows } = await this.db.query(
        `SELECT name, email FROM users WHERE id = $1`,
        [creatorUserId],
      );
      if (creatorRows.length > 0) {
        creatorName = creatorRows[0].name || creatorRows[0].email || 'System';
      }
    } else if (r.user_name || r.user_email) {
      creatorName = r.user_name || r.user_email;
    }

    return {
      actionItemId: r.id,
      actionItemNumber: r.action_item_number || undefined,
      title: r.title,
      notes: r.notes || '',
      accountId: r.account_id,
      accountName: r.account_name || 'Account',
      opportunityId: r.opportunity_id || undefined,
      opportunityName: r.opportunity_name || undefined,
      projectId: r.project_id || undefined,
      priority: r.priority,
      status: r.status,
      dueDate: r.due_date || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      isDeleted: Boolean(r.is_deleted),
      ownerName,
      ownerEmail,
      ownerUserId,
      creatorName,
    };
  }

  private async upsertNotificationRow(params: {
    id: string | null;
    actionItemId: string;
    notificationType: 'ACTION_ITEM_CREATED' | 'ACTION_ITEM_DUE' | 'CREATED' | 'DUE';
    channel: 'EMAIL' | 'IN_APP';
    dueDate: string;
    recipientEmail: string;
    recipientUserId: string | null;
    recipientName: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    errorDetails: string | null;
    attemptCount: number;
  }): Promise<void> {
    if (params.id) {
      await this.db.query(
        `UPDATE action_item_notifications
         SET recipient_email = $1,
             recipient_user_id = $2,
             recipient_name = $3,
             status = $4,
             attempt_count = $5,
             last_attempt_at = NOW(),
             error_details = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          params.recipientEmail,
          params.recipientUserId,
          params.recipientName,
          params.status,
          params.attemptCount,
          params.errorDetails,
          params.id,
        ],
      );
    } else if (params.notificationType === 'ACTION_ITEM_CREATED' || params.notificationType === 'CREATED') {
      await this.db.query(
        `INSERT INTO action_item_notifications
           (id, action_item_id, notification_type, channel, due_date, recipient_email, recipient_user_id, recipient_name, status, attempt_count, last_attempt_at, error_details)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
         ON CONFLICT (action_item_id, channel) WHERE notification_type IN ('ACTION_ITEM_CREATED', 'CREATED')
         DO UPDATE SET
           recipient_email = EXCLUDED.recipient_email,
           recipient_user_id = EXCLUDED.recipient_user_id,
           recipient_name = EXCLUDED.recipient_name,
           status = EXCLUDED.status,
           attempt_count = action_item_notifications.attempt_count + 1,
           last_attempt_at = NOW(),
           error_details = EXCLUDED.error_details,
           updated_at = NOW()`,
        [
          params.actionItemId,
          params.notificationType,
          params.channel,
          params.dueDate,
          params.recipientEmail,
          params.recipientUserId,
          params.recipientName,
          params.status,
          params.attemptCount,
          params.errorDetails,
        ],
      );
    } else {
      await this.db.query(
        `INSERT INTO action_item_notifications
           (id, action_item_id, notification_type, channel, due_date, recipient_email, recipient_user_id, recipient_name, status, attempt_count, last_attempt_at, error_details)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
         ON CONFLICT (action_item_id, channel, due_date) WHERE notification_type IN ('ACTION_ITEM_DUE', 'DUE')
         DO UPDATE SET
           recipient_email = EXCLUDED.recipient_email,
           recipient_user_id = EXCLUDED.recipient_user_id,
           recipient_name = EXCLUDED.recipient_name,
           status = EXCLUDED.status,
           attempt_count = action_item_notifications.attempt_count + 1,
           last_attempt_at = NOW(),
           error_details = EXCLUDED.error_details,
           updated_at = NOW()`,
        [
          params.actionItemId,
          params.notificationType,
          params.channel,
          params.dueDate,
          params.recipientEmail,
          params.recipientUserId,
          params.recipientName,
          params.status,
          params.attemptCount,
          params.errorDetails,
        ],
      );
    }
  }
}
