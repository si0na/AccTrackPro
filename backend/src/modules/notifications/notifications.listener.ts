import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { NotificationEvent } from '../../common/events/notification.events';
import { NotificationsService } from './notifications.service';

/**
 * Subscribes to the NotificationEventBus and persists each event as a
 * notifications row.  Business modules never touch NotificationsService
 * directly — they emit events here.
 *
 * Responsibilities:
 *  1. Validate that the event carries a non-empty userId.
 *  2. Convert the event to a CreateNotificationDto.
 *  3. Call NotificationsService.create() and log any failure.
 */
@Injectable()
export class NotificationsListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationsListener.name);
  private subscription!: Subscription;

  constructor(
    private readonly bus: NotificationEventBus,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.bus.events$.subscribe({
      next:  (event) => void this.handle(event),
      error: (err)   => this.logger.error('Event bus error', err),
    });
  }

  private async handle(event: NotificationEvent): Promise<void> {
    this.logger.log(
      `Listener received event [type=${event.type} eventType=${event.eventType} userId=${event.userId ?? 'MISSING'}]`,
    );

    if (!event.userId) {
      this.logger.warn(
        `Notification dropped — missing userId [type=${event.type} eventType=${event.eventType}]`,
      );
      return;
    }

    try {
      await this.notifications.create({
        userId:               event.userId,
        type:                 event.type,
        eventType:            event.eventType,
        title:                event.title,
        message:              event.message,
        severity:             event.severity,
        notificationCategory: event.notificationCategory,
        accountId:            event.accountId,
        opportunityId:        event.opportunityId,
        actionItemId:         event.actionItemId,
        stakeholderId:        event.stakeholderId,
        documentId:           event.documentId,
        metadata:             event.metadata,
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist notification [type=${event.type} eventType=${event.eventType} userId=${event.userId}]`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
