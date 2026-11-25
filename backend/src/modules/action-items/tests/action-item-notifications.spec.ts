import { describe, beforeEach, afterAll, it, expect, jest } from '@jest/globals';
import { ActionItemNotificationsService } from '../action-item-notifications.service';
import {
  ActionItemDueReminderScheduler,
  getCurrentDateString,
  getCurrentHourInTimezone,
} from '../action-item-due-reminder.scheduler';
import {
  renderActionItemCreatedEmail,
  renderActionItemDueReminderEmail,
  resolveActionItemWebUrl,
} from '../action-item-email.template';
import { DatabaseService } from '../../../database/database.service';
import { GraphMailService } from '../../auth/graph-mail.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('Action Item Dual-Channel Notifications & Due-Date Reminders', () => {
  let notificationsService: ActionItemNotificationsService;
  let scheduler: ActionItemDueReminderScheduler;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockMail: jest.Mocked<GraphMailService>;
  let mockNotifications: jest.Mocked<NotificationsService>;
  const originalEnvCutoff = process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE;

  afterAll(() => {
    if (originalEnvCutoff !== undefined) {
      process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE = originalEnvCutoff;
    } else {
      delete process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE;
    }
  });

  beforeEach(() => {
    process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE = '2026-11-01';
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

  describe('1. Email Templates & URL Resolution', () => {
    it('resolves correct web URLs for normal and project action items', () => {
      const normalUrl = resolveActionItemWebUrl('ai-123', null, 'http://localhost:5173');
      expect(normalUrl).toBe('http://localhost:5173/action-items/ai-123');

      const projectUrl = resolveActionItemWebUrl('ai-456', 'proj-789', 'http://localhost:5173/');
      expect(projectUrl).toBe('http://localhost:5173/project-action-items/ai-456');
    });

    it('renders Action Item Created email with all required metadata fields', () => {
      const email = renderActionItemCreatedEmail({
        id: 'ai-101',
        actionItemNumber: 'AKU-0001',
        title: 'Review Security Architecture SLA',
        notes: 'Detailed notes on vendor compliance',
        accountName: 'Akumin Health',
        opportunityName: 'Akumin Cloud Migration',
        priority: 'High',
        status: 'To Do',
        dueDate: '2026-11-20',
        ownerName: 'Sarah Connor',
        creatorName: 'John Smith',
        createdAt: '2026-11-06T10:00:00Z',
        frontendUrl: 'https://crm.example.com',
      });

      expect(email.subject).toBe('New Action Item Assigned: Review Security Architecture SLA');
      expect(email.html).toContain('Hello Sarah Connor');
      expect(email.html).toContain('AKU-0001');
      expect(email.html).toContain('Review Security Architecture SLA');
      expect(email.html).toContain('Detailed notes on vendor compliance');
      expect(email.html).toContain('Akumin Health');
      expect(email.html).toContain('Akumin Cloud Migration');
      expect(email.html).toContain('High');
      expect(email.html).toContain('To Do');
      expect(email.html).toContain('2026-11-20');
      expect(email.html).toContain('John Smith');
      expect(email.html).toContain('https://crm.example.com/action-items/ai-101');
    });

    it('renders Action Item Due Reminder email with required fields', () => {
      const email = renderActionItemDueReminderEmail({
        id: 'ai-202',
        actionItemNumber: 'REF-0042',
        title: 'Finalize Q4 Revenue Model',
        notes: 'Verify forecast against closed deals',
        accountName: 'Reflections Global',
        priority: 'Medium',
        status: 'In Progress',
        dueDate: '2026-11-06',
        ownerName: 'James Holden',
        frontendUrl: 'https://crm.example.com',
      });

      expect(email.subject).toBe('Action Item Due Today: Finalize Q4 Revenue Model');
      expect(email.html).toContain('Hello James Holden');
      expect(email.html).toContain('REF-0042');
      expect(email.html).toContain('Finalize Q4 Revenue Model');
      expect(email.html).toContain('Reflections Global');
      expect(email.html).toContain('Due Today');
      expect(email.html).toContain('https://crm.example.com/action-items/ai-202');
    });
  });

  describe('2. Action Item Creation Dual-Channel Notification (Immediate Email + In-App)', () => {
    it('dispatches both in-app assignment notification and immediate Outlook email when action item is created and assigned', async () => {
      // Mock DB queries for action item info, user lookup, and notification records
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-1',
                action_item_number: 'TEST-0001',
                title: 'Prepare Kickoff Deck',
                notes: 'Deck requirements',
                priority: 'High',
                status: 'To Do',
                due_date: '2026-11-15',
                created_at: new Date().toISOString(),
                is_deleted: false,
                project_id: null,
                account_id: 'acc-1',
                account_name: 'Test Account',
                opportunity_id: 'opp-1',
                opportunity_name: 'Kickoff Opp',
                stakeholder_name: 'Jane Doe',
                stakeholder_email: 'jane.doe@example.com',
                stakeholder_user_id: 'user-jane-123',
                legacy_owner: null,
              },
            ],
          } as any;
        }
        if (sql.includes('FROM users WHERE id = $1')) {
          return { rows: [{ name: 'Creator User', email: 'creator@example.com' }] } as any;
        }
        if (sql.includes('SELECT id, status FROM action_item_notifications') || sql.includes('SELECT id, status, attempt_count FROM action_item_notifications')) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-notif-101');
      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await notificationsService.sendCreationNotification('ai-1', 'creator-uuid');

      // Both in-app and Outlook email should succeed immediately
      expect(result.inApp).toBe(true);
      expect(result.email).toBe(true);

      // Verify in-app notification creation
      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      const inAppPayload = mockNotifications.create.mock.calls[0][0];
      expect(inAppPayload.userId).toBe('user-jane-123');
      expect(inAppPayload.title).toBe('New Action Item Assigned');
      expect(inAppPayload.message).toBe('You have been assigned "Prepare Kickoff Deck".');
      expect(inAppPayload.actionItemId).toBe('ai-1');
      expect(inAppPayload.severity).toBe('Info');
      expect(inAppPayload.notificationCategory).toBe('BUSINESS');

      // Verify Outlook email was dispatched immediately with complete details
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = mockMail.sendMail.mock.calls[0];
      expect(to).toBe('jane.doe@example.com');
      expect(subject).toBe('New Action Item Assigned: Prepare Kickoff Deck');
      expect(html).toContain('Prepare Kickoff Deck');
      expect(html).toContain('Deck requirements');
      expect(html).toContain('Test Account');
      expect(html).toContain('Kickoff Opp');
      expect(html).toContain('2026-11-15');
      expect(html).toContain('High');
      expect(html).toContain('/action-items/ai-1');

      // Verify database recorded status for both channels under ACTION_ITEM_CREATED
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'IN_APP'"),
        ['ai-1', 'in-app-notif-101'],
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("notification_type IN ('ACTION_ITEM_CREATED', 'CREATED') AND channel = 'EMAIL'"),
        ['ai-1'],
      );
    });

    it('does not send creation email if action item has no assigned owner or no valid recipient email', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-no-email',
                title: 'Unassigned Task',
                priority: 'Low',
                status: 'To Do',
                due_date: '2026-11-20',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Test Account',
                stakeholder_name: '',
                stakeholder_email: '',
                stakeholder_user_id: null,
                user_email: '',
                user_name: '',
                legacy_owner: '',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const result = await notificationsService.sendCreationNotification('ai-no-email');

      expect(result.email).toBe(false);
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    it('isolates failures so email failure does not prevent in-app notification from succeeding', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-email-fail',
                title: 'Important Task',
                priority: 'High',
                status: 'To Do',
                due_date: '2026-11-20',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Test Account',
                stakeholder_name: 'Bob',
                stakeholder_email: 'bob@example.com',
                stakeholder_user_id: 'user-bob',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-bob-1');
      mockMail.sendMail.mockResolvedValueOnce(false); // Outlook delivery fails

      const result = await notificationsService.sendCreationNotification('ai-email-fail');

      expect(result.inApp).toBe(true);
      expect(result.email).toBe(false);
      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
    });

    it('isolates failures so in-app failure does not prevent email from being sent', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-inapp-fail',
                title: 'External Partner Task',
                priority: 'Medium',
                status: 'To Do',
                due_date: '2026-11-20',
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Test Account',
                stakeholder_name: 'Partner Rep',
                stakeholder_email: 'partner@example.com',
                stakeholder_user_id: null, // No in-app user account
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await notificationsService.sendCreationNotification('ai-inapp-fail');

      expect(result.inApp).toBe(false);
      expect(result.email).toBe(true);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
    });

    it('does not send duplicate creation notifications if already marked SENT', async () => {
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai')) {
          return {
            rows: [
              {
                id: 'ai-dup',
                title: 'Already Sent Item',
                priority: 'Low',
                status: 'To Do',
                due_date: '2026-11-20',
                is_deleted: false,
                account_name: 'Test Account',
                stakeholder_name: 'Alice',
                stakeholder_email: 'alice@example.com',
                stakeholder_user_id: 'user-dup',
              },
            ],
          } as any;
        }
        if (sql.includes('SELECT id, status FROM action_item_notifications') || sql.includes('SELECT id, status, attempt_count FROM action_item_notifications')) {
          return { rows: [{ id: 'notif-1', status: 'SENT' }] } as any;
        }
        return { rows: [] } as any;
      });

      const result = await notificationsService.sendCreationNotification('ai-dup');

      expect(result.inApp).toBe(true);
      expect(result.email).toBe(true);
      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('3. Due-Date Reminders & Scheduled Job', () => {
    it('dispatches both in-app and Outlook email reminders when action item reaches due date', async () => {
      const today = getCurrentDateString();

      mockDb.query.mockImplementation(async (sql: string) => {
        // Scheduler candidate query
        if (sql.includes('FROM action_items ai') && sql.includes('ai.due_date = $1')) {
          return {
            rows: [
              {
                id: 'ai-due-1',
                title: 'Due Today Task',
                due_date: today,
                status: 'To Do',
                owner_id: 'user-alex',
              },
            ],
          } as any;
        }
        // Scheduler check existing notif rows
        if (sql.includes('FROM action_item_notifications') && sql.includes('due_date = $2')) {
          return { rows: [] } as any;
        }
        // Notification service resolve action item
        if (sql.includes('WHERE ai.id = $1')) {
          return {
            rows: [
              {
                id: 'ai-due-1',
                title: 'Due Today Task',
                notes: 'Must be completed today',
                priority: 'High',
                status: 'To Do',
                due_date: today,
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Enterprise Co',
                stakeholder_name: 'Alex Mercer',
                stakeholder_email: 'alex@example.com',
                stakeholder_user_id: 'user-alex',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('in-app-due-notif-1');
      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await scheduler.triggerDueCheck(today);

      expect(result.totalCandidateItems).toBe(1);
      expect(result.sentInAppCount).toBe(1);
      expect(result.sentEmailCount).toBe(1);
      expect(result.sentCount).toBe(1);
      expect(result.skippedCount).toBe(0);

      // Verify in-app reminder
      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      const notifPayload = mockNotifications.create.mock.calls[0][0];
      expect(notifPayload.userId).toBe('user-alex');
      expect(notifPayload.title).toBe('Action Item Due Today');
      expect(notifPayload.message).toBe('"Due Today Task" is due today. Please review its status.');
      expect(notifPayload.severity).toBe('Warning');
      expect(notifPayload.actionItemId).toBe('ai-due-1');

      // Verify Outlook email reminder
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      const [to, subject, html] = mockMail.sendMail.mock.calls[0];
      expect(to).toBe('alex@example.com');
      expect(subject).toBe('Action Item Due Today: Due Today Task');
      expect(html).toContain('Due Today Task');
    });

    it('skips scheduled run if time is before 9:00 AM in configured timezone', async () => {
      const origTz = process.env.APP_TIMEZONE;
      const origEnforce = process.env.ACTION_ITEM_DUE_REMINDER_ENFORCE_HOUR;
      process.env.APP_TIMEZONE = 'UTC';
      process.env.ACTION_ITEM_DUE_REMINDER_ENFORCE_HOUR = 'true';

      // Set scheduledHour to 25 so any real hour (0-23) is strictly before it
      (scheduler as any).scheduledHour = 25;

      const result = await scheduler.triggerDueCheck(); // no targetDate, no force

      expect(result.totalCandidateItems).toBe(0);
      expect(result.sentCount).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();

      (scheduler as any).scheduledHour = 9;
      process.env.APP_TIMEZONE = origTz;
      process.env.ACTION_ITEM_DUE_REMINDER_ENFORCE_HOUR = origEnforce;
    });

    it('excludes completed, cancelled, and deleted action items from due reminders', async () => {
      const today = '2026-11-06';

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai') && sql.includes('ai.due_date = $1')) {
          // Excluded by SQL filter
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const result = await scheduler.triggerDueCheck(today);

      expect(result.totalCandidateItems).toBe(0);
      expect(result.sentCount).toBe(0);
      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    it('excludes action items without an assigned owner', async () => {
      const today = '2026-11-06';

      mockDb.query.mockImplementation(async (sql: string) => {
        // Query has: AND (ai.owner_id IS NOT NULL OR ai.owner_stakeholder_id IS NOT NULL)
        return { rows: [] } as any;
      });

      const result = await scheduler.triggerDueCheck(today);

      expect(result.totalCandidateItems).toBe(0);
      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    it('sends due reminder only once for a given action item and due date (repeated scheduler runs)', async () => {
      const today = getCurrentDateString();

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai') && (sql.includes('ai.due_date = $1') || sql.includes('ai.due_date <= $1'))) {
          return {
            rows: [
              { id: 'ai-due-1', title: 'Task', due_date: today, status: 'In Progress', owner_id: 'u-1' },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications') && sql.includes('due_date = $2')) {
          // Already SENT on both channels
          return {
            rows: [
              { channel: 'IN_APP', status: 'SENT', attempt_count: 1 },
              { channel: 'EMAIL', status: 'SENT', attempt_count: 1 },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      const result = await scheduler.triggerDueCheck(today);

      expect(result.totalCandidateItems).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.sentCount).toBe(0);
      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    it('retries failed email notifications up to max attempts while keeping in-app intact', async () => {
      const today = getCurrentDateString();

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai') && (sql.includes('ai.due_date = $1') || sql.includes('ai.due_date <= $1'))) {
          return {
            rows: [
              { id: 'ai-retry', title: 'Retry Task', due_date: today, status: 'To Do', owner_id: 'u-1' },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications') && sql.includes('due_date = $2')) {
          if (sql.includes("channel = 'IN_APP'")) {
            return { rows: [{ id: 'notif-inapp', channel: 'IN_APP', status: 'SENT', attempt_count: 1 }] } as any;
          }
          if (sql.includes("channel = 'EMAIL'")) {
            return { rows: [{ id: 'notif-email', channel: 'EMAIL', status: 'FAILED', attempt_count: 1 }] } as any;
          }
          // In-app is SENT, email is FAILED with attempt_count = 1
          return {
            rows: [
              { channel: 'IN_APP', status: 'SENT', attempt_count: 1 },
              { channel: 'EMAIL', status: 'FAILED', attempt_count: 1 },
            ],
          } as any;
        }
        if (sql.includes('WHERE ai.id = $1')) {
          return {
            rows: [
              {
                id: 'ai-retry',
                title: 'Retry Task',
                priority: 'Medium',
                status: 'To Do',
                due_date: today,
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme',
                stakeholder_name: 'Sam',
                stakeholder_email: 'sam@example.com',
                stakeholder_user_id: 'u-1',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      // Email succeeds on retry
      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await scheduler.triggerDueCheck(today);

      // In-app is skipped because already SENT, email is retried and succeeds
      expect(result.sentEmailCount).toBe(1);
      expect(result.sentInAppCount).toBe(1); // service returned true for inApp (already sent)
      expect(mockNotifications.create).not.toHaveBeenCalled(); // No duplicate in-app!
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1); // Email retried!
    });

    it('permits a new reminder if the due date is changed to an updated date', async () => {
      const newDueDate = getCurrentDateString();

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai') && sql.includes('ai.due_date = $1')) {
          return {
            rows: [
              { id: 'ai-rescheduled', title: 'Rescheduled Task', due_date: newDueDate, status: 'To Do', owner_id: 'u-sam' },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications') && sql.includes('due_date = $2')) {
          // No notifications for the new date
          return { rows: [] } as any;
        }
        if (sql.includes('WHERE ai.id = $1')) {
          return {
            rows: [
              {
                id: 'ai-rescheduled',
                title: 'Rescheduled Task',
                priority: 'Medium',
                status: 'To Do',
                due_date: newDueDate,
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme',
                stakeholder_name: 'Sam',
                stakeholder_email: 'sam@example.com',
                stakeholder_user_id: 'u-sam',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('notif-rescheduled-1');
      mockMail.sendMail.mockResolvedValueOnce(true);

      const result = await scheduler.triggerDueCheck(newDueDate);

      expect(result.sentCount).toBe(1);
      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail.mock.calls[0][1]).toBe('Action Item Due Today: Rescheduled Task');
    });

    it('prevents overlapping scheduler executions', async () => {
      const today = '2026-11-06';

      let resolveQuery: (val: any) => void;
      const queryPromise = new Promise((res) => {
        resolveQuery = res;
      });
      mockDb.query.mockImplementationOnce(() => queryPromise as any);

      const run1 = scheduler.triggerDueCheck(today);
      const run2 = await scheduler.triggerDueCheck(today);

      expect(run2.totalCandidateItems).toBe(0); // skipped due to overlap guard

      resolveQuery!({ rows: [] });
      await run1;
    });

    it('cleans up pending due reminders when due date changes or item is completed/cancelled/deleted', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await notificationsService.handleDueDateChanged('ai-1', '2026-11-10', '2026-11-15');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('PENDING', 'FAILED')"),
        ['ai-1', '2026-11-10'],
      );

      await notificationsService.handleActionItemCompleted('ai-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("notification_type IN ('ACTION_ITEM_DUE', 'DUE')"),
        ['ai-1'],
      );

      await notificationsService.handleActionItemCancelled('ai-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("notification_type IN ('ACTION_ITEM_DUE', 'DUE')"),
        ['ai-1'],
      );

      await notificationsService.handleActionItemDeleted('ai-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM action_item_notifications"),
        ['ai-1'],
      );
    });

    it('processes past-due action items in scheduler without waiting for another day', async () => {
      const pastDate = '2026-11-01';

      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM action_items ai') && sql.includes('ai.due_date <=')) {
          return {
            rows: [
              { id: 'ai-past-1', title: 'Overdue Task', due_date: pastDate, status: 'In Progress', owner_id: 'u-past' },
            ],
          } as any;
        }
        if (sql.includes('FROM action_item_notifications') && sql.includes('due_date = $2')) {
          return { rows: [] } as any;
        }
        if (sql.includes('WHERE ai.id = $1')) {
          return {
            rows: [
              {
                id: 'ai-past-1',
                title: 'Overdue Task',
                priority: 'High',
                status: 'In Progress',
                due_date: pastDate,
                is_deleted: false,
                account_id: 'acc-1',
                account_name: 'Acme',
                stakeholder_name: 'Overdue Owner',
                stakeholder_email: 'overdue@example.com',
                stakeholder_user_id: 'u-past',
              },
            ],
          } as any;
        }
        return { rows: [] } as any;
      });

      mockNotifications.create.mockResolvedValueOnce('notif-past-1');
      mockMail.sendMail.mockResolvedValueOnce(true);

      // Call scheduler with force=true (simulating 9:00 AM or manual run without targetDate)
      const result = await scheduler.triggerDueCheck(undefined, true);

      expect(result.totalCandidateItems).toBe(1);
      expect(result.sentCount).toBe(1);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      expect(mockMail.sendMail.mock.calls[0][1]).toBe('Action Item Due Date Expired: Overdue Task');
    });

    it('formats dates and hours consistently according to configured timezone', () => {
      const utcDate = getCurrentDateString('UTC');
      expect(utcDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const nyDate = getCurrentDateString('America/New_York');
      expect(nyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const istDate = getCurrentDateString('Asia/Kolkata');
      expect(istDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const invalidTzDate = getCurrentDateString('Invalid/Timezone_Name');
      expect(invalidTzDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const utcHour = getCurrentHourInTimezone('UTC');
      expect(utcHour).toBeGreaterThanOrEqual(0);
      expect(utcHour).toBeLessThanOrEqual(23);
    });
  });
});
