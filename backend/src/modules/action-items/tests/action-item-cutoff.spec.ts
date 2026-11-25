import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { ActionItemNotificationsService } from '../action-item-notifications.service';
import { ActionItemDueReminderScheduler } from '../action-item-due-reminder.scheduler';
import {
  DEFAULT_NOTIFICATION_CUTOFF_DATE,
  getNotificationCutoffDate,
  formatDateInTimezone,
  isDateOnOrAfterCutoff,
} from '../action-item-cutoff.util';
import { validateEnvironment } from '../../../config/env.validation';
import { DatabaseService } from '../../../database/database.service';
import { GraphMailService } from '../../auth/graph-mail.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('Production Notification Cutoff (24 November 2026) Safeguards', () => {
  let notificationsService: ActionItemNotificationsService;
  let scheduler: ActionItemDueReminderScheduler;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockMail: jest.Mocked<GraphMailService>;
  let mockNotifications: jest.Mocked<NotificationsService>;

  const originalEnvCutoff = process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE;
  const originalTz = process.env.APP_TIMEZONE;

  beforeEach(() => {
    // Default to the production cutoff date for all tests in this suite
    process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE = '2026-11-24';
    process.env.APP_TIMEZONE = 'UTC';

    mockDb = {
      query: jest.fn(),
      withTransaction: jest.fn(),
      pool: {} as any,
    } as unknown as jest.Mocked<DatabaseService>;

    mockMail = {
      sendMail: jest.fn(),
    } as unknown as jest.Mocked<GraphMailService>;

    mockNotifications = {
      create: jest.fn(),
      findForUser: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    notificationsService = new ActionItemNotificationsService(
      mockDb,
      mockMail,
      mockNotifications,
    );
    scheduler = new ActionItemDueReminderScheduler(mockDb, notificationsService);
  });

  afterEach(() => {
    if (originalEnvCutoff !== undefined) {
      process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE = originalEnvCutoff;
    } else {
      delete process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE;
    }
    if (originalTz !== undefined) {
      process.env.APP_TIMEZONE = originalTz;
    } else {
      delete process.env.APP_TIMEZONE;
    }
  });

  describe('Configuration & Startup Environment Validation', () => {
    it('defaults cutoff to 2026-11-24 when unset', () => {
      delete process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE;
      expect(getNotificationCutoffDate()).toBe(DEFAULT_NOTIFICATION_CUTOFF_DATE);
      expect(DEFAULT_NOTIFICATION_CUTOFF_DATE).toBe('2026-11-24');

      const valResult = validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/crm',
        JWT_SECRET: 'a'.repeat(32),
        FRONTEND_URL: 'https://crm.example.com',
        UPLOAD_DIR: 'C:\\var\\uploads',
      });
      expect(valResult.errors).toHaveLength(0);
      expect(valResult.summary).toContain('ACTION_ITEM_NOTIFICATION_CUTOFF_DATE=(default) 2026-11-24');
    });

    it('accepts valid custom YYYY-MM-DD date from environment', () => {
      process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE = '2026-12-01';
      expect(getNotificationCutoffDate()).toBe('2026-12-01');

      const valResult = validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/crm',
        JWT_SECRET: 'a'.repeat(32),
        FRONTEND_URL: 'https://crm.example.com',
        UPLOAD_DIR: 'C:\\var\\uploads',
        ACTION_ITEM_NOTIFICATION_CUTOFF_DATE: '2026-12-01',
      });
      expect(valResult.errors).toHaveLength(0);
      expect(valResult.summary).toContain('ACTION_ITEM_NOTIFICATION_CUTOFF_DATE=2026-12-01');
    });

    it('rejects invalid cutoff date format at startup fast-fail validation', () => {
      const valResult = validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/crm',
        JWT_SECRET: 'a'.repeat(32),
        FRONTEND_URL: 'https://crm.example.com',
        UPLOAD_DIR: 'C:\\var\\uploads',
        ACTION_ITEM_NOTIFICATION_CUTOFF_DATE: 'invalid-date',
      });
      expect(valResult.errors).toContain(
        'ACTION_ITEM_NOTIFICATION_CUTOFF_DATE must be a valid YYYY-MM-DD date, got "invalid-date"',
      );
    });

    it('formats timestamps accurately according to application timezone', () => {
      // 2026-11-23 23:30:00 UTC is 2026-11-24 in Asia/Kolkata (+05:30)
      const lateUtc = new Date('2026-11-23T23:30:00.000Z');
      expect(formatDateInTimezone(lateUtc, 'UTC')).toBe('2026-11-23');
      expect(formatDateInTimezone(lateUtc, 'Asia/Kolkata')).toBe('2026-11-24');
    });
  });

  describe('Cutoff Requirement Test Cases 1 through 10', () => {
    // ── Test 1: Action Item created on 23 Nov 2026 -> no creation email ──────
    it('Test 1: Action Item created on 23 Nov 2026 -> no creation email sent and records untouched', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-created-23',
                title: 'Historical Task Created on 23 Nov',
                priority: 'High',
                status: 'To Do',
                due_date: '2026-11-30',
                created_at: new Date('2026-11-23T14:00:00Z'),
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Alice',
                stakeholder_email: 'alice@example.com',
                stakeholder_user_id: 'u-alice',
              },
            ],
          } as any;
        }
        if (sql.includes('SELECT id, status FROM action_item_notifications')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-1');

      const result = await notificationsService.sendCreationNotification('ai-created-23', 'creator-1');

      // Email MUST be suppressed because created_at is before 2026-11-24
      expect(result.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // No dummy EMAIL notification row should be inserted into action_item_notifications
      const emailInsertCalls = mockDb.query.mock.calls.filter(
        ([sql, params]) =>
          typeof sql === 'string' &&
          sql.includes('INSERT INTO action_item_notifications') &&
          Array.isArray(params) &&
          params.includes('EMAIL'),
      );
      expect(emailInsertCalls).toHaveLength(0);
    });

    // ── Test 2: Action Item created on 24 Nov 2026 -> creation email sent ────
    it('Test 2: Action Item created on 24 Nov 2026 -> creation email sent successfully', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-created-24',
                title: 'New Production Action Item',
                priority: 'High',
                status: 'To Do',
                due_date: '2026-11-28',
                created_at: new Date('2026-11-24T09:30:00Z'),
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Bob Owner',
                stakeholder_email: 'bob@example.com',
                stakeholder_user_id: 'u-bob',
              },
            ],
          } as any;
        }
        if (sql.includes('SELECT id, status, attempt_count FROM action_item_notifications')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-2');
      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await notificationsService.sendCreationNotification('ai-created-24', 'creator-1');

      // Creation email is delivered immediately
      expect(result.email).toBe(true);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = mockMail.sendMail.mock.calls[0];
      expect(to).toBe('bob@example.com');
      expect(subject).toBe('New Action Item Assigned: New Production Action Item');
      expect(html).toContain('New Production Action Item');
    });

    // ── Test 3: Existing Action Item with due date 23 Nov 2026 -> no due-date email
    it('Test 3: Existing Action Item with due date 23 Nov 2026 -> no due-date email sent', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-due-23',
                title: 'Historical Due Date Task',
                priority: 'Medium',
                status: 'To Do',
                due_date: '2026-11-23',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Charlie',
                stakeholder_email: 'charlie@example.com',
                stakeholder_user_id: 'u-charlie',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      // Direct due reminder invocation for due date 2026-11-23
      const directResult = await notificationsService.sendDueReminder('ai-due-23', '2026-11-23');
      expect(directResult.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // Scheduler invocation targeting 2026-11-23
      const schedulerResult = await scheduler.triggerDueCheck('2026-11-23', true);
      expect(schedulerResult.totalCandidateItems).toBe(0);
      expect(schedulerResult.sentEmailCount).toBe(0);
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    // ── Test 4: Existing Action Item with due date 24 Nov 2026 -> eligible for due-date email
    it('Test 4: Existing Action Item with due date 24 Nov 2026 -> eligible for due-date email on that date', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-due-24',
                title: 'Task Due On Cutoff Date',
                priority: 'High',
                status: 'In Progress',
                due_date: '2026-11-24',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'David',
                stakeholder_email: 'david@example.com',
                stakeholder_user_id: 'u-david',
              },
            ],
          } as any;
        }
        if (sql.includes('SELECT channel, status, attempt_count FROM action_item_notifications') ||
            sql.includes('SELECT id, status, attempt_count FROM action_item_notifications')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-due-24');
      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await scheduler.triggerDueCheck('2026-11-24', true);

      expect(result.totalCandidateItems).toBe(1);
      expect(result.sentEmailCount).toBe(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      const [to, subject] = mockMail.sendMail.mock.calls[0];
      expect(to).toBe('david@example.com');
      expect(subject).toBe('Action Item Due Today: Task Due On Cutoff Date');
    });

    // ── Test 5: New Action Item created on 24 Nov with future due date ────────
    it('Test 5: New Action Item created on 24 Nov with future due date -> creation email immediately, due-date email on due date', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-future-due',
                title: 'Task Created on Cutoff with Future Due Date',
                priority: 'High',
                status: 'To Do',
                due_date: '2026-11-28',
                created_at: new Date('2026-11-24T11:00:00Z'),
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Emma',
                stakeholder_email: 'emma@example.com',
                stakeholder_user_id: 'u-emma',
              },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValue('in-app-future');
      mockMail.sendMail.mockResolvedValue(true);

      // Part A: Creation notification dispatched immediately
      const creationResult = await notificationsService.sendCreationNotification('ai-future-due');
      expect(creationResult.email).toBe(true);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail.mock.calls[0][1]).toContain('New Action Item Assigned: Task Created on Cutoff with Future Due Date');

      // Part B: Scheduler run on 2026-11-24 should NOT send due-date reminder because due_date is 2026-11-28
      mockMail.sendMail.mockClear();
      const earlyDueResult = await notificationsService.sendDueReminder('ai-future-due', '2026-11-24');
      expect(earlyDueResult.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // Part C: Scheduler run on 2026-11-28 dispatches due reminder
      const scheduledDueResult = await scheduler.triggerDueCheck('2026-11-28', true);
      expect(scheduledDueResult.sentEmailCount).toBe(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail.mock.calls[0][1]).toBe('Action Item Due Today: Task Created on Cutoff with Future Due Date');
    });

    // ── Test 6: Application restarted / scheduler startup check -> no historical burst
    it('Test 6: Application restarted / scheduler startup check -> candidate query filters out historical overdue items', async () => {
      // Part A: If startup occurs prior to cutoff date, scheduler safely bails out with 0 candidates
      const earlyStartupResult = await scheduler.triggerDueCheck(undefined, true);
      expect(earlyStartupResult.totalCandidateItems).toBe(0);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // Part B: When scheduler runs on or after cutoff, candidate query enforces cutoff lower bound
      process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE = '2026-11-20';
      let executedCandidateSql = '';
      let executedCandidateParams: any[] = [];

      mockDb.query.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM action_items ai') && sql.includes('ai.due_date <=')) {
          executedCandidateSql = sql;
          executedCandidateParams = params || [];
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      await scheduler.triggerDueCheck(undefined, true);

      // Candidate SQL MUST enforce ai.due_date >= $1 AND ai.due_date <= $2
      expect(executedCandidateSql).toContain('ai.due_date >= $1');
      expect(executedCandidateSql).toContain('ai.due_date <= $2');

      // The lower bound parameter $1 MUST be the notification cutoff date '2026-11-20'
      expect(executedCandidateParams[0]).toBe('2026-11-20');
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    // ── Test 7: Scheduler executed multiple times -> no duplicate emails ──────
    it('Test 7: Scheduler executed multiple times -> no duplicate emails sent', async () => {
      let emailSentInDb = false;
      let inAppSentInDb = false;

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-repeat-check',
                title: 'No Duplicates Allowed',
                due_date: '2026-11-24',
                status: 'To Do',
                owner_id: 'u-1',
                stakeholder_name: 'Frank',
                stakeholder_email: 'frank@example.com',
                stakeholder_user_id: 'u-1',
                is_deleted: false,
              },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications')) {
          const rows: any[] = [];
          if (sql.includes("channel = 'EMAIL'")) {
            if (emailSentInDb) rows.push({ id: 'notif-email-1', channel: 'EMAIL', status: 'SENT', attempt_count: 1 });
          } else if (sql.includes("channel = 'IN_APP'")) {
            if (inAppSentInDb) rows.push({ id: 'notif-inapp-1', channel: 'IN_APP', status: 'SENT', attempt_count: 1 });
          } else {
            // General query by scheduler checking both channels
            if (inAppSentInDb) rows.push({ id: 'notif-inapp-1', channel: 'IN_APP', status: 'SENT', attempt_count: 1 });
            if (emailSentInDb) rows.push({ id: 'notif-email-1', channel: 'EMAIL', status: 'SENT', attempt_count: 1 });
          }
          return { rows } as any;
        }
        if (sql.includes('UPDATE action_item_notifications') && sql.includes("status = 'SENT'")) {
          if (sql.includes("channel = 'EMAIL'")) emailSentInDb = true;
          if (sql.includes("channel = 'IN_APP'")) inAppSentInDb = true;
          return { rowCount: 1 } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValue('notif-repeat-1');
      mockMail.sendMail.mockResolvedValue(true);

      // First execution: sends notification
      const run1 = await scheduler.triggerDueCheck('2026-11-24', true);
      expect(run1.sentEmailCount).toBe(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);

      // Second execution: skips already-sent notification
      mockMail.sendMail.mockClear();
      const run2 = await scheduler.triggerDueCheck('2026-11-24', true);
      expect(run2.sentEmailCount).toBe(0);
      expect(run2.skippedCount).toBe(1);
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    // ── Test 8: Completed or cancelled Action Item -> no due-date email ────────
    it('Test 8: Completed or cancelled Action Item -> no due-date email sent', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-completed',
                title: 'Completed Task',
                status: 'Completed',
                due_date: '2026-11-24',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Grace',
                stakeholder_email: 'grace@example.com',
                stakeholder_user_id: 'u-grace',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const resultCompleted = await notificationsService.sendDueReminder('ai-completed', '2026-11-24');
      expect(resultCompleted.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // Test cancelled
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-cancelled',
                title: 'Cancelled Task',
                status: 'Cancelled',
                due_date: '2026-11-24',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Grace',
                stakeholder_email: 'grace@example.com',
                stakeholder_user_id: 'u-grace',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const resultCancelled = await notificationsService.sendDueReminder('ai-cancelled', '2026-11-24');
      expect(resultCancelled.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    // ── Test 9: Due date changed from before cutoff to after cutoff -> eligible
    it('Test 9: Due date changed from before cutoff (23 Nov) to after cutoff (25 Nov) -> becomes eligible', async () => {
      // Step A: When due date was 2026-11-23, reminder is suppressed
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-resched-forward',
                title: 'Rescheduled Forward Task',
                due_date: '2026-11-23',
                status: 'To Do',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Hank',
                stakeholder_email: 'hank@example.com',
                stakeholder_user_id: 'u-hank',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const beforeResult = await notificationsService.sendDueReminder('ai-resched-forward', '2026-11-23');
      expect(beforeResult.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // Step B: Due date updated to 2026-11-25
      await notificationsService.handleDueDateChanged('ai-resched-forward', '2026-11-23', '2026-11-25');

      // Step C: On 2026-11-25, the item is eligible and email is delivered
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-resched-forward',
                title: 'Rescheduled Forward Task',
                due_date: '2026-11-25',
                status: 'To Do',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Hank',
                stakeholder_email: 'hank@example.com',
                stakeholder_user_id: 'u-hank',
              },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-25');
      mockMail.sendMail.mockResolvedValueOnce(true);

      const afterResult = await scheduler.triggerDueCheck('2026-11-25', true);
      expect(afterResult.sentEmailCount).toBe(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail.mock.calls[0][1]).toBe('Action Item Due Today: Rescheduled Forward Task');
    });

    // ── Test 10: Due date changed from after cutoff to before cutoff -> suppressed
    it('Test 10: Due date changed from after cutoff (25 Nov) to before cutoff (23 Nov) -> becomes suppressed', async () => {
      // Step A: Due date changed from 2026-11-25 to 2026-11-23
      await notificationsService.handleDueDateChanged('ai-resched-back', '2026-11-25', '2026-11-23');

      // Verify un-sent notifications for 2026-11-25 were deleted
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM action_item_notifications"),
        ['ai-resched-back', '2026-11-25'],
      );

      // Step B: Direct due reminder for the updated due date 2026-11-23 must be suppressed
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-resched-back',
                title: 'Rescheduled Backward Task',
                due_date: '2026-11-23',
                status: 'To Do',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme Corp',
                stakeholder_name: 'Ivy',
                stakeholder_email: 'ivy@example.com',
                stakeholder_user_id: 'u-ivy',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const result = await notificationsService.sendDueReminder('ai-resched-back', '2026-11-23');
      expect(result.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });
  });
});
