/**
 * Notification event system — typed event classes emitted by business modules.
 *
 * Design:
 *   • Business modules depend only on NotificationEventBus (this file + the bus service).
 *   • NotificationsModule listens to the bus and converts events to DB rows.
 *   • Replacing the bus (e.g. with @nestjs/event-emitter or a message broker) only
 *     touches the bus service and listener — zero changes to emitting modules.
 */

// ─── Shared types (mirrors notifications.service.ts — kept separate to avoid
//     circular imports between common/events and modules/notifications) ─────────

export type NotificationCategory = 'BUSINESS' | 'SYSTEM';

export type NotificationType =
  | 'Account' | 'Opportunity' | 'ActionItem' | 'Stakeholder'
  | 'Document' | 'Comment' | 'System';

export type NotificationEventType =
  | 'Created'   | 'Updated'     | 'Deleted'      | 'Deactivated' | 'Restored'
  | 'Assigned'  | 'StageChanged'| 'Uploaded'      | 'CommentAdded'
  | 'StatusChanged' | 'Completed'
  | 'Registered' | 'LoggedIn' | 'PasswordChanged' | 'PasswordReset'
  | 'ProfileUpdated' | 'FYCreated';

export type NotificationSeverity = 'Info' | 'Success' | 'Warning' | 'Error';

/** Full payload a listener needs to persist a notification. */
export interface NotificationEvent {
  userId:               string;                // Authenticated user UUID (FK → users.id)
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
