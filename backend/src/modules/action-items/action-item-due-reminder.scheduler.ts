import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ActionItemNotificationsService } from './action-item-notifications.service';
import { getNotificationCutoffDate, isDateOnOrAfterCutoff } from './action-item-cutoff.util';

/**
 * Returns current date string 'YYYY-MM-DD' formatted according to the configured timezone.
 * Falls back safely to UTC if the timezone string is invalid.
 */
export function getCurrentDateString(timeZone: string = process.env.APP_TIMEZONE || process.env.TZ || 'UTC'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Returns current hour (0-23) formatted according to configured timezone.
 * Falls back safely to UTC hour if the timezone string is invalid.
 */
export function getCurrentHourInTimezone(timeZone: string = process.env.APP_TIMEZONE || process.env.TZ || 'UTC'): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    });
    const hourStr = formatter.format(new Date());
    return parseInt(hourStr, 10);
  } catch {
    return new Date().getUTCHours();
  }
}

export interface DueReminderProcessingResult {
  targetDate: string;
  totalCandidateItems: number;
  sentInAppCount: number;
  sentEmailCount: number;
  skippedCount: number;
  failedCount: number;
  sentCount: number;
}

@Injectable()
export class ActionItemDueReminderScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ActionItemDueReminderScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private readonly intervalMs: number;
  private readonly isEnabled: boolean;
  private readonly maxAttempts: number;
  private readonly scheduledHour: number;

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: ActionItemNotificationsService,
  ) {
    this.intervalMs = parseInt(process.env.ACTION_ITEM_DUE_REMINDER_INTERVAL_MS || '3600000', 10);
    this.isEnabled = process.env.ACTION_ITEM_DUE_REMINDER_ENABLED !== 'false';
    this.maxAttempts = parseInt(process.env.ACTION_ITEM_DUE_REMINDER_MAX_ATTEMPTS || '3', 10);
    this.scheduledHour = parseInt(process.env.ACTION_ITEM_DUE_REMINDER_HOUR || '9', 10);
  }

  onApplicationBootstrap(): void {
    if (!this.isEnabled) {
      this.logger.log('ActionItemDueReminderScheduler is disabled by configuration (ACTION_ITEM_DUE_REMINDER_ENABLED=false)');
      return;
    }

    this.logger.log(
      `Starting ActionItemDueReminderScheduler [intervalMs=${this.intervalMs} scheduledHour=${this.scheduledHour}:00]`,
    );

    // Run first check after a short initial startup delay (default 5 seconds, configurable in tests)
    const initialDelay = parseInt(process.env.ACTION_ITEM_DUE_REMINDER_INITIAL_DELAY_MS || '5000', 10);
    if (initialDelay >= 0) {
      setTimeout(() => {
        void this.triggerDueCheck().catch((err) => {
          this.logger.error(`Initial due-date reminder run failed: ${err.message}`, err.stack);
        });
      }, initialDelay);
    }

    // Schedule regular recurring job
    this.timer = setInterval(() => {
      void this.triggerDueCheck().catch((err) => {
        this.logger.error(`Scheduled due-date reminder run failed: ${err.message}`, err.stack);
      });
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('ActionItemDueReminderScheduler stopped');
    }
  }

  /**
   * Triggers the due-date check and reminder dispatch.
   *
   * @param targetDate Optional explicit ISO date 'YYYY-MM-DD' (defaults to current date in configured timezone).
   * @param force If true, bypasses the 9:00 AM time check (used for tests or manual triggers).
   */
  async triggerDueCheck(targetDate?: string, force = false): Promise<DueReminderProcessingResult> {
    const timeZone = process.env.APP_TIMEZONE || process.env.TZ || 'UTC';
    const effectiveDate = targetDate || getCurrentDateString(timeZone);
    const enforceHour = process.env.ACTION_ITEM_DUE_REMINDER_ENFORCE_HOUR !== 'false';
    const cutoffDate = getNotificationCutoffDate();

    // Fast bailout: If explicit targetDate is before the notification cutoff date, skip check
    if (targetDate && !isDateOnOrAfterCutoff(targetDate, cutoffDate)) {
      this.logger.log(
        `Target date "${targetDate}" is before notification cutoff date "${cutoffDate}" — skipping check`,
      );
      return {
        targetDate: effectiveDate,
        totalCandidateItems: 0,
        sentInAppCount: 0,
        sentEmailCount: 0,
        skippedCount: 0,
        failedCount: 0,
        sentCount: 0,
      };
    }

    // Fast bailout: If automatic execution and effective date is before cutoff date, skip check
    if (!targetDate && !isDateOnOrAfterCutoff(effectiveDate, cutoffDate)) {
      this.logger.log(
        `Effective date "${effectiveDate}" is before notification cutoff date "${cutoffDate}" — skipping check`,
      );
      return {
        targetDate: effectiveDate,
        totalCandidateItems: 0,
        sentInAppCount: 0,
        sentEmailCount: 0,
        skippedCount: 0,
        failedCount: 0,
        sentCount: 0,
      };
    }

    // If running automatically (no explicit targetDate and not forced) and enforceHour is true,
    // verify that the current hour in configured timezone has reached the scheduled hour (e.g. 9:00 AM)
    if (!targetDate && !force && enforceHour) {
      const currentHour = getCurrentHourInTimezone(timeZone);
      if (currentHour < this.scheduledHour) {
        this.logger.log(
          `Current time in ${timeZone} (${currentHour}:00) is before scheduled reminder hour (${this.scheduledHour}:00) — skipping check`,
        );
        return {
          targetDate: effectiveDate,
          totalCandidateItems: 0,
          sentInAppCount: 0,
          sentEmailCount: 0,
          skippedCount: 0,
          failedCount: 0,
          sentCount: 0,
        };
      }
    }

    // Prevent overlapping job executions
    if (this.isRunning) {
      this.logger.warn(`Due-date reminder job already running — skipping overlapping execution [targetDate=${effectiveDate}]`);
      return {
        targetDate: effectiveDate,
        totalCandidateItems: 0,
        sentInAppCount: 0,
        sentEmailCount: 0,
        skippedCount: 0,
        failedCount: 0,
        sentCount: 0,
      };
    }

    this.isRunning = true;
    let sentInAppCount = 0;
    let sentEmailCount = 0;
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      this.logger.log(`Executing due-date reminder check [targetDate=${effectiveDate} timeZone=${timeZone}]`);

      // 1. Find active action items whose due date has arrived or expired on or after cutoff,
      // excluding completed, cancelled, and deleted items, and ensuring an owner is assigned
      const candidateQuery = targetDate
        ? `SELECT ai.id, ai.title, ai.due_date, ai.status
           FROM action_items ai
           WHERE ai.is_deleted = FALSE
             AND ai.status NOT IN ('Completed', 'Cancelled')
             AND ai.due_date = $1
             AND ai.due_date >= $2
             AND (ai.owner_id IS NOT NULL OR ai.owner_stakeholder_id IS NOT NULL)`
        : `SELECT ai.id, ai.title, ai.due_date, ai.status
           FROM action_items ai
           WHERE ai.is_deleted = FALSE
             AND ai.status NOT IN ('Completed', 'Cancelled')
             AND ai.due_date IS NOT NULL
             AND ai.due_date != ''
             AND ai.due_date >= $1
             AND ai.due_date <= $2
             AND (ai.owner_id IS NOT NULL OR ai.owner_stakeholder_id IS NOT NULL)`;

      const queryParams = targetDate ? [effectiveDate, cutoffDate] : [cutoffDate, effectiveDate];
      const queryResult = await this.db.query(candidateQuery, queryParams);
      const candidateItems = queryResult?.rows || [];

      this.logger.log(`Found ${candidateItems.length} candidate action item(s) due on or before ${effectiveDate}`);

      // 2. Process each candidate
      for (const item of candidateItems) {
        try {
          const itemDueDate = item.due_date || effectiveDate;

          // Check existing notification state across both channels
          const { rows: notifRows } = await this.db.query(
            `SELECT channel, status, attempt_count
             FROM action_item_notifications
             WHERE action_item_id = $1
               AND notification_type IN ('ACTION_ITEM_DUE', 'DUE')
               AND due_date = $2`,
            [item.id, itemDueDate],
          );

          const inAppRow = notifRows.find((r: any) => r.channel === 'IN_APP');
          const emailRow = notifRows.find((r: any) => r.channel === 'EMAIL');

          const inAppDone = inAppRow && inAppRow.status === 'SENT';
          const emailDone =
            emailRow &&
            (emailRow.status === 'SENT' ||
              (emailRow.status === 'FAILED' && emailRow.attempt_count >= this.maxAttempts));

          // If both channels have already finished (sent or exhausted retries), skip this item
          if (inAppDone && emailDone) {
            skippedCount++;
            continue;
          }

          // Dispatch reminder via notification service (independent dual-channel execution)
          const result = await this.notifications.sendDueReminder(
            item.id,
            itemDueDate,
          );

          if (result.inApp) {
            sentInAppCount++;
          }
          if (result.email) {
            sentEmailCount++;
          }

          if (result.inApp || result.email) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (itemErr: any) {
          failedCount++;
          this.logger.error(
            `Error processing due reminder for action item [id=${item.id}]: ${itemErr.message}`,
            itemErr.stack,
          );
        }
      }

      this.logger.log(
        `Due-date check completed [targetDate=${effectiveDate} total=${candidateItems.length} inApp=${sentInAppCount} email=${sentEmailCount} failed=${failedCount} skipped=${skippedCount}]`,
      );

      return {
        targetDate: effectiveDate,
        totalCandidateItems: candidateItems.length,
        sentInAppCount,
        sentEmailCount,
        skippedCount,
        failedCount,
        sentCount,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
