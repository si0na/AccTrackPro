/**
 * Integration tests for the Notifications subsystem.
 *
 * These tests wire up the real NestJS service classes (NotificationsService,
 * NotificationsListener, NotificationEventBus) with an in-memory mock of
 * DatabaseService and FilterContextService so they run without a live
 * PostgreSQL connection.
 *
 * Coverage targets:
 *  1. create()   — persists, drops on empty userId, drops on unknown userId
 *  2. findAll()  — user-scoped only; fiscal-period params are never applied
 *  3. getUnreadCount() — correct count based on is_read flag
 *  4. markRead / markAllRead / remove / clearRead — correct SQL dispatched
 *  5. Event bus → listener → create pipeline (end-to-end within the module)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationsService, CreateNotificationDto } from '../notifications.service';
import { NotificationsListener } from '../notifications.listener';
import { NotificationEventBus } from '../../../common/events/notification-event-bus.service';
import { NotificationEvent } from '../../../common/events/notification.events';

// ─── Shared test fixtures ──────────────────────────────────────────────────

const VALID_USER_ID   = 'user-uuid-001';
const UNKNOWN_USER_ID = 'user-uuid-999';

const BASE_DTO: CreateNotificationDto = {
  userId:               VALID_USER_ID,
  type:                 'Account',
  eventType:            'Created',
  title:                'Account Created',
  message:              'Test account was created.',
  severity:             'Info',
  notificationCategory: 'BUSINESS',
  accountId:            'acc-001',
};

// ─── In-memory mock for DatabaseService ───────────────────────────────────

interface StoredRow {
  id: string;
  user_id: string;
  type: string;
  event_type: string;
  title: string;
  message: string;
  severity: string;
  notification_category: string;
  account_id: string | null;
  opportunity_id: string | null;
  action_item_id: string | null;
  stakeholder_id: string | null;
  document_id: string | null;
  metadata: string;
  is_read: boolean;
  created_at: Date;
  read_at: Date | null;
}

class MockDatabaseService {
  notifications: StoredRow[] = [];
  users = [{ id: VALID_USER_ID }];

  private counter = 0;
  private nextId() { return `notif-${++this.counter}`; }

  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    const s = sql.trim().toLowerCase();

    // ── User validation ───────────────────────────────────────────────────
    if (s.includes('select id from users')) {
      const uid = params?.[0];
      const rows = this.users.filter((u) => u.id === uid);
      return { rows, rowCount: rows.length };
    }

    // ── Insert notification ───────────────────────────────────────────────
    if (s.startsWith('insert into notifications')) {
      const row: StoredRow = {
        id:                    this.nextId(),
        user_id:               params![0],
        type:                  params![1],
        event_type:            params![2],
        title:                 params![3],
        message:               params![4],
        severity:              params![5],
        notification_category: params![6],
        account_id:            params![7],
        opportunity_id:        params![8],
        action_item_id:        params![9],
        stakeholder_id:        params![10],
        document_id:           params![11],
        metadata:              params![12],
        is_read:               false,
        created_at:            new Date(),
        read_at:               null,
      };
      this.notifications.push(row);
      return { rows: [], rowCount: 1 };
    }

    // ── findAll: SELECT n.* FROM notifications n WHERE n.user_id = $1 ─────
    if (s.includes('select n.*')) {
      const userId = params?.[0];
      const filtered = this.notifications.filter((n) => n.user_id === userId);
      return { rows: filtered, rowCount: filtered.length };
    }

    // ── getUnreadCount: SELECT COUNT(*)::INTEGER AS count ─────────────────
    if (s.includes('count(*)')) {
      const userId = params?.[0];
      const count = this.notifications.filter((n) => n.user_id === userId && !n.is_read).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // ── update notifications ──────────────────────────────────────────────
    if (s.includes('update notifications')) {
      if (s.includes(' id = $1')) {
        // markRead (single)
        const id = params?.[0];
        const n = this.notifications.find((n) => n.id === id);
        if (n) { n.is_read = true; n.read_at = new Date(); }
        return { rows: [], rowCount: n ? 1 : 0 };
      } else if (s.includes('user_id = $1')) {
        // markAllRead
        const userId = params?.[0];
        let cnt = 0;
        this.notifications.forEach((n) => {
          if (n.user_id === userId && !n.is_read) {
            n.is_read = true;
            n.read_at = new Date();
            cnt++;
          }
        });
        return { rows: [], rowCount: cnt };
      }
    }

    // ── remove (single) ───────────────────────────────────────────────────
    if (s.startsWith('delete from notifications') && !s.includes('is_read')) {
      const id = params?.[0];
      const before = this.notifications.length;
      this.notifications = this.notifications.filter((n) => n.id !== id);
      return { rows: [], rowCount: before - this.notifications.length };
    }

    // ── clearRead ─────────────────────────────────────────────────────────
    if (s.startsWith('delete from notifications') && s.includes('is_read')) {
      const userId = params?.[0];
      const before = this.notifications.length;
      this.notifications = this.notifications.filter((n) => !(n.user_id === userId && n.is_read));
      return { rows: [], rowCount: before - this.notifications.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

// ─── Mock FilterContextService ─────────────────────────────────────────────

class MockFilterContextService {
  normalize(params: any) {
    return {
      userId:  params.userId  ?? undefined,
      fy:      params.financialYear ?? undefined,
      quarter: params.quarter ?? undefined,
    };
  }
  buildOwnerConditions() { return { conditions: [], params: [], nextIdx: 1 }; }
}

// ══════════════════════════════════════════════════════════════════════════════
// Test suites
// ══════════════════════════════════════════════════════════════════════════════

describe('NotificationsService', () => {
  let module: TestingModule;
  let service: NotificationsService;
  let db: MockDatabaseService;

  // findAll() without pagination always returns the legacy plain array —
  // narrow the union type once for the assertions below.
  const listAll = (params: Parameters<NotificationsService['findAll']>[0]) =>
    service.findAll(params) as Promise<any[]>;

  beforeEach(async () => {
    db = new MockDatabaseService();

    module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: 'DatabaseService',       useValue: db },
        { provide: 'FilterContextService',  useClass: MockFilterContextService },
      ],
    })
      .overrideProvider(NotificationsService)
      .useFactory({
        factory: () => {
          const svc = new (NotificationsService as any)(db, new MockFilterContextService());
          return svc;
        },
      })
      .compile();

    service = module.get(NotificationsService);
  });

  afterEach(() => module.close());

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('persists notification when userId is valid', async () => {
      await service.create(BASE_DTO);
      expect(db.notifications).toHaveLength(1);
      expect(db.notifications[0].user_id).toBe(VALID_USER_ID);
      expect(db.notifications[0].type).toBe('Account');
      expect(db.notifications[0].notification_category).toBe('BUSINESS');
    });

    it('drops notification and logs warn when userId is empty', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      await service.create({ ...BASE_DTO, userId: '' });
      expect(db.notifications).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('empty userId'));
      warnSpy.mockRestore();
    });

    it('drops notification and logs warn when userId is not in users table', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      await service.create({ ...BASE_DTO, userId: UNKNOWN_USER_ID });
      expect(db.notifications).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('userId not found'));
      warnSpy.mockRestore();
    });

    it('persists SYSTEM notification', async () => {
      await service.create({
        ...BASE_DTO,
        type:                 'System',
        eventType:            'LoggedIn',
        notificationCategory: 'SYSTEM',
        accountId:            undefined,
      });
      expect(db.notifications[0].notification_category).toBe('SYSTEM');
      expect(db.notifications[0].account_id).toBeNull();
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    beforeEach(async () => {
      // Seed: two BUSINESS + one SYSTEM
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, accountId: 'acc-002' });
      await service.create({ ...BASE_DTO, type: 'System', eventType: 'LoggedIn',
        notificationCategory: 'SYSTEM', accountId: undefined });
    });

    it('returns all notifications for the user', async () => {
      const result = await listAll({ userId: VALID_USER_ID });
      expect(result).toHaveLength(3);
    });

    it('ignores fiscal-period params — notifications are never period-filtered', async () => {
      const result = await listAll({ userId: VALID_USER_ID, financialYear: '2000-01', quarter: 'Q1' });
      expect(result).toHaveLength(3);
      const categories = result.map((r: any) => r.notificationCategory);
      expect(categories).toContain('SYSTEM');
      expect(categories).toContain('BUSINESS');
    });

    it('returns empty array when no userId supplied', async () => {
      const result = await listAll({});
      expect(result).toHaveLength(0);
    });

    it('does not return notifications for a different user', async () => {
      const result = await listAll({ userId: 'other-user' });
      expect(result).toHaveLength(0);
    });

    it('maps row fields to camelCase', async () => {
      const [notif] = await listAll({ userId: VALID_USER_ID });
      expect(notif).toMatchObject({
        userId:               VALID_USER_ID,
        type:                 expect.any(String),
        eventType:            expect.any(String),
        title:                expect.any(String),
        message:              expect.any(String),
        severity:             expect.any(String),
        notificationCategory: expect.any(String),
        isRead:               false,
        createdAt:            expect.any(String),
      });
    });
  });

  // ── getUnreadCount() ──────────────────────────────────────────────────────

  describe('getUnreadCount()', () => {
    beforeEach(async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, type: 'System', eventType: 'LoggedIn',
        notificationCategory: 'SYSTEM', accountId: undefined });
    });

    it('returns total unread count when no FY filter', async () => {
      const count = await service.getUnreadCount({ userId: VALID_USER_ID });
      expect(count).toBe(3);
    });

    it('decrements after markRead', async () => {
      const all = await listAll({ userId: VALID_USER_ID });
      await service.markRead(all[0].id);
      const count = await service.getUnreadCount({ userId: VALID_USER_ID });
      expect(count).toBe(2);
    });

    it('returns 0 for unknown userId', async () => {
      const count = await service.getUnreadCount({ userId: 'nobody' });
      expect(count).toBe(0);
    });
  });

  // ── markRead() ────────────────────────────────────────────────────────────

  describe('markRead()', () => {
    it('sets is_read=true on the targeted notification only', async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      const [first] = await listAll({ userId: VALID_USER_ID });
      await service.markRead(first.id);
      expect(db.notifications.find((n) => n.id === first.id)?.is_read).toBe(true);
      const unread = db.notifications.filter((n) => !n.is_read);
      expect(unread).toHaveLength(1);
    });

    it('returns { success: true }', async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      const [n] = await listAll({ userId: VALID_USER_ID });
      const result = await service.markRead(n.id);
      expect(result).toEqual({ success: true });
    });
  });

  // ── markAllRead() ─────────────────────────────────────────────────────────

  describe('markAllRead()', () => {
    it('marks all unread notifications for user as read', async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.markAllRead(VALID_USER_ID);
      const unread = db.notifications.filter((n) => !n.is_read);
      expect(unread).toHaveLength(0);
    });

    it('does not affect other users\' notifications', async () => {
      db.users.push({ id: 'other-user' });
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, userId: 'other-user', accountId: 'acc-001' });
      await service.markAllRead(VALID_USER_ID);
      const otherUnread = db.notifications.filter((n) => n.user_id === 'other-user' && !n.is_read);
      expect(otherUnread).toHaveLength(1);
    });

    it('returns { success: false } for empty userId', async () => {
      const result = await service.markAllRead('');
      expect(result).toEqual({ success: false });
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes the notification from storage', async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      const [n] = await listAll({ userId: VALID_USER_ID });
      await service.remove(n.id);
      expect(db.notifications).toHaveLength(0);
    });

    it('returns { success: true }', async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      const [n] = await listAll({ userId: VALID_USER_ID });
      const result = await service.remove(n.id);
      expect(result).toEqual({ success: true });
    });
  });

  // ── clearRead() ───────────────────────────────────────────────────────────

  describe('clearRead()', () => {
    it('removes only read notifications for the user', async () => {
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      await service.create({ ...BASE_DTO, accountId: 'acc-001' });
      const all = await listAll({ userId: VALID_USER_ID });
      await service.markRead(all[0].id);
      await service.clearRead(VALID_USER_ID);
      expect(db.notifications).toHaveLength(1);
      expect(db.notifications[0].is_read).toBe(false);
    });

    it('returns { success: false } for empty userId', async () => {
      const result = await service.clearRead('');
      expect(result).toEqual({ success: false });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Event bus → listener → service pipeline
// ══════════════════════════════════════════════════════════════════════════════

describe('NotificationEventBus + NotificationsListener (pipeline)', () => {
  let module: TestingModule;
  let bus: NotificationEventBus;
  let service: NotificationsService;
  let db: MockDatabaseService;

  beforeEach(async () => {
    db = new MockDatabaseService();

    module = await Test.createTestingModule({
      providers: [
        NotificationEventBus,
        NotificationsListener,
        {
          provide: NotificationsService,
          useFactory: () => new (NotificationsService as any)(db, new MockFilterContextService()),
        },
      ],
    }).compile();

    bus     = module.get(NotificationEventBus);
    service = module.get(NotificationsService);

    const listener = module.get(NotificationsListener);
    listener.onModuleInit();
  });

  afterEach(() => module.close());

  function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  const VALID_EVENT: NotificationEvent = {
    userId:               VALID_USER_ID,
    type:                 'Account',
    eventType:            'Created',
    title:                'Account Created',
    message:              'Pipeline test account',
    severity:             'Info',
    notificationCategory: 'BUSINESS',
    accountId:            'acc-001',
  };

  it('persists notification when a valid event is emitted', async () => {
    bus.emit(VALID_EVENT);
    await wait(20); // allow async handler to complete
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0].user_id).toBe(VALID_USER_ID);
    expect(db.notifications[0].event_type).toBe('Created');
  });

  it('drops notification when emitted event has no userId', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    bus.emit({ ...VALID_EVENT, userId: '' });
    await wait(20);
    expect(db.notifications).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('drops notification when userId is not found in users table', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    bus.emit({ ...VALID_EVENT, userId: UNKNOWN_USER_ID });
    await wait(20);
    expect(db.notifications).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('handles multiple concurrent events', async () => {
    bus.emit(VALID_EVENT);
    bus.emit({ ...VALID_EVENT, eventType: 'Updated', title: 'Account Updated' });
    bus.emit({ ...VALID_EVENT, type: 'System', eventType: 'LoggedIn',
      notificationCategory: 'SYSTEM', accountId: undefined });
    await wait(50);
    expect(db.notifications).toHaveLength(3);
  });

  it('SYSTEM event is persisted without accountId', async () => {
    bus.emit({
      userId:               VALID_USER_ID,
      type:                 'System',
      eventType:            'Registered',
      title:                'Welcome',
      message:              'Your account is ready.',
      severity:             'Success',
      notificationCategory: 'SYSTEM',
    });
    await wait(20);
    expect(db.notifications[0].notification_category).toBe('SYSTEM');
    expect(db.notifications[0].account_id).toBeNull();
  });
});
