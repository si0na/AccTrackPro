import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { NotificationEvent } from './notification.events';

/**
 * In-process notification event bus backed by an RxJS Subject.
 *
 * Provided globally via NotificationsModule (@Global).  Business modules
 * inject this service and call emit(); the NotificationsListener subscribes
 * and persists each event as a DB row.
 *
 * Upgrade path:
 *   Replace with @nestjs/event-emitter or a message broker (Redis, RabbitMQ)
 *   by swapping this class only — emitting modules and the listener remain
 *   unchanged because they depend on NotificationEvent (a plain interface).
 */
@Injectable()
export class NotificationEventBus implements OnModuleDestroy {
  private readonly logger   = new Logger(NotificationEventBus.name);
  private readonly _subject = new Subject<NotificationEvent>();

  /** Observable stream that the listener subscribes to. */
  readonly events$: Observable<NotificationEvent> = this._subject.asObservable();

  /** Emit one notification event. Never throws — malformed events are logged by the listener. */
  emit(event: NotificationEvent): void {
    this.logger.log(
      `Bus emit [type=${event.type} eventType=${event.eventType} userId=${event.userId ?? 'MISSING'} accountId=${event.accountId ?? '-'}]`,
    );
    this._subject.next(event);
  }

  onModuleDestroy(): void {
    this._subject.complete();
  }
}
