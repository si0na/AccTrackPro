import { Module } from '@nestjs/common';
import { ActionItemsController } from './action-items.controller';
import { ActionItemsService } from './action-items.service';
import { ActionItemNotificationsService } from './action-item-notifications.service';
import { ActionItemDueReminderScheduler } from './action-item-due-reminder.scheduler';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ActionItemsController],
  providers: [
    ActionItemsService,
    ActionItemNotificationsService,
    ActionItemDueReminderScheduler,
  ],
  exports: [
    ActionItemsService,
    ActionItemNotificationsService,
    ActionItemDueReminderScheduler,
  ],
})
export class ActionItemsModule {}
