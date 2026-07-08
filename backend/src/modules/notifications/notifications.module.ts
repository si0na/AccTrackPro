import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';

/**
 * @Global — makes NotificationEventBus and NotificationsService injectable
 * in every module without needing to import NotificationsModule explicitly.
 *
 * WebSocket gateway upgrade path:
 *   When disk space allows, install @nestjs/websockets + socket.io, then:
 *   1. Create notifications.gateway.ts (NotificationsGateway)
 *   2. Add it to providers and exports here
 *   3. Inject it into NotificationsService.create() to push real-time events
 *   4. Remove the 30-second polling in AlertsAndNotificationsView.tsx
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationEventBus,
  ],
  exports: [
    NotificationsService,
    NotificationEventBus,
  ],
})
export class NotificationsModule {}
