import 'reflect-metadata';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { StakeholderConnectsService } from '../stakeholder-connects.service';
import { StakeholderConnectsController } from '../stakeholder-connects.controller';
import { CONNECT_STATUSES, TIME_FORMAT_RE } from '../dto/create-stakeholder-connect.dto';
import { UpdateStakeholderConnectDto } from '../dto/update-stakeholder-connect.dto';
import { CreateDraftFollowUpDto, UpdateDraftFollowUpDto } from '../dto/draft-follow-up.dto';
import { ConvertDraftToActionItemDto } from '../dto/convert-draft.dto';
import { DB_SUPPORTED_ACTION_ITEM_TYPES } from '../../action-items/dto/action-item.dto';
import { DatabaseService } from '../../../database/database.service';
import { ActionItemsService } from '../../action-items/action-items.service';
import { NotificationEventBus } from '../../../common/events/notification-event-bus.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationsListener } from '../../notifications/notifications.listener';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { REQUIRE_PERMISSION_KEY, RequirePermissions, RequirePermission } from '../../rbac/require-permission.decorator';

describe('Stakeholder Connects Module Verification & Contracts', () => {
  // ─── 1. DTO and Validation Rules ───────────────────────────────────────────
  describe('DTO and Validation Rules', () => {
    it('validates supported meeting statuses', () => {
      expect(CONNECT_STATUSES).toEqual(['Scheduled', 'Completed', 'Cancelled', 'Rescheduled']);
      expect(CONNECT_STATUSES.length).toBe(4);
    });

    it('validates 24-hour time formats', () => {
      expect(TIME_FORMAT_RE.test('09:30')).toBe(true);
      expect(TIME_FORMAT_RE.test('14:45:00')).toBe(true);
      expect(TIME_FORMAT_RE.test('00:00')).toBe(true);
      expect(TIME_FORMAT_RE.test('23:59:59')).toBe(true);
      expect(TIME_FORMAT_RE.test('24:00')).toBe(false);
      expect(TIME_FORMAT_RE.test('12:60')).toBe(false);
      expect(TIME_FORMAT_RE.test('invalid')).toBe(false);
    });
  });

  // ─── 2. PermissionsGuard & Controller Decorator Authorization ──────────────
  describe('PermissionsGuard & Multi-Permission Enforcement', () => {
    let reflector: Reflector;
    let mockPermissionsService: any;
    let guard: PermissionsGuard;

    beforeEach(() => {
      reflector = new Reflector();
      mockPermissionsService = {
        can: jest.fn(),
      };
      guard = new PermissionsGuard(reflector, mockPermissionsService);
    });

    const createMockContext = (handler: any, userId?: string) => ({
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { sub: userId, email: 'test@example.com' } : undefined,
        }),
      }),
    }) as any;

    it('allows conversion when user holds BOTH stakeholder-connects:update AND action-items:create', async () => {
      class TestController {
        @RequirePermissions(
          { module: 'stakeholder-connects', permission: 'update' },
          { module: 'action-items', permission: 'create' },
        )
        convertDraft() {}
      }

      mockPermissionsService.can.mockImplementation((_u: string, mod: string, perm: string) => {
        if (mod === 'stakeholder-connects' && perm === 'update') return true;
        if (mod === 'action-items' && perm === 'create') return true;
        return false;
      });

      const context = createMockContext(TestController.prototype.convertDraft, 'user-123');
      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('rejects conversion when user holds ONLY stakeholder-connects:update (missing action-items:create)', async () => {
      class TestController {
        @RequirePermissions(
          { module: 'stakeholder-connects', permission: 'update' },
          { module: 'action-items', permission: 'create' },
        )
        convertDraft() {}
      }

      mockPermissionsService.can.mockImplementation((_u: string, mod: string, perm: string) => {
        if (mod === 'stakeholder-connects' && perm === 'update') return true;
        return false;
      });

      const context = createMockContext(TestController.prototype.convertDraft, 'user-123');
      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('You do not have permission to create action-items.'),
      );
    });

    it('rejects conversion when user holds ONLY action-items:create (missing stakeholder-connects:update)', async () => {
      class TestController {
        @RequirePermissions(
          { module: 'stakeholder-connects', permission: 'update' },
          { module: 'action-items', permission: 'create' },
        )
        convertDraft() {}
      }

      mockPermissionsService.can.mockImplementation((_u: string, mod: string, perm: string) => {
        if (mod === 'action-items' && perm === 'create') return true;
        return false;
      });

      const context = createMockContext(TestController.prototype.convertDraft, 'user-123');
      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('You do not have permission to update stakeholder-connects.'),
      );
    });

    it('allows access to GET endpoints for a user granted ONLY stakeholder-connects:view-all', async () => {
      class TestController {
        @RequirePermission('stakeholder-connects', 'view')
        findAll() {}
      }

      // PermissionsService.can maps 'view' request to (has view || has view-all)
      mockPermissionsService.can.mockImplementation((_u: string, mod: string, perm: string) => {
        if (mod === 'stakeholder-connects' && perm === 'view') {
          // User holds view-all which satisfies view
          return true;
        }
        return false;
      });

      const context = createMockContext(TestController.prototype.findAll, 'user-view-all');
      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('allows access to GET endpoints for a user granted ONLY stakeholder-connects:view', async () => {
      class TestController {
        @RequirePermission('stakeholder-connects', 'view')
        findAll() {}
      }

      mockPermissionsService.can.mockImplementation((_u: string, mod: string, perm: string) => {
        return mod === 'stakeholder-connects' && perm === 'view';
      });

      const context = createMockContext(TestController.prototype.findAll, 'user-view-only');
      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('rejects access to GET endpoints for a user with NEITHER permission', async () => {
      class TestController {
        @RequirePermission('stakeholder-connects', 'view')
        findAll() {}
      }

      mockPermissionsService.can.mockReturnValue(false);

      const context = createMockContext(TestController.prototype.findAll, 'user-none');
      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('You do not have permission to view stakeholder-connects.'),
      );
    });
  });

  // ─── 3. Business Logic, Conversion & Account Scoping ──────────────────────
  describe('Business Logic & Account Isolation Constraints', () => {
    let service: StakeholderConnectsService;
    let mockDb: any;
    let mockAccess: any;
    let mockPermissions: any;
    let mockActionItems: any;
    let mockServiceProvider: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
        withTransaction: jest.fn((callback: any) => callback(mockDb)),
      };
      mockAccess = {
        getContext: jest.fn().mockReturnValue({ canViewAllAccounts: true, permissions: new Set() }),
        buildChildVisibility: jest.fn().mockReturnValue({ conditions: [], params: [], nextIdx: 1 }),
        buildAccountVisibility: jest.fn().mockReturnValue({ conditions: [], params: [], nextIdx: 1 }),
      };
      mockPermissions = {
        can: jest.fn().mockReturnValue(true),
      };
      mockActionItems = {
        create: jest.fn(),
      };
      mockServiceProvider = {
        resolveOrCreate: jest.fn(),
      };

      service = new StakeholderConnectsService(
        mockDb,
        mockAccess,
        mockPermissions,
        mockActionItems,
        mockServiceProvider,
      );
    });

    // ─── Meeting Creation & Attendee Eligibility Rules ────────────────────────
    describe('Meeting Creation & Attendee Eligibility Rules', () => {
      const baseCreateDto = {
        accountId: 'acc-1',
        title: 'Project Kickoff',
        meetingDate: '2026-11-20',
        meetingTime: '10:00:00',
        ownerId: 'user-host',
        attendees: ['stk-client-1'],
      };

      it('rejects meeting creation when primary host does not exist in users (e.g. display name passed instead of UUID)', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [] };
          return { rows: [] };
        });

        await expect(
          service.create({ ...baseCreateDto, ownerId: 'Gayathri H N' }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('The selected primary host user does not exist.'));
      });

      it('rejects meeting creation when primary host is nonexistent user ID', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [] };
          return { rows: [] };
        });

        await expect(
          service.create({ ...baseCreateDto, ownerId: 'nonexistent-uuid' }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('The selected primary host user does not exist.'));
      });

      it('rejects meeting update when newly selected primary host does not exist in users', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                ownerId: 'user-host',
                status: 'Scheduled',
                meetingDate: '2026-11-20',
                meetingTime: '10:00:00',
                isDeleted: false,
              }],
            };
          }
          if (sql.includes('FROM users WHERE id = $1')) {
            return { rows: [] };
          }
          return { rows: [] };
        });

        await expect(
          service.update('conn-1', { ownerId: 'NonExistentUser' }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('The selected primary host user does not exist.'));
      });

      it('rejects meeting creation when attendees list is empty', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-host', name: 'Host' }] };
          return { rows: [] };
        });

        await expect(
          service.create({ ...baseCreateDto, attendees: [] }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('At least one valid stakeholder attendee is required.'));
      });

      it('rejects meeting creation when only service-provider attendees are selected', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-host', name: 'Host' }] };
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return {
              rows: [{ id: 'stk-sp-1', name: 'SP Alice', account_id: 'acc-1', stakeholder_type: 'SERVICE_PROVIDER', is_deleted: false }],
            };
          }
          return { rows: [] };
        });

        await expect(
          service.create({ ...baseCreateDto, attendees: ['stk-sp-1'] }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('At least one client attendee from the selected account is required.'));
      });

      it('rejects meeting creation when a client attendee belongs to a different account', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-host', name: 'Host' }] };
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return {
              rows: [{ id: 'stk-other', name: 'Bob Cross', account_id: 'acc-foreign', stakeholder_type: 'CLIENT', is_deleted: false }],
            };
          }
          return { rows: [] };
        });

        await expect(
          service.create({ ...baseCreateDto, attendees: ['stk-other'] }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('Client stakeholder "Bob Cross" does not belong to the selected account.'));
      });

      it('rejects meeting creation when user has no access to the account', async () => {
        mockAccess.getContext.mockResolvedValue({
          userId: 'user-restricted',
          canViewAllAccounts: false,
          permissions: new Set(['stakeholder-connects:create']),
        });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [] }; // Out of scope account
          }
          return { rows: [] };
        });

        await expect(
          service.create(baseCreateDto, 'user-restricted'),
        ).rejects.toThrow(new ForbiddenException('You do not have permission to access the selected account.'));
      });

      it('successfully creates meeting when at least one client attendee is selected', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-host', name: 'Host' }] };
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return {
              rows: [{ id: 'stk-client-1', name: 'Jane Client', account_id: 'acc-1', stakeholder_type: 'CLIENT', is_deleted: false }],
            };
          }
          if (sql.includes('INSERT INTO stakeholder_connects')) {
            return { rows: [{ id: 'conn-created-1' }] };
          }
          return { rows: [] };
        });

        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-created-1',
          title: 'Project Kickoff',
          attendees: [{ id: 'stk-client-1', name: 'Jane Client', stakeholderType: 'CLIENT' }],
        });

        const result = await service.create(baseCreateDto, 'user-1', 'User One');
        expect(result.id).toBe('conn-created-1');
        expect(result.attendees.length).toBe(1);
      });

      it('successfully creates meeting with both client and service-provider attendees', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM users WHERE id = $1')) return { rows: [{ id: 'user-host', name: 'Host' }] };
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            const stkId = params[0];
            if (stkId === 'stk-client-1') {
              return { rows: [{ id: 'stk-client-1', name: 'Jane Client', account_id: 'acc-1', stakeholder_type: 'CLIENT', is_deleted: false }] };
            }
            if (stkId === 'stk-sp-1') {
              return { rows: [{ id: 'stk-sp-1', name: 'SP Alice', account_id: 'acc-1', stakeholder_type: 'SERVICE_PROVIDER', is_deleted: false }] };
            }
          }
          if (sql.includes('INSERT INTO stakeholder_connects')) {
            return { rows: [{ id: 'conn-created-2' }] };
          }
          return { rows: [] };
        });

        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-created-2',
          title: 'Project Kickoff',
          attendees: [
            { id: 'stk-client-1', name: 'Jane Client', stakeholderType: 'CLIENT' },
            { id: 'stk-sp-1', name: 'SP Alice', stakeholderType: 'SERVICE_PROVIDER' },
          ],
        });

        const result = await service.create(
          { ...baseCreateDto, attendees: ['stk-client-1', 'stk-sp-1'] },
          'user-1',
          'User One',
        );
        expect(result.id).toBe('conn-created-2');
        expect(result.attendees.length).toBe(2);
      });
    });

    // ─── Action Item Conversion Authorization in Service ────────────────────
    describe('Draft Conversion Authorization & Integrity', () => {
      const draftPayload = {
        ownerStakeholderId: 'stk-1',
        dueDate: '2026-12-01',
        priority: 'High',
      };

      it('service converts draft successfully when user has both update and action-items:create', async () => {
        mockPermissions.can.mockImplementation((_u: string, mod: string, perm: string) => {
          if (mod === 'stakeholder-connects' && perm === 'update') return true;
          if (mod === 'action-items' && perm === 'create') return true;
          return false;
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connect_draft_follow_ups d')) {
            return {
              rows: [{
                id: 'draft-1',
                connectId: 'conn-1',
                title: 'Follow-up Item',
                description: null,
                suggestedOwnerId: null,
                suggestedOwnerName: null,
                suggestedDueDate: null,
                suggestedPriority: null,
                convertedActionItemId: 'ai-created-1',
                actionItemNumber: null,
                convertedAt: new Date().toISOString(),
              }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_draft_follow_ups')) {
            return {
              rows: [{ id: 'draft-1', connect_id: 'conn-1', title: 'Follow-up Item', converted_at: null }],
            };
          }
          if (sql.includes('FROM stakeholder_connects WHERE id = $1')) {
            return {
              rows: [{ id: 'conn-1', account_id: 'acc-1', meeting_date: '2026-11-05', status: 'Scheduled', is_deleted: false }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return {
              rows: [{ id: 'stk-1', name: 'Jane Client', account_id: 'acc-1', stakeholder_type: 'CLIENT' }],
            };
          }
          if (sql.includes('UPDATE stakeholder_connect_draft_follow_ups')) {
            return { rows: [] };
          }
          return { rows: [] };
        });

        mockActionItems.create.mockResolvedValue({ id: 'ai-created-1', title: 'Follow-up Item' });

        const result = await service.convertDraft('conn-1', 'draft-1', draftPayload, 'user-1', 'User One');
        expect(result.actionItem.id).toBe('ai-created-1');
        expect(result.draft.convertedActionItemId).toBe('ai-created-1');
        expect(mockActionItems.create).toHaveBeenCalled();
      });

      it('service rejects conversion if user lacks stakeholder-connects:update', async () => {
        mockPermissions.can.mockImplementation((_u: string, mod: string, perm: string) => {
          if (mod === 'action-items' && perm === 'create') return true;
          return false;
        });

        await expect(
          service.convertDraft('conn-1', 'draft-1', draftPayload, 'user-1'),
        ).rejects.toThrow(
          new ForbiddenException('You do not have permission to update stakeholder-connects.'),
        );
        expect(mockActionItems.create).not.toHaveBeenCalled();
      });

      it('service rejects conversion if user lacks action-items:create', async () => {
        mockPermissions.can.mockImplementation((_u: string, mod: string, perm: string) => {
          if (mod === 'stakeholder-connects' && perm === 'update') return true;
          return false;
        });

        await expect(
          service.convertDraft('conn-1', 'draft-1', draftPayload, 'user-1'),
        ).rejects.toThrow(
          new ForbiddenException('You do not have permission to create action-items.'),
        );
        expect(mockActionItems.create).not.toHaveBeenCalled();
      });

      it('rejects concurrent/duplicate conversion if draft was already converted', async () => {
        mockPermissions.can.mockReturnValue(true);
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects WHERE id = $1')) {
            return {
              rows: [{ id: 'conn-1', account_id: 'acc-1', meeting_date: '2026-11-05', status: 'Scheduled', is_deleted: false }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_draft_follow_ups')) {
            return {
              rows: [
                {
                  id: 'draft-1',
                  connect_id: 'conn-1',
                  title: 'Review SLA',
                  converted_at: new Date(),
                  converted_action_item_id: 'ai-100',
                },
              ],
            };
          }
          return { rows: [] };
        });

        await expect(
          service.convertDraft('conn-1', 'draft-1', draftPayload, 'user-1'),
        ).rejects.toThrow(ConflictException);
        expect(mockActionItems.create).not.toHaveBeenCalled();
      });

      it('protects converted draft from ordinary deletion', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('SELECT id, converted_at FROM stakeholder_connect_draft_follow_ups')) {
            return {
              rows: [{ id: 'draft-1', converted_at: new Date() }],
            };
          }
          return { rows: [] };
        });

        await expect(service.deleteDraft('conn-1', 'draft-1', 'user-1')).rejects.toThrow(
          new BadRequestException('Cannot delete a draft follow-up that has already been converted.'),
        );
      });
    });

    // ─── view vs view-all Scoping Tests ─────────────────────────────────────
    describe('view vs view-all Scoping', () => {
      it('user with view-all can read meetings across accounts without scoping restriction', async () => {
        mockAccess.getContext.mockResolvedValue({
          userId: 'user-all',
          canViewAllAccounts: false,
          permissions: new Set(['stakeholder-connects:view-all']),
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-10',
                  accountId: 'acc-external',
                  accountName: 'External Account',
                  ownerId: 'user-other',
                  ownerName: 'Other Owner',
                  title: 'Global Meeting',
                  meetingDate: '2026-11-05',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          return { rows: [] };
        });

        const meeting = await service.findOne('conn-10', 'user-all');
        expect(meeting.id).toBe('conn-10');
        expect(meeting.accountId).toBe('acc-external');
      });

      it('user with view only is denied read on meeting belonging to an out-of-scope account', async () => {
        mockAccess.getContext.mockResolvedValue({
          userId: 'user-scoped',
          canViewAllAccounts: false,
          permissions: new Set(['stakeholder-connects:view']),
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-11',
                  accountId: 'acc-forbidden',
                  accountName: 'Forbidden Account',
                  ownerId: 'user-other',
                  ownerName: 'Other Owner',
                  title: 'Private Meeting',
                  meetingDate: '2026-11-05',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            // Out of scope account
            return { rows: [] };
          }
          return { rows: [] };
        });

        await expect(service.findOne('conn-11', 'user-scoped')).rejects.toThrow(
          new ForbiddenException('You do not have permission to access the selected account.'),
        );
      });
    });

    // ─── Client Stakeholder Names Aggregation & Formatting ───────────────────
    describe('Client Stakeholder Names Aggregation & Formatting', () => {
      it('findAll includes clientStakeholderNames in query and returns formatted client names', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-multi-clients',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  ownerId: 'user-host',
                  ownerName: 'Host User',
                  title: 'Multi Client Meeting',
                  meetingDate: '2026-11-20',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                  clientStakeholderNames: 'Alice Client, Bob Client',
                  attendees: [
                    { id: 'stk-1', name: 'Alice Client', stakeholderType: 'CLIENT' },
                    { id: 'stk-2', name: 'Bob Client', stakeholderType: 'CLIENT' },
                    { id: 'stk-sp', name: 'SP Dave', stakeholderType: 'SERVICE_PROVIDER' },
                  ],
                },
              ],
            };
          }
          return { rows: [] };
        });

        const results = (await service.findAll({ userId: 'user-1', accountId: 'acc-1' })) as any[];
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(1);
        expect(results[0].clientStakeholderNames).toBe('Alice Client, Bob Client');

        const querySql = mockDb.query.mock.calls[0][0];
        expect(querySql).toContain('clientStakeholderNames');
        expect(querySql).toContain("s.stakeholder_type = 'CLIENT'");
      });

      it('findOne formats clientStakeholderNames for CLIENT attendees and excludes SERVICE_PROVIDER attendees', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('WHERE sc.id = $1')) {
            return {
              rows: [
                {
                  id: 'conn-mixed',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  ownerId: 'user-host',
                  ownerName: 'Host User',
                  title: 'Mixed Meeting',
                  meetingDate: '2026-11-20',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          if (sql.includes('FROM stakeholder_connect_attendees sca')) {
            return {
              rows: [
                { id: 'stk-client-1', name: 'John Smith', stakeholderType: 'CLIENT' },
                { id: 'stk-sp-1', name: 'Internal Host', stakeholderType: 'SERVICE_PROVIDER' },
                { id: 'stk-client-2', name: 'Lisa Davis', stakeholderType: 'CLIENT' },
              ],
            };
          }
          return { rows: [] };
        });

        const result = await service.findOne('conn-mixed', 'user-1');
        expect(result.id).toBe('conn-mixed');
        expect(result.clientStakeholderNames).toBe('John Smith, Lisa Davis');
      });

      it('returns empty clientStakeholderNames when no client stakeholders are attendees', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('WHERE sc.id = $1')) {
            return {
              rows: [
                {
                  id: 'conn-sp-only',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  ownerId: 'user-host',
                  ownerName: 'Host User',
                  title: 'Internal Only Meeting',
                  meetingDate: '2026-11-20',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          if (sql.includes('FROM stakeholder_connect_attendees sca')) {
            return {
              rows: [
                { id: 'stk-sp-1', name: 'Internal Host', stakeholderType: 'SERVICE_PROVIDER' },
              ],
            };
          }
          return { rows: [] };
        });

        const result = await service.findOne('conn-sp-only', 'user-1');
        expect(result.clientStakeholderNames).toBe('');
      });
    });

    // ─── Draft Follow-ups Aggregation & Display ──────────────────────────────
    describe('Draft Follow-ups Aggregation & Display', () => {
      it('findAll includes draftFollowUps json_agg in query and returns follow-ups with converted status', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-with-drafts',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  ownerId: 'user-host',
                  ownerName: 'Host User',
                  title: 'Meeting with Follow-ups',
                  meetingDate: '2026-11-20',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                  clientStakeholderNames: 'Alice Client',
                  attendees: [
                    { id: 'stk-1', name: 'Alice Client', stakeholderType: 'CLIENT' },
                  ],
                  draftFollowUps: [
                    {
                      id: 'draft-1',
                      connectId: 'conn-with-drafts',
                      title: 'Follow-up 1',
                      description: 'First follow-up task',
                      convertedAt: null,
                      convertedActionItemId: null,
                      actionItemNumber: null,
                    },
                    {
                      id: 'draft-2',
                      connectId: 'conn-with-drafts',
                      title: 'Follow-up 2',
                      description: 'Second follow-up task',
                      convertedAt: '2026-11-21T10:00:00Z',
                      convertedActionItemId: 'ai-123',
                      actionItemNumber: 'ACT-001',
                    },
                  ],
                  draftsCount: 2,
                },
              ],
            };
          }
          return { rows: [] };
        });

        const results = (await service.findAll({ userId: 'user-1', accountId: 'acc-1' })) as any[];
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(1);
        expect(results[0].draftFollowUps.length).toBe(2);
        expect(results[0].draftFollowUps[0].title).toBe('Follow-up 1');
        expect(results[0].draftFollowUps[1].title).toBe('Follow-up 2');
        expect(results[0].draftFollowUps[1].convertedAt).toBe('2026-11-21T10:00:00Z');
        expect(results[0].draftFollowUps[1].actionItemNumber).toBe('ACT-001');

        const querySql = mockDb.query.mock.calls[0][0];
        expect(querySql).toContain('draftFollowUps');
        expect(querySql).toContain('FROM stakeholder_connect_draft_follow_ups d');
      });

      it('findAll returns empty draftFollowUps array when meeting has no follow-ups', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-no-drafts',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  ownerId: 'user-host',
                  ownerName: 'Host User',
                  title: 'Meeting without Follow-ups',
                  meetingDate: '2026-11-20',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                  clientStakeholderNames: 'Alice Client',
                  attendees: [{ id: 'stk-1', name: 'Alice Client', stakeholderType: 'CLIENT' }],
                  draftFollowUps: [],
                  draftsCount: 0,
                },
              ],
            };
          }
          return { rows: [] };
        });

        const results = (await service.findAll({ userId: 'user-1', accountId: 'acc-1' })) as any[];
        expect(results[0].draftFollowUps).toEqual([]);
      });

      it('findAllDeactivated includes draftFollowUps in query', async () => {
        mockAccess.getContext.mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() });
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('sc.is_deleted = TRUE')) {
            return {
              rows: [
                {
                  id: 'conn-deact-drafts',
                  accountId: 'acc-1',
                  title: 'Deactivated Meeting',
                  isDeleted: true,
                  attendees: [],
                  draftFollowUps: [
                    { id: 'd-1', title: 'Archived task', convertedAt: null },
                  ],
                },
              ],
            };
          }
          return { rows: [] };
        });

        const deactivated = (await service.findAllDeactivated({ userId: 'user-1', accountId: 'acc-1' })) as any[];
        expect(deactivated[0].draftFollowUps.length).toBe(1);

        const querySql = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('sc.is_deleted = TRUE'),
        )[0];
        expect(querySql).toContain('draftFollowUps');
        expect(querySql).toContain('FROM stakeholder_connect_draft_follow_ups d');
      });
    });

    // ─── Participant Removal & Minimum-One-Attendee Validation ───────────────
    describe('Participant Management & Minimum Attendee Rule', () => {
      it('rejects removing attendee when meeting has only one attendee', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Solo Meeting',
          status: 'Scheduled',
          isDeleted: false,
          attendees: [{ id: 'stk-sole', name: 'Sole Attendee' }],
        });

        await expect(
          service.removeAttendee('conn-1', 'stk-sole', 'user-1'),
        ).rejects.toThrow(new BadRequestException('A meeting must retain at least one attendee.'));
      });

      it('rejects removing attendee when it would leave zero client attendees', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting with Client and SP',
          status: 'Scheduled',
          isDeleted: false,
          attendees: [
            { id: 'stk-client', name: 'Jane Client', stakeholderType: 'CLIENT' },
            { id: 'stk-sp', name: 'John SP', stakeholderType: 'SERVICE_PROVIDER' },
          ],
        });

        await expect(
          service.removeAttendee('conn-1', 'stk-client', 'user-1'),
        ).rejects.toThrow(new BadRequestException('A meeting must retain at least one client attendee from the account.'));
      });

      it('successfully removes attendee using id while preserving other attendees and stakeholder records', async () => {
        jest.spyOn(service, 'findOne')
          .mockResolvedValueOnce({
            id: 'conn-1',
            accountId: 'acc-1',
            title: 'Group Meeting',
            status: 'Scheduled',
            isDeleted: false,
            attendees: [
              { id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' },
              { id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' },
            ],
          })
          .mockResolvedValueOnce({
            id: 'conn-1',
            accountId: 'acc-1',
            title: 'Group Meeting',
            status: 'Scheduled',
            isDeleted: false,
            attendees: [{ id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' }],
          });

        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await service.removeAttendee('conn-1', 'stk-1', 'user-1', 'Tester');
        expect(result.attendees).toEqual([
          { id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' },
        ]);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM stakeholder_connect_attendees WHERE connect_id = $1 AND stakeholder_id = $2'),
          ['conn-1', 'stk-1'],
        );
        const deleteStakeholderCalls = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('DELETE FROM stakeholders'),
        );
        expect(deleteStakeholderCalls.length).toBe(0);
      });

      it('rejects removing attendee when stakeholderId is missing or literal undefined', async () => {
        await expect(
          service.removeAttendee('conn-1', '', 'user-1'),
        ).rejects.toThrow(new BadRequestException('Valid attendee stakeholder ID is required.'));

        await expect(
          service.removeAttendee('conn-1', 'undefined', 'user-1'),
        ).rejects.toThrow(new BadRequestException('Valid attendee stakeholder ID is required.'));

        expect(mockDb.query).not.toHaveBeenCalled();
      });

      it('rejects removing attendee when stakeholderId is not associated with the meeting', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Group Meeting',
          status: 'Scheduled',
          isDeleted: false,
          attendees: [
            { id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' },
            { id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' },
          ],
        });

        await expect(
          service.removeAttendee('conn-1', 'stk-nonexistent', 'user-1'),
        ).rejects.toThrow(new NotFoundException('Attendee is not associated with this meeting.'));

        const deleteCalls = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('DELETE FROM stakeholder_connect_attendees'),
        );
        expect(deleteCalls.length).toBe(0);
      });

      it('successfully adds an eligible attendee to an existing meeting', async () => {
        jest.spyOn(service, 'findOne')
          .mockResolvedValueOnce({
            id: 'conn-1',
            accountId: 'acc-1',
            title: 'Group Meeting',
            status: 'Scheduled',
            isDeleted: false,
            attendees: [{ id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' }],
          })
          .mockResolvedValueOnce({
            id: 'conn-1',
            accountId: 'acc-1',
            title: 'Group Meeting',
            status: 'Scheduled',
            isDeleted: false,
            attendees: [
              { id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' },
              { id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' },
            ],
          });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return {
              rows: [{
                id: 'stk-2',
                name: 'Attendee 2',
                account_id: 'acc-1',
                stakeholder_type: 'CLIENT',
                is_deleted: false,
              }],
            };
          }
          return { rows: [] };
        });

        const result = await service.addAttendee('conn-1', 'stk-2', 'user-1', 'Tester');
        expect(result.attendees.length).toBe(2);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO stakeholder_connect_attendees'),
          ['conn-1', 'stk-2'],
        );
      });

      it('successfully adds an additional attendee through the edit workflow while preserving existing attendees', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          attendees: [
            { id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' },
            { id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' },
          ],
        });

        mockDb.query.mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                ownerId: 'user-1',
                title: 'Meeting 1',
                meetingDate: '2026-11-20',
                meetingTime: '10:00:00',
                status: 'Scheduled',
                momNotes: '',
                cancellationReason: null,
                isDeleted: false,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            const stkId = params?.[0];
            return {
              rows: [{
                id: stkId,
                name: `Stakeholder ${stkId}`,
                account_id: 'acc-1',
                stakeholder_type: 'CLIENT',
                is_deleted: false,
              }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_attendees WHERE connect_id = $1')) {
            return { rows: [{ stakeholder_id: 'stk-1' }] };
          }
          return { rows: [] };
        });

        const result = await service.update(
          'conn-1',
          {
            attendees: ['stk-1', 'stk-2'],
          },
          'user-1',
        );

        expect(result.attendees.length).toBe(2);

        // Verify newly selected attendee was inserted
        const insertCalls = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('INSERT INTO stakeholder_connect_attendees'),
        );
        expect(insertCalls.length).toBe(1);
        expect(insertCalls[0][1]).toEqual(['conn-1', 'stk-2']);

        // Verify existing attendee was NOT deleted
        const deleteCalls = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('DELETE FROM stakeholder_connect_attendees'),
        );
        expect(deleteCalls.length).toBe(0);
      });

      it('editing unrelated fields does not touch or delete existing attendees', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'New Title Only',
          attendees: [{ id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' }],
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                ownerId: 'user-1',
                title: 'Meeting 1',
                meetingDate: '2026-11-20',
                meetingTime: '10:00:00',
                status: 'Scheduled',
                momNotes: '',
                cancellationReason: null,
                isDeleted: false,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });

        await service.update(
          'conn-1',
          {
            title: 'New Title Only',
          },
          'user-1',
        );

        // Neither INSERT nor DELETE on stakeholder_connect_attendees should be called
        const attendeeQueries = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('stakeholder_connect_attendees'),
        );
        expect(attendeeQueries.length).toBe(0);
      });

      it('rejects updating meeting with an empty attendees list', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                ownerId: 'user-1',
                title: 'Meeting 1',
                meetingDate: '2026-11-20',
                meetingTime: '10:00:00',
                status: 'Scheduled',
                isDeleted: false,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });

        await expect(
          service.update('conn-1', { attendees: [] }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('At least one valid stakeholder attendee is required.'));
      });

      it('rejects updating attendees if a client attendee belongs to a different account', async () => {
        mockDb.query.mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                ownerId: 'user-1',
                title: 'Meeting 1',
                meetingDate: '2026-11-20',
                meetingTime: '10:00:00',
                status: 'Scheduled',
                isDeleted: false,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return {
              rows: [{
                id: 'stk-other',
                name: 'Cross Account Client',
                account_id: 'acc-foreign',
                stakeholder_type: 'CLIENT',
                is_deleted: false,
              }],
            };
          }
          return { rows: [] };
        });

        await expect(
          service.update('conn-1', { attendees: ['stk-other'] }, 'user-1'),
        ).rejects.toThrow(new BadRequestException('Client stakeholder "Cross Account Client" does not belong to the selected account.'));
      });
    });

    // ─── Meeting Restoration Validation Constraints ──────────────────────────
    describe('Meeting Restoration Constraints', () => {
      it('rejects restoration if meeting is already active (not soft-deleted) without updating or logging', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('accounts a')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Active Meeting', isDeleted: false, accountDeleted: false }],
            };
          }
          return { rows: [] };
        });

        await expect(service.restore('conn-1', 'user-1', 'Tester')).rejects.toThrow(
          new BadRequestException('Cannot restore meeting because it is already active.'),
        );

        const updateCalls = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects'),
        );
        const activityCalls = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('INSERT INTO activities'),
        );
        expect(updateCalls).toHaveLength(0);
        expect(activityCalls).toHaveLength(0);
      });

      it('rejects restoration if parent account is deleted', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('accounts a')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-del', title: 'Deleted Account Meeting', isDeleted: true, accountDeleted: true }],
            };
          }
          return { rows: [] };
        });

        await expect(service.restore('conn-1', 'user-1')).rejects.toThrow(
          new BadRequestException('Cannot restore meeting because its parent account is deleted.'),
        );
      });

      it('rejects restoration if an attendee stakeholder is deactivated', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('accounts a')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Meeting', isDeleted: true, accountDeleted: false }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholder_connect_attendees sca')) {
            return {
              rows: [
                {
                  stakeholder_id: 'stk-deact',
                  is_deleted: true, // Deactivated attendee
                  account_id: 'acc-1',
                  stakeholder_type: 'CLIENT',
                },
              ],
            };
          }
          return { rows: [] };
        });

        await expect(service.restore('conn-1', 'user-1')).rejects.toThrow(
          new BadRequestException('Cannot restore meeting because one or more attendee stakeholders are deactivated.'),
        );
      });

      it('rejects restoration if an attendee belongs to a different account', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('accounts a')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Meeting', isDeleted: true, accountDeleted: false }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholder_connect_attendees sca')) {
            return {
              rows: [
                {
                  stakeholder_id: 'stk-other',
                  is_deleted: false,
                  account_id: 'acc-other-account', // Mismatched account
                  stakeholder_type: 'CLIENT',
                },
              ],
            };
          }
          return { rows: [] };
        });

        await expect(service.restore('conn-1', 'user-1')).rejects.toThrow(
          new BadRequestException('Cannot restore meeting because an attendee belongs to a different account.'),
        );
      });

      it('successfully restores a soft-deleted meeting when parent account and attendees are valid', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('accounts a')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Archived Meeting', isDeleted: true, accountDeleted: false }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholder_connect_attendees sca')) {
            return {
              rows: [
                {
                  stakeholder_id: 'stk-1',
                  is_deleted: false,
                  account_id: 'acc-1',
                  stakeholder_type: 'CLIENT',
                },
              ],
            };
          }
          return { rows: [] };
        });

        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Archived Meeting',
          isDeleted: false,
        });

        const restored = await service.restore('conn-1', 'user-1', 'Tester');
        expect(restored.isDeleted).toBe(false);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SET is_deleted = FALSE'),
          ['user-1', 'conn-1'],
        );
      });
    });

    // ─── Draft Follow-Up Update and Deletion ─────────────────────────────────
    describe('Draft Follow-Up Update & Deletion', () => {
      it('updates an unconverted draft follow-up', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('SELECT * FROM stakeholder_connect_draft_follow_ups')) {
            return {
              rows: [{
                id: 'draft-1',
                connect_id: 'conn-1',
                title: 'Old Draft',
                description: 'Old Desc',
                suggested_owner_id: null,
                suggested_due_date: null,
                suggested_priority: null,
                converted_at: null,
              }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_draft_follow_ups d')) {
            return {
              rows: [{
                id: 'draft-1',
                connectId: 'conn-1',
                title: 'Updated Draft',
                description: 'Updated Desc',
                suggestedOwnerId: null,
                suggestedOwnerName: null,
                suggestedDueDate: null,
                suggestedPriority: null,
              }],
            };
          }
          return { rows: [] };
        });

        const updated = await service.updateDraft(
          'conn-1',
          'draft-1',
          { title: 'Updated Draft', description: 'Updated Desc' },
          'user-1',
        );
        expect(updated.title).toBe('Updated Draft');
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE stakeholder_connect_draft_follow_ups'),
          ['Updated Draft', 'Updated Desc', null, null, null, 'draft-1'],
        );
      });

      it('deletes an unconverted draft follow-up', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('SELECT id, converted_at FROM stakeholder_connect_draft_follow_ups')) {
            return { rows: [{ id: 'draft-1', converted_at: null }] };
          }
          return { rows: [] };
        });

        const result = await service.deleteDraft('conn-1', 'draft-1', 'user-1');
        expect(result).toEqual({ success: true });
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM stakeholder_connect_draft_follow_ups WHERE id = $1 AND connect_id = $2'),
          ['draft-1', 'conn-1'],
        );
      });
    });

    // ─── Hard-Delete & Soft-Delete Protections ────────────────────────────────
    describe('Hard-Delete & Cascade Protection', () => {
      it('performs soft deletion only when removing meeting', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });

        await service.remove('conn-1', 'user-1', 'User One');

        const updateQueries = mockDb.query.mock.calls.filter((call: any) =>
          String(call[0]).includes('UPDATE stakeholder_connects') && String(call[0]).includes('is_deleted = TRUE'),
        );
        expect(updateQueries.length).toBe(1);

        const deleteQueries = mockDb.query.mock.calls.filter((call: any) =>
          String(call[0]).includes('DELETE FROM stakeholder_connects'),
        );
        expect(deleteQueries.length).toBe(0);
      });

      it('unlinking an action item only removes junction link and does not delete the action item', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockResolvedValue({ rows: [] });

        await service.unlinkActionItem('conn-1', 'ai-1', 'user-1');

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM stakeholder_connect_action_items WHERE connect_id = $1 AND action_item_id = $2'),
          ['conn-1', 'ai-1'],
        );

        const deleteAiQueries = mockDb.query.mock.calls.filter((call: any) =>
          String(call[0]).includes('DELETE FROM action_items'),
        );
        expect(deleteAiQueries.length).toBe(0);
      });
    });

    // ─── Action Item Linking & Account Isolation Constraints ──────────────────
    describe('Action Item Linking & Isolation Rules', () => {
      it('successfully links an existing action item belonging to the same account', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM action_items WHERE id = $1')) {
            return {
              rows: [{ id: 'ai-1', title: 'Action Item 1', account_id: 'acc-1', is_deleted: false, action_item_number: 'AI-001' }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_action_items WHERE connect_id = $1 AND action_item_id = $2')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO stakeholder_connect_action_items')) {
            return { rows: [] };
          }
          return { rows: [] };
        });

        const result = await service.linkActionItem('conn-1', 'ai-1', 'user-1', 'Tester');
        expect(result.success).toBe(true);
        expect(result.actionItemId).toBe('ai-1');

        const insertLink = mockDb.query.mock.calls.find((call: any) =>
          String(call[0]).includes('INSERT INTO stakeholder_connect_action_items'),
        );
        expect(insertLink).toBeDefined();
        expect(insertLink[1]).toEqual(['conn-1', 'ai-1']);
      });

      it('rejects linking an action item that belongs to a different account', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM action_items WHERE id = $1')) {
            return {
              rows: [{ id: 'ai-other', title: 'Foreign Action Item', account_id: 'acc-different', is_deleted: false }],
            };
          }
          return { rows: [] };
        });

        await expect(
          service.linkActionItem('conn-1', 'ai-other', 'user-1'),
        ).rejects.toThrow(new BadRequestException('Cannot link an Action Item belonging to a different account.'));
      });

      it('rejects linking an already-linked action item to prevent duplicates', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM action_items WHERE id = $1')) {
            return {
              rows: [{ id: 'ai-1', title: 'Action Item 1', account_id: 'acc-1', is_deleted: false }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_action_items WHERE connect_id = $1 AND action_item_id = $2')) {
            return { rows: [{ connect_id: 'conn-1', action_item_id: 'ai-1' }] };
          }
          return { rows: [] };
        });

        await expect(
          service.linkActionItem('conn-1', 'ai-1', 'user-1'),
        ).rejects.toThrow(new BadRequestException('This Action Item is already linked to this meeting.'));
      });

      it('rejects linking a soft-deleted action item', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
          status: 'Scheduled',
          isDeleted: false,
        });

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM action_items WHERE id = $1')) {
            return {
              rows: [{ id: 'ai-del', title: 'Deleted Item', account_id: 'acc-1', is_deleted: true }],
            };
          }
          return { rows: [] };
        });

        await expect(
          service.linkActionItem('conn-1', 'ai-del', 'user-1'),
        ).rejects.toThrow(new NotFoundException('Action Item does not exist or has been deleted.'));
      });
    });

    // ─── Legacy Field Invariance Across Complete Lifecycle ───────────────────
    describe('Legacy Field Invariance (No Phase 2 Sync in Phase 1)', () => {
      const mockAccountAndUser = () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users')) {
            return { rows: [{ id: 'user-1', name: 'Host' }] };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholders')) {
            return {
              rows: [{ id: 'stk-1', name: 'Jane Doe', account_id: 'acc-1', stakeholder_type: 'CLIENT', is_deleted: false }],
            };
          }
          if (sql.includes('INSERT INTO stakeholder_connects')) {
            return { rows: [{ id: 'conn-1' }] };
          }
          if (sql.includes('FROM stakeholder_connects')) {
            return {
              rows: [
                {
                  id: 'conn-1',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  ownerId: 'user-1',
                  ownerName: 'Host',
                  title: 'Valid Meeting',
                  meetingDate: '2026-11-20',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          return { rows: [] };
        });
      };

      it('preserves legacy fields across creation, completion, cancellation, rescheduling, and deletion', async () => {
        mockAccountAndUser();

        // 1. Create
        await service.create(
          {
            accountId: 'acc-1',
            title: 'Valid Meeting',
            ownerId: 'user-1',
            meetingDate: '2026-11-20',
            meetingTime: '10:00',
            attendees: ['stk-1'],
          },
          'user-1',
        );

        // 2. Reschedule
        await service.reschedule(
          'conn-1',
          { newDate: '2026-11-28', newTime: '11:00', reason: 'Client requested postponement' },
          'user-1',
        );

        // 3. Update details
        await service.update(
          'conn-1',
          { title: 'Updated Valid Meeting' },
          'user-1',
        );

        // 4. Cancel
        await service.cancel(
          'conn-1',
          { reason: 'Contract on hold' },
          'user-1',
        );

        // 5. Delete
        await service.remove('conn-1', 'user-1');

        // Verify across all executed queries:
        for (const call of mockDb.query.mock.calls) {
          const queryText = String(call[0]);
          expect(queryText).not.toContain('last_connect');
          expect(queryText).not.toContain('next_connect');
          expect(queryText).not.toContain('next_connect_status');
        }
      });
    });

    // ─── Attendee String Array Handling & Deactivated Query ──────────────────
    describe('Multiple Attendees & Deactivated Meetings Handling', () => {
      it('successfully creates meeting with multiple attendee string IDs', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users')) {
            return { rows: [{ id: 'user-1', name: 'Host' }] };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholders')) {
            return {
              rows: [
                { id: 'stk-1', name: 'Alice Client', account_id: 'acc-1', stakeholder_type: 'CLIENT', is_deleted: false },
                { id: 'stk-2', name: 'Bob Client', account_id: 'acc-1', stakeholder_type: 'CLIENT', is_deleted: false },
              ],
            };
          }
          if (sql.includes('INSERT INTO stakeholder_connects')) {
            return { rows: [{ id: 'conn-multi' }] };
          }
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-multi',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  title: 'Multi-Attendee Meeting',
                  meetingDate: '2026-11-10',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          return { rows: [] };
        });

        const result = await service.create(
          {
            accountId: 'acc-1',
            title: 'Multi-Attendee Meeting',
            ownerId: 'user-1',
            meetingDate: '2026-11-10',
            meetingTime: '10:00',
            attendees: ['stk-1', 'stk-2'],
          },
          'user-1',
        );

        expect(result.id).toBe('conn-multi');
        const attendeeInserts = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('INSERT INTO stakeholder_connect_attendees'),
        );
        expect(attendeeInserts.length).toBe(2);
      });

      it('successfully creates meeting with a client attendee and a valid service-provider attendee', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM users')) {
            return { rows: [{ id: 'user-1', name: 'Host' }] };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          if (sql.includes('FROM stakeholders')) {
            return {
              rows: [
                { id: 'stk-client', name: 'Client VP', account_id: 'acc-1', stakeholder_type: 'CLIENT', is_deleted: false },
                { id: 'stk-sp', name: 'SP Partner', account_id: 'acc-1', stakeholder_type: 'SERVICE_PROVIDER', is_deleted: false },
              ],
            };
          }
          if (sql.includes('INSERT INTO stakeholder_connects')) {
            return { rows: [{ id: 'conn-client-sp' }] };
          }
          if (sql.includes('FROM stakeholder_connects sc')) {
            return {
              rows: [
                {
                  id: 'conn-client-sp',
                  accountId: 'acc-1',
                  accountName: 'Acme Corp',
                  title: 'Client & SP Meeting',
                  meetingDate: '2026-11-10',
                  meetingTime: '10:00:00',
                  status: 'Scheduled',
                  isDeleted: false,
                },
              ],
            };
          }
          return { rows: [] };
        });

        const result = await service.create(
          {
            accountId: 'acc-1',
            title: 'Client & SP Meeting',
            ownerId: 'user-1',
            meetingDate: '2026-11-10',
            meetingTime: '10:00',
            attendees: ['stk-client', 'stk-sp'],
          },
          'user-1',
        );

        expect(result.id).toBe('conn-client-sp');
        const attendeeInserts = mockDb.query.mock.calls.filter((c: any) =>
          String(c[0]).includes('INSERT INTO stakeholder_connect_attendees'),
        );
        expect(attendeeInserts.length).toBe(2);
      });

      it('successfully fetches deactivated meetings via findAllDeactivated', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('sc.is_deleted = TRUE')) {
            return {
              rows: [
                {
                  id: 'conn-deact-1',
                  accountId: 'acc-1',
                  title: 'Deactivated Meeting',
                  isDeleted: true,
                  attendees: [],
                },
              ],
            };
          }
          return { rows: [] };
        });

        const deactivated = (await service.findAllDeactivated({ userId: 'user-1', accountId: 'acc-1' })) as any[];
        expect(Array.isArray(deactivated)).toBe(true);
        expect(deactivated.length).toBe(1);
        expect(deactivated[0].id).toBe('conn-deact-1');
        expect(deactivated[0].isDeleted).toBe(true);

        const queryCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('sc.is_deleted = TRUE'),
        );
        expect(queryCall).toBeDefined();
      });

      it('rejects findAllDeactivated and findAll(includeDeleted=true) before querying DB when user lacks delete permission', async () => {
        mockPermissions.can.mockResolvedValue(false);

        await expect(
          service.findAllDeactivated({ userId: 'user-view-only', accountId: 'acc-1' }),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.findAll({ userId: 'user-view-only', accountId: 'acc-1', includeDeleted: true }),
        ).rejects.toThrow(ForbiddenException);

        // Neither call should execute any SQL against stakeholder_connects before permission check
        expect(mockDb.query).not.toHaveBeenCalled();
      });
    });
  });

  // ─── 4. Controller Route Registration, HTTP Methods & Disambiguation ──────
  describe('StakeholderConnectsController Route Registration & Disambiguation', () => {
    let controller: StakeholderConnectsController;
    let mockService: any;

    beforeEach(() => {
      mockService = {
        findAll: jest.fn<any>().mockResolvedValue([]),
        findAllDeactivated: jest.fn<any>().mockResolvedValue([{ id: 'deact-1', isDeleted: true }]),
        findOne: jest.fn<any>().mockImplementation((id: string) => Promise.resolve({ id, title: 'Sample Meeting' })),
        create: jest.fn<any>().mockResolvedValue({ id: 'conn-new', title: 'New Meeting' }),
        update: jest.fn<any>().mockImplementation((id: string, dto: any) => Promise.resolve({ id, ...dto })),
        complete: jest.fn<any>().mockResolvedValue({ id: 'conn-1', status: 'Completed' }),
        reschedule: jest.fn<any>().mockResolvedValue({ id: 'conn-1', status: 'Rescheduled' }),
        cancel: jest.fn<any>().mockResolvedValue({ id: 'conn-1', status: 'Cancelled' }),
        remove: jest.fn<any>().mockResolvedValue({ success: true }),
        restore: jest.fn<any>().mockResolvedValue({ id: 'conn-1', isDeleted: false }),
        addAttendee: jest.fn<any>().mockResolvedValue({ id: 'conn-1', attendees: [{ id: 'stk-1' }, { id: 'stk-2' }] }),
        removeAttendee: jest.fn<any>().mockResolvedValue({ id: 'conn-1', attendees: [{ id: 'stk-2' }] }),
        createDraft: jest.fn<any>().mockResolvedValue({ id: 'draft-1', title: 'Draft 1' }),
        updateDraft: jest.fn<any>().mockResolvedValue({ id: 'draft-1', title: 'Draft Updated' }),
        deleteDraft: jest.fn<any>().mockResolvedValue({ success: true }),
        convertDraft: jest.fn<any>().mockResolvedValue({ draft: { id: 'draft-1' }, actionItem: { id: 'ai-1' } }),
        linkActionItem: jest.fn<any>().mockResolvedValue({ id: 'conn-1', success: true }),
        unlinkActionItem: jest.fn<any>().mockResolvedValue({ id: 'conn-1', success: true }),
      };
      controller = new StakeholderConnectsController(mockService);
    });

    it('standardizes all controller routes exclusively to GET and POST (no PATCH/PUT/DELETE)', () => {
      const proto = StakeholderConnectsController.prototype;
      const methodNames = Object.getOwnPropertyNames(proto).filter(
        (name) => name !== 'constructor' && typeof (proto as any)[name] === 'function',
      );

      const registeredRoutes = methodNames.map((name) => {
        const handler = (proto as any)[name];
        const httpMethod: RequestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        const path: string = Reflect.getMetadata(PATH_METADATA, handler);
        const httpCode: number | undefined = Reflect.getMetadata(HTTP_CODE_METADATA, handler);
        return { name, httpMethod, path, httpCode };
      });

      expect(registeredRoutes.length).toBe(23);
      for (const route of registeredRoutes) {
        expect([RequestMethod.GET, RequestMethod.POST]).toContain(route.httpMethod);
      }

      const routeMap = Object.fromEntries(registeredRoutes.map((r) => [r.name, r]));
      expect(routeMap.update).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/update', httpCode: HttpStatus.OK });
      expect(routeMap.complete).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/complete', httpCode: HttpStatus.OK });
      expect(routeMap.reschedule).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/reschedule', httpCode: HttpStatus.OK });
      expect(routeMap.cancel).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/cancel', httpCode: HttpStatus.OK });
      expect(routeMap.remove).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/delete', httpCode: HttpStatus.OK });
      expect(routeMap.restore).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/restore', httpCode: HttpStatus.OK });
      expect(routeMap.addAttendee).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/attendees' });
      expect(routeMap.removeAttendee).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/attendees/:stakeholderId/delete', httpCode: HttpStatus.OK });
      expect(routeMap.createDraft).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/drafts', httpCode: HttpStatus.CREATED });
      expect(routeMap.updateDraft).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/drafts/:draftId/update', httpCode: HttpStatus.OK });
      expect(routeMap.deleteDraft).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/drafts/:draftId/delete', httpCode: HttpStatus.OK });
      expect(routeMap.unlinkActionItem).toMatchObject({ httpMethod: RequestMethod.POST, path: ':id/action-items/:actionItemId/delete', httpCode: HttpStatus.OK });
    });

    it('routes GET deactivated to findAllDeactivated, not findOne', async () => {
      const authUser = { sub: 'user-1', email: 'test@example.com' } as any;
      const result = await controller.findAllDeactivated(authUser, undefined, undefined, 'acc-1');

      expect(mockService.findAllDeactivated).toHaveBeenCalledWith(
        { userId: 'user-1', accountId: 'acc-1' },
        null,
      );
      expect(mockService.findOne).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'deact-1', isDeleted: true }]);
    });

    it('requires both stakeholder-connects:view and stakeholder-connects:delete on GET deactivated route', () => {
      const perms = Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        StakeholderConnectsController.prototype.findAllDeactivated,
      );
      expect(perms).toEqual([
        { module: 'stakeholder-connects', permission: 'view' },
        { module: 'stakeholder-connects', permission: 'delete' },
      ]);
    });

    it('routes GET :id with an actual meeting ID to findOne correctly', async () => {
      const authUser = { sub: 'user-1', email: 'test@example.com' } as any;
      const meetingId = 'e2c34a8e-2f98-4d3b-9a48-89c0a6b7d123';
      const result = await controller.findOne(meetingId, authUser);
      expect(mockService.findOne).toHaveBeenCalledWith(meetingId, 'user-1');
      expect(result.id).toBe(meetingId);
    });

    it('routes POST :id/update for MoM-only update to update on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const payload = { mom: 'Updated MoM notes', momNotes: 'Updated MoM notes' };
      const result = await controller.update('conn-1', payload, authUser);

      expect(mockService.update).toHaveBeenCalledWith('conn-1', payload, 'user-1', 'Tester');
      expect(result.momNotes).toBe('Updated MoM notes');
    });

    it('routes POST :id/update for full connect edit to update on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const payload = {
        title: 'Q4 Executive Sync',
        meetingDate: '2026-12-01',
        meetingTime: '14:30:00',
        ownerId: 'user-2',
        momNotes: 'Agenda & outcomes',
        mom: 'Agenda & outcomes',
        attendees: ['stk-1', 'stk-2'],
      };
      const result = await controller.update('conn-1', payload, authUser);

      expect(mockService.update).toHaveBeenCalledWith('conn-1', payload, 'user-1', 'Tester');
      expect(result.title).toBe('Q4 Executive Sync');
    });

    it('routes POST :id/complete to complete method on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.complete('conn-1', authUser);

      expect(mockService.complete).toHaveBeenCalledWith('conn-1', 'user-1', 'Tester');
      expect(result.status).toBe('Completed');
    });

    it('routes POST :id/delete and POST :id/restore to remove and restore on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const delRes = await controller.remove('conn-1', authUser);
      expect(mockService.remove).toHaveBeenCalledWith('conn-1', 'user-1', 'Tester');
      expect(delRes).toEqual({ success: true });

      const restoreRes = await controller.restore('conn-1', authUser);
      expect(mockService.restore).toHaveBeenCalledWith('conn-1', 'user-1', 'Tester');
      expect(restoreRes.isDeleted).toBe(false);
    });

    it('routes POST :id/attendees and POST :id/attendees/:stakeholderId/delete to attendee handlers on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const added = await controller.addAttendee('conn-1', 'stk-2', authUser);
      expect(mockService.addAttendee).toHaveBeenCalledWith('conn-1', 'stk-2', 'user-1', 'Tester');
      expect(added.attendees.length).toBe(2);

      const removed = await controller.removeAttendee('conn-1', 'stk-1', authUser);
      expect(mockService.removeAttendee).toHaveBeenCalledWith('conn-1', 'stk-1', 'user-1', 'Tester');
      expect(removed.attendees).toEqual([{ id: 'stk-2' }]);
    });

    it('routes POST :id/drafts/:draftId/update and POST :id/drafts/:draftId/delete to draft handlers on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const updated = await controller.updateDraft('conn-1', 'draft-1', { title: 'Draft Updated' }, authUser);
      expect(mockService.updateDraft).toHaveBeenCalledWith('conn-1', 'draft-1', { title: 'Draft Updated' }, 'user-1');
      expect(updated.title).toBe('Draft Updated');

      const deleted = await controller.deleteDraft('conn-1', 'draft-1', authUser);
      expect(mockService.deleteDraft).toHaveBeenCalledWith('conn-1', 'draft-1', 'user-1');
      expect(deleted).toEqual({ success: true });
    });

    it('routes POST :id/action-items with body to linkActionItem on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.linkActionItemFromBody('conn-1', 'ai-123', authUser);

      expect(mockService.linkActionItem).toHaveBeenCalledWith('conn-1', 'ai-123', 'user-1', 'Tester');
      expect(result.success).toBe(true);
    });

    it('rejects POST :id/action-items if actionItemId is missing from body', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      await expect(
        controller.linkActionItemFromBody('conn-1', '' as any, authUser),
      ).rejects.toThrow(new BadRequestException('actionItemId is required in request body.'));
    });

    it('routes POST :id/action-items/:actionItemId to linkActionItem on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.linkActionItem('conn-1', 'ai-123', authUser);

      expect(mockService.linkActionItem).toHaveBeenCalledWith('conn-1', 'ai-123', 'user-1', 'Tester');
      expect(result.success).toBe(true);
    });

    it('routes POST :id/action-items/:actionItemId/delete to unlinkActionItem on service', async () => {
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.unlinkActionItem('conn-1', 'ai-123', authUser);

      expect(mockService.unlinkActionItem).toHaveBeenCalledWith('conn-1', 'ai-123', 'user-1', 'Tester');
      expect(result.success).toBe(true);
    });
  });

  // ─── 5. Lifecycle, Rescheduling, MoM, and Completion Verification ──────────
  describe('Lifecycle, Rescheduling, MoM, and Completion Verification', () => {
    let service: StakeholderConnectsService;
    let mockDb: any;
    let mockAccess: any;
    let mockPermissions: any;
    let mockActionItems: any;
    let mockServiceProvider: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
        withTransaction: jest.fn((callback: any) => callback(mockDb)),
      };
      mockAccess = {
        getContext: jest.fn().mockReturnValue({ canViewAllAccounts: true, permissions: new Set() }),
        buildChildVisibility: jest.fn().mockReturnValue({ conditions: [], params: [], nextIdx: 1 }),
        buildAccountVisibility: jest.fn().mockReturnValue({ conditions: [], params: [], nextIdx: 1 }),
      };
      mockPermissions = {
        can: jest.fn().mockReturnValue(true),
      };
      mockActionItems = {
        create: jest.fn(),
      };
      mockServiceProvider = {
        resolveOrCreate: jest.fn(),
      };

      service = new StakeholderConnectsService(
        mockDb,
        mockAccess,
        mockPermissions,
        mockActionItems,
        mockServiceProvider,
      );
    });

    const setupMeeting = (meeting: any) => {
      mockDb.query.mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('FROM stakeholder_connects sc') && sql.includes('WHERE sc.id = $1')) {
          return {
            rows: [
              {
                id: meeting.id || 'conn-1',
                accountId: meeting.accountId || 'acc-1',
                accountName: 'Acme Corp',
                ownerId: 'user-host',
                ownerName: 'Host User',
                ownerEmail: 'host@example.com',
                title: meeting.title || 'Cadence Sync',
                meetingDate: meeting.meetingDate || '2026-11-20',
                meetingTime: meeting.meetingTime || '15:00:00',
                status: meeting.status || 'Scheduled',
                momNotes: meeting.momNotes ?? 'Discussion notes',
                cancellationReason: meeting.cancellationReason ?? null,
                isDeleted: false,
                createdBy: 'user-1',
                createdAt: '2026-11-01',
                updatedAt: '2026-11-01',
              },
            ],
          };
        }
        if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: meeting.id || 'conn-1',
                accountId: meeting.accountId || 'acc-1',
                title: meeting.title || 'Cadence Sync',
                ownerId: 'user-host',
                meetingDate: meeting.meetingDate || '2026-11-20',
                meetingTime: meeting.meetingTime || '15:00:00',
                status: meeting.status || 'Scheduled',
                momNotes: meeting.momNotes ?? 'Discussion notes',
                cancellationReason: meeting.cancellationReason ?? null,
                isDeleted: false,
              },
            ],
          };
        }
        if (sql.includes('FROM stakeholder_connect_attendees')) {
          return {
            rows: [
              {
                id: 'stk-1',
                name: 'Client Sponsor',
                email: 'client@example.com',
                designation: 'VP',
                stakeholderType: 'CLIENT',
              },
            ],
          };
        }
        if (sql.includes('FROM stakeholder_connect_draft_follow_ups')) {
          return { rows: [] };
        }
        if (sql.includes('FROM stakeholder_connect_action_items')) {
          return { rows: [] };
        }
        if (sql.includes('FROM stakeholder_connect_reschedule_history')) {
          return { rows: [] };
        }
        return { rows: [] };
      });
    };

    // ── Date Handling ────────────────────────────────────────────────────────
    describe('Date and Time Handling', () => {
      it('accepts same date with a different future time for rescheduling', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-25',
          meetingTime: '15:00:00',
          status: 'Scheduled',
        });

        const result = await service.reschedule(
          'conn-1',
          {
            newDate: '2026-11-25',
            newTime: '20:00:00',
            reason: 'Postponed to evening slot',
          },
          'user-1',
          'Tester',
        );

        expect(result.id).toBe('conn-1');
        const historyInsert = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('INSERT INTO stakeholder_connect_reschedule_history'),
        );
        expect(historyInsert).toBeDefined();
        expect(historyInsert[1][1]).toBe('2026-11-25'); // oldDate ($2)
        expect(historyInsert[1][2]).toBe('15:00:00'); // oldTime ($3)
        expect(historyInsert[1][3]).toBe('2026-11-25'); // newDate ($4)
        expect(historyInsert[1][4]).toBe('20:00:00'); // newTime ($5)
        expect(historyInsert[1][5]).toBe('Postponed to evening slot'); // reason ($6)
      });

      it('accepts different date with the same time for rescheduling', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-25',
          meetingTime: '15:00:00',
          status: 'Scheduled',
        });

        const result = await service.reschedule(
          'conn-1',
          {
            newDate: '2026-11-28',
            newTime: '15:00:00',
          },
          'user-1',
          'Tester',
        );

        expect(result.id).toBe('conn-1');
        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects') &&
          String(c[0]).includes("SET meeting_date = $1, meeting_time = $2, status = 'Rescheduled'"),
        );
        expect(updateCall).toBeDefined();
        expect(updateCall[1][0]).toBe('2026-11-28');
        expect(updateCall[1][1]).toBe('15:00:00');
      });

      it('rejects identical date and time for rescheduling with clear message', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-25',
          meetingTime: '15:00:00',
          status: 'Scheduled',
        });

        await expect(
          service.reschedule(
            'conn-1',
            {
              newDate: '2026-11-25',
              newTime: '15:00:00',
            },
            'user-1',
          ),
        ).rejects.toThrow(
          new BadRequestException('The rescheduled meeting date and time must be different from the current schedule.'),
        );

        // Ensure no history record was inserted
        const historyInsert = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('INSERT INTO stakeholder_connect_reschedule_history'),
        );
        expect(historyInsert).toBeUndefined();
      });

      it('rejects a past date and time for rescheduling', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-25',
          meetingTime: '15:00:00',
          status: 'Scheduled',
        });

        await expect(
          service.reschedule(
            'conn-1',
            {
              newDate: '2020-01-01',
              newTime: '10:00:00',
            },
            'user-1',
          ),
        ).rejects.toThrow(
          new BadRequestException('Cannot reschedule meeting to a past date and time.'),
        );
      });

      it('normalizes DD-MM-YYYY format in rescheduling without shifting date', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-25',
          meetingTime: '15:00:00',
          status: 'Scheduled',
        });

        await service.reschedule(
          'conn-1',
          {
            newDate: '30-11-2026',
            newTime: '16:00',
          },
          'user-1',
        );

        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects') &&
          String(c[0]).includes("SET meeting_date = $1"),
        );
        expect(updateCall[1][0]).toBe('2026-11-30');
        expect(updateCall[1][1]).toBe('16:00:00');
      });
    });

    // ── MoM Display and Persistence ──────────────────────────────────────────
    describe('MoM Display and Persistence', () => {
      it('returns both momNotes and mom in findOne for complete frontend compatibility', async () => {
        setupMeeting({
          id: 'conn-mom',
          momNotes: 'Agreed on Q4 deliverables and cloud migration milestones.',
        });

        const details = await service.findOne('conn-mom', 'user-1');
        expect(details.momNotes).toBe('Agreed on Q4 deliverables and cloud migration milestones.');
        expect(details.mom).toBe('Agreed on Q4 deliverables and cloud migration milestones.');
      });

      it('updates existing MoM using either mom or momNotes property', async () => {
        setupMeeting({
          id: 'conn-mom',
          momNotes: 'Initial notes',
        });

        await service.update(
          'conn-mom',
          {
            mom: 'Updated notes from executive cadence.',
          },
          'user-1',
        );

        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects') &&
          String(c[0]).includes('SET title = $1'),
        );
        expect(updateCall).toBeDefined();
        expect(updateCall[1][5]).toBe('Updated notes from executive cadence.');
      });

      it('editing other fields does not clear or overwrite existing MoM', async () => {
        setupMeeting({
          id: 'conn-mom',
          title: 'Old Title',
          momNotes: 'Critical discussion points that must not be lost.',
        });

        await service.update(
          'conn-mom',
          {
            title: 'New Updated Title',
          },
          'user-1',
        );

        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects') &&
          String(c[0]).includes('SET title = $1'),
        );
        expect(updateCall[1][0]).toBe('New Updated Title');
        expect(updateCall[1][5]).toBe('Critical discussion points that must not be lost.');
      });
    });

    // ── Completion Workflow ──────────────────────────────────────────────────
    describe('Completion Workflow', () => {
      it('completes an eligible past/current scheduled meeting', async () => {
        setupMeeting({
          id: 'conn-past',
          meetingDate: '2026-01-10',
          meetingTime: '10:00:00',
          status: 'Scheduled',
        });

        const result = await service.complete('conn-past', 'user-1', 'Tester');
        expect(result.id).toBe('conn-past');

        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects') &&
          String(c[0]).includes("SET status = 'Completed'"),
        );
        expect(updateCall).toBeDefined();
        expect(updateCall[1][0]).toBe('user-1');
        expect(updateCall[1][1]).toBe('conn-past');
      });

      it('completes an eligible rescheduled meeting', async () => {
        setupMeeting({
          id: 'conn-resched',
          meetingDate: '2026-01-10',
          meetingTime: '10:00:00',
          status: 'Rescheduled',
        });

        const result = await service.complete('conn-resched', 'user-1', 'Tester');
        expect(result.id).toBe('conn-resched');

        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes("SET status = 'Completed'"),
        );
        expect(updateCall).toBeDefined();
      });

      it('rejects completing a future-dated meeting with a clear message', async () => {
        setupMeeting({
          id: 'conn-future',
          meetingDate: '2030-11-20',
          meetingTime: '10:00:00',
          status: 'Scheduled',
        });

        await expect(
          service.complete('conn-future', 'user-1'),
        ).rejects.toThrow(
          new BadRequestException(
            'A future meeting cannot be marked as completed. Update the meeting date/time after it has taken place.',
          ),
        );
      });

      it('rejects completing an already cancelled meeting', async () => {
        setupMeeting({
          id: 'conn-canc',
          status: 'Cancelled',
        });

        await expect(
          service.complete('conn-canc', 'user-1'),
        ).rejects.toThrow(
          new BadRequestException('Cancelled meetings cannot be completed.'),
        );
      });

      it('rejects completing an already completed meeting again', async () => {
        setupMeeting({
          id: 'conn-done',
          status: 'Completed',
        });

        await expect(
          service.complete('conn-done', 'user-1'),
        ).rejects.toThrow(
          new BadRequestException('Completed meetings cannot be completed again.'),
        );
      });
    });

    // ── Rescheduling and Status Editing Workflow ─────────────────────────────
    describe('Rescheduling and Lifecycle Transitions', () => {
      it('rejects direct manual selection of Rescheduled without changing date/time', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-20',
          meetingTime: '10:00:00',
          status: 'Scheduled',
        });

        await expect(
          service.update(
            'conn-1',
            {
              status: 'Rescheduled',
            },
            'user-1',
          ),
        ).rejects.toThrow(
          new BadRequestException('Cannot manually set status to Rescheduled without changing the meeting date or time.'),
        );
      });

      it('automatically treats date/time change in Edit as a reschedule and logs history', async () => {
        setupMeeting({
          id: 'conn-1',
          meetingDate: '2026-11-20',
          meetingTime: '10:00:00',
          status: 'Scheduled',
        });

        await service.update(
          'conn-1',
          {
            meetingDate: '2026-11-28',
            meetingTime: '14:00',
            rescheduleReason: 'Customer requested 4-day push',
          },
          'user-1',
        );

        const historyInsert = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('INSERT INTO stakeholder_connect_reschedule_history'),
        );
        expect(historyInsert).toBeDefined();
        expect(historyInsert[1][1]).toBe('2026-11-20');
        expect(historyInsert[1][3]).toBe('2026-11-28');
        expect(historyInsert[1][5]).toBe('Customer requested 4-day push');

        const updateCall = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('UPDATE stakeholder_connects') &&
          String(c[0]).includes('SET title = $1'),
        );
        expect(updateCall[1][4]).toBe('Rescheduled'); // status updated to Rescheduled
      });

      it('rejects rescheduling a cancelled meeting', async () => {
        setupMeeting({
          id: 'conn-canc',
          status: 'Cancelled',
        });

        await expect(
          service.reschedule(
            'conn-canc',
            {
              newDate: '2026-12-01',
              newTime: '10:00:00',
            },
            'user-1',
          ),
        ).rejects.toThrow(
          new BadRequestException('Cancelled meetings cannot be rescheduled.'),
        );
      });

      it('rejects rescheduling a completed meeting', async () => {
        setupMeeting({
          id: 'conn-comp',
          status: 'Completed',
        });

        await expect(
          service.reschedule(
            'conn-comp',
            {
              newDate: '2026-12-01',
              newTime: '10:00:00',
            },
            'user-1',
          ),
        ).rejects.toThrow(
          new BadRequestException('Completed meetings cannot be rescheduled.'),
        );
      });

      it('rejects modifying a cancelled meeting via update', async () => {
        setupMeeting({
          id: 'conn-canc',
          status: 'Cancelled',
        });

        await expect(
          service.update(
            'conn-canc',
            {
              title: 'Modified Title',
            },
            'user-1',
          ),
        ).rejects.toThrow(
          new BadRequestException('Cancelled meetings cannot be modified.'),
        );
      });

      it('prevents repeated cancellation of an already cancelled meeting', async () => {
        setupMeeting({
          id: 'conn-canc',
          status: 'Cancelled',
        });

        await expect(
          service.cancel('conn-canc', { reason: 'Duplicate cancel' }, 'user-1'),
        ).rejects.toThrow(
          new BadRequestException('Meeting is already cancelled.'),
        );
      });

      it('prevents cancellation of an already completed meeting', async () => {
        setupMeeting({
          id: 'conn-comp',
          status: 'Completed',
        });

        await expect(
          service.cancel('conn-comp', { reason: 'Cancel after completion' }, 'user-1'),
        ).rejects.toThrow(
          new BadRequestException('Completed meetings cannot be cancelled.'),
        );
      });
    });

    // ── Concurrency and Row-Level Locking ────────────────────────────────────
    describe('Concurrency and Row-Level Locking', () => {
      it('executes status mutations inside a transaction with FOR UPDATE row lock', async () => {
        setupMeeting({
          id: 'conn-lock',
          meetingDate: '2026-01-10',
          meetingTime: '10:00:00',
          status: 'Scheduled',
        });

        await service.complete('conn-lock', 'user-1');
        expect(mockDb.withTransaction).toHaveBeenCalled();

        const lockQuery = mockDb.query.mock.calls.find((c: any) =>
          String(c[0]).includes('FOR UPDATE'),
        );
        expect(lockQuery).toBeDefined();
        expect(lockQuery[1]).toEqual(['conn-lock']);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. COMPREHENSIVE LIFECYCLE, DRAFT CONTRACT, CONVERSION & TXN NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Lifecycle Policy Matrix, Draft Contract, Conversion & Post-Commit Notifications', () => {
    let service: StakeholderConnectsService;
    let mockDb: any;
    let mockAccess: any;
    let mockPermissions: any;
    let mockActionItems: any;
    let mockSpResolver: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
        withTransaction: jest.fn(async (cb: any) => {
          const hooks: Array<() => void | Promise<void>> = [];
          const res = await cb(mockDb, { afterCommit: (fn: () => void | Promise<void>) => hooks.push(fn) });
          for (const h of hooks) {
            await h();
          }
          return res;
        }),
      };
      mockAccess = {
        getContext: jest.fn<any>().mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() }),
        buildChildVisibility: jest.fn().mockReturnValue({ conditions: [], params: [] }),
        verifyAccountVisibility: jest.fn<any>().mockResolvedValue(true),
      };
      mockPermissions = { can: jest.fn<any>().mockResolvedValue(true) };
      mockActionItems = { create: jest.fn<any>() };
      mockSpResolver = { resolveOrCreate: jest.fn<any>() };

      service = new StakeholderConnectsService(
        mockDb,
        mockAccess,
        mockPermissions,
        mockActionItems,
        mockSpResolver,
      );
    });

    const mockFindOneStatus = (status: 'Scheduled' | 'Rescheduled' | 'Completed' | 'Cancelled', isDeleted = false) => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'conn-1',
        accountId: 'acc-1',
        ownerId: 'user-host',
        title: 'Test Meeting',
        meetingDate: '2025-10-01',
        meetingTime: '10:00:00',
        status,
        momNotes: 'Existing MoM',
        cancellationReason: status === 'Cancelled' ? 'Reason' : null,
        rescheduleReason: null,
        isDeleted,
        attendees: [
          { id: 'stk-c1', name: 'Client One', stakeholderType: 'CLIENT' },
          { id: 'stk-c2', name: 'Client Two', stakeholderType: 'CLIENT' },
        ],
      });
    };

    describe('10-Row Lifecycle Policy Matrix', () => {
      it('Completed meetings allow MoM updates and draft CRUD/convert, and reject meeting details, attendees, action items, reschedule, complete, cancel', async () => {
        // 1. Update MoM-only succeeds on Completed connect
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                ownerId: 'user-host',
                title: 'Completed Connect',
                meetingDate: '2025-10-01',
                meetingTime: '10:00:00',
                status: 'Completed',
                momNotes: 'Initial',
                cancellationReason: null,
                isDeleted: false,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });
        const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          status: 'Completed',
          momNotes: 'Final Post-Meeting MoM',
          isDeleted: false,
        });

        const momRes = await service.update('conn-1', { mom: 'Final Post-Meeting MoM' }, 'user-1');
        expect(momRes.momNotes).toBe('Final Post-Meeting MoM');
        findOneSpy.mockRestore();

        // 2. Rejects any non-MoM detail fields on Completed connect
        for (const payload of [
          { title: 'Retitled' },
          { meetingDate: '2026-12-01' },
          { meetingTime: '11:30' },
          { ownerId: 'user-other' },
          { attendees: ['stk-c1'] },
          { status: 'Scheduled' as any },
          { rescheduleReason: 'Later' },
          { cancellationReason: 'Cancelled' },
          { title: 'Retitled', mom: 'With MoM' },
        ]) {
          await expect(service.update('conn-1', payload as any, 'user-1')).rejects.toThrow(BadRequestException);
        }

        // 3. Rejects attendees, action items, reschedule, complete, cancel on Completed connect
        mockFindOneStatus('Completed');
        await expect(service.addAttendee('conn-1', 'stk-c2', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.removeAttendee('conn-1', 'stk-c1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.linkActionItem('conn-1', 'ai-1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.unlinkActionItem('conn-1', 'ai-1', 'user-1')).rejects.toThrow(BadRequestException);

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
            return { rows: [{ id: 'conn-1', account_id: 'acc-1', status: 'Completed', is_deleted: false }] };
          }
          if (sql.includes('FROM stakeholder_connects WHERE id = $1')) {
            return { rows: [{ id: 'conn-1', account_id: 'acc-1', status: 'Completed', is_deleted: false }] };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });
        await expect(service.reschedule('conn-1', { newDate: '2027-01-01', newTime: '11:00' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.complete('conn-1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.cancel('conn-1', { reason: 'No' }, 'user-1')).rejects.toThrow(BadRequestException);
      });

      it('Cancelled meetings are completely read-only for every mutation (including MoM and drafts CRUD/convert) while allowing soft delete', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects')) {
            return {
              rows: [{
                id: 'conn-1',
                accountId: 'acc-1',
                account_id: 'acc-1',
                ownerId: 'user-host',
                title: 'Cancelled Sync',
                meetingDate: '2025-10-01',
                meetingTime: '10:00:00',
                status: 'Cancelled',
                isDeleted: false,
                is_deleted: false,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });

        await expect(service.update('conn-1', { mom: 'MoM on Cancelled' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.update('conn-1', { title: 'Title on Cancelled' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.reschedule('conn-1', { newDate: '2027-01-01', newTime: '11:00' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.complete('conn-1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.cancel('conn-1', { reason: 'Again' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(
          service.convertDraft('conn-1', 'draft-1', { ownerStakeholderId: 'stk-c1', dueDate: '2027-01-01', priority: 'High' } as any, 'user-1'),
        ).rejects.toThrow(BadRequestException);

        mockFindOneStatus('Cancelled');
        await expect(service.createDraft('conn-1', { title: 'New Draft' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.updateDraft('conn-1', 'draft-1', { title: 'Edited Draft' }, 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.deleteDraft('conn-1', 'draft-1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.addAttendee('conn-1', 'stk-c2', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.removeAttendee('conn-1', 'stk-c1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.linkActionItem('conn-1', 'ai-1', 'user-1')).rejects.toThrow(BadRequestException);
        await expect(service.unlinkActionItem('conn-1', 'ai-1', 'user-1')).rejects.toThrow(BadRequestException);

        // Soft delete (remove) still succeeds on Cancelled meetings
        const del = await service.remove('conn-1', 'user-1', 'Tester');
        expect(del).toEqual({ success: true });
      });

      it('Soft-deleted meetings reject findOne with 404, reject remove idempotently without duplicate logs, and reject normal mutations', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('WHERE sc.id = $1')) {
            return {
              rows: [{
                id: 'conn-del',
                accountId: 'acc-1',
                status: 'Scheduled',
                isDeleted: true,
              }],
            };
          }
          if (sql.includes('FROM stakeholder_connects')) {
            return {
              rows: [{
                id: 'conn-del',
                accountId: 'acc-1',
                account_id: 'acc-1',
                status: 'Scheduled',
                isDeleted: true,
                is_deleted: true,
              }],
            };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            return { rows: [{ id: 'acc-1' }] };
          }
          return { rows: [] };
        });

        await expect(service.findOne('conn-del', 'user-1')).rejects.toThrow(NotFoundException);
        await expect(service.remove('conn-del', 'user-1')).rejects.toThrow(NotFoundException);
        expect(
          mockDb.query.mock.calls.filter((c: any) => String(c[0]).includes('INSERT INTO activity_logs')),
        ).toHaveLength(0);

        await expect(service.update('conn-del', { mom: 'Deleted edit' }, 'user-1')).rejects.toThrow(NotFoundException);
        await expect(service.reschedule('conn-del', { newDate: '2027-01-01', newTime: '10:00' }, 'user-1')).rejects.toThrow(NotFoundException);
        await expect(service.complete('conn-del', 'user-1')).rejects.toThrow(NotFoundException);
        await expect(service.cancel('conn-del', { reason: 'Deleted' }, 'user-1')).rejects.toThrow(NotFoundException);
        await expect(
          service.convertDraft('conn-del', 'draft-1', { ownerStakeholderId: 'stk-c1', dueDate: '2027-01-01', priority: 'High' } as any, 'user-1'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('Draft & Conversion ValidationPipe Strict Contracts', () => {
      const strictPipe = new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      });

      it('CreateDraftFollowUpDto & UpdateDraftFollowUpDto accept canonical suggested fields, normalize blanks to null, and reject unknown/legacy fields', async () => {
        const created = await strictPipe.transform(
          {
            title: '  Follow up  ',
            description: 'Details',
            suggestedOwnerId: 'stk-1',
            suggestedDueDate: '2026-12-20',
            suggestedPriority: 'High',
          },
          { type: 'body', metatype: CreateDraftFollowUpDto },
        );
        expect(created).toMatchObject({
          title: '  Follow up  ',
          suggestedOwnerId: 'stk-1',
          suggestedDueDate: '2026-12-20',
          suggestedPriority: 'High',
        });

        // Empty optional fields in UpdateDraftFollowUpDto normalize to null so edits can clear fields
        const cleared = await strictPipe.transform(
          {
            description: '',
            suggestedOwnerId: '',
            suggestedDueDate: '',
            suggestedPriority: '',
          },
          { type: 'body', metatype: UpdateDraftFollowUpDto },
        );
        expect(cleared).toMatchObject({
          description: null,
          suggestedOwnerId: null,
          suggestedDueDate: null,
          suggestedPriority: null,
        });

        // Reject legacy field name suggestedAssigneeStakeholderId & invalid values
        await expect(
          strictPipe.transform(
            { title: 'Legacy', suggestedAssigneeStakeholderId: 'stk-1' },
            { type: 'body', metatype: CreateDraftFollowUpDto },
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          strictPipe.transform(
            { title: 'Bad Priority', suggestedPriority: 'Urgent' },
            { type: 'body', metatype: CreateDraftFollowUpDto },
          ),
        ).rejects.toThrow(BadRequestException);

        await expect(
          strictPipe.transform(
            { title: 'Bad Date', suggestedDueDate: '2026/12/20' },
            { type: 'body', metatype: CreateDraftFollowUpDto },
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('ConvertDraftToActionItemDto accepts DB-supported types + empty notes and rejects CEO Connect & unknown frontend fields', async () => {
        const valid = await strictPipe.transform(
          {
            title: 'Deliver API Spec',
            notes: '',
            ownerStakeholderId: 'stk-1',
            priority: 'High',
            openDate: '2026-11-12',
            dueDate: '2026-12-01',
            actionItemType: 'Stakeholder connect',
          },
          { type: 'body', metatype: ConvertDraftToActionItemDto },
        );
        expect(valid.notes).toBe('');
        expect(valid.actionItemType).toBe('Stakeholder connect');
        expect(DB_SUPPORTED_ACTION_ITEM_TYPES).not.toContain('CEO Connect');

        // Rejects CEO Connect (blocked by PG chk_action_item_type)
        await expect(
          strictPipe.transform(
            {
              ownerStakeholderId: 'stk-1',
              priority: 'High',
              dueDate: '2026-12-01',
              actionItemType: 'CEO Connect',
            },
            { type: 'body', metatype: ConvertDraftToActionItemDto },
          ),
        ).rejects.toThrow(BadRequestException);

        // Rejects removed legacy fields (description, type, comments)
        await expect(
          strictPipe.transform(
            {
              ownerStakeholderId: 'stk-1',
              priority: 'High',
              dueDate: '2026-12-01',
              description: 'Legacy',
              type: 'Client Action',
              comments: 'Legacy note',
            },
            { type: 'body', metatype: ConvertDraftToActionItemDto },
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('createDraft & updateDraft persist suggestedDueDate/suggestedPriority and return camelCase canonical rows', async () => {
        mockFindOneStatus('Scheduled');
        const createdCamel = {
          id: 'draft-1',
          connectId: 'conn-1',
          title: 'Send SOW',
          description: 'Review clauses',
          suggestedOwnerId: 'stk-c1',
          suggestedOwnerName: 'Client One',
          suggestedDueDate: '2026-12-25',
          suggestedPriority: 'High',
          convertedAt: null,
          convertedActionItemId: null,
          actionItemNumber: null,
        };
        const updatedCamel = {
          ...createdCamel,
          title: 'Send Revised SOW',
          suggestedDueDate: null,
          suggestedPriority: 'Low',
        };

        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholders WHERE id = $1')) {
            return { rows: [{ id: 'stk-c1', account_id: 'acc-1', stakeholder_type: 'CLIENT' }] };
          }
          if (sql.startsWith('INSERT INTO stakeholder_connect_draft_follow_ups')) {
            return { rows: [{ id: 'draft-1' }] };
          }
          if (sql.includes('SELECT * FROM stakeholder_connect_draft_follow_ups')) {
            return {
              rows: [{
                id: 'draft-1',
                connect_id: 'conn-1',
                title: 'Send SOW',
                description: 'Review clauses',
                suggested_owner_id: 'stk-c1',
                suggested_due_date: '2026-12-25',
                suggested_priority: 'High',
                converted_at: null,
              }],
            };
          }
          if (sql.includes('FROM stakeholder_connect_draft_follow_ups d')) {
            const isAfterUpdate = mockDb.query.mock.calls.some((c: any) =>
              String(c[0]).includes('UPDATE stakeholder_connect_draft_follow_ups'),
            );
            return { rows: [isAfterUpdate ? updatedCamel : createdCamel] };
          }
          return { rows: [] };
        });

        const resCreate = await service.createDraft(
          'conn-1',
          {
            title: 'Send SOW',
            description: 'Review clauses',
            suggestedOwnerId: 'stk-c1',
            suggestedDueDate: '2026-12-25',
            suggestedPriority: 'High',
          },
          'user-1',
        );
        expect(resCreate).toEqual(createdCamel);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('suggested_due_date, suggested_priority'),
          ['conn-1', 'Send SOW', 'Review clauses', 'stk-c1', '2026-12-25', 'High', 'user-1'],
        );

        const resUpdate = await service.updateDraft(
          'conn-1',
          'draft-1',
          {
            title: 'Send Revised SOW',
            suggestedDueDate: null,
            suggestedPriority: 'Low',
          },
          'user-1',
        );
        expect(resUpdate).toEqual(updatedCamel);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('suggested_due_date = $4'),
          ['Send Revised SOW', 'Review clauses', 'stk-c1', null, 'Low', 'draft-1'],
        );
      });
    });

    describe('Post-Commit Notification Ordering with Real DatabaseService, ActionItemsService & NotificationsListener', () => {
      it('defers ActionItem:Created notification until COMMIT, never emits on ROLLBACK, and swallows post-commit listener errors', async () => {
        const prevDbUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

        const realDb = new DatabaseService();
        const sqlLog: string[] = [];
        const persistedNotifications: any[] = [];
        let failNotifInsert = false;

        const fakeClient = {
          query: jest.fn(async (sql: string, params?: any[]) => {
            const clean = sql.trim();
            sqlLog.push(clean);
            if (clean === 'BEGIN' || clean === 'COMMIT' || clean === 'ROLLBACK') {
              return { rows: [] };
            }
            if (clean.includes('FROM accounts a WHERE')) {
              return { rows: [{ id: 'acc-1' }] };
            }
            if (clean.includes('SELECT name FROM accounts WHERE id = $1')) {
              return { rows: [{ name: 'Acme Corp' }] };
            }
            if (clean.includes('FROM stakeholders WHERE id = $1')) {
              return { rows: [{ id: 'stk-c1', name: 'Client One', account_id: 'acc-1', stakeholder_type: 'CLIENT' }] };
            }
            if (clean.includes('INSERT INTO action_item_sequences')) {
              return { rows: [{ last_seq: 1 }] };
            }
            if (clean.startsWith('INSERT INTO action_items')) {
              return { rows: [{ id: 'ai-tx-1' }] };
            }
            if (clean.includes('FROM action_items ai')) {
              return {
                rows: [{
                  id: 'ai-tx-1',
                  action_item_number: 'ACM-0001',
                  title: 'Converted Task',
                  account_id: 'acc-1',
                  owner_id: 'user-owner-1',
                  owner_stakeholder_id: 'stk-c1',
                  due_date: '2026-12-20',
                  open_date: '2026-11-12',
                  priority: 'High',
                  status: 'To Do',
                  action_item_type: 'Stakeholder connect',
                  notes: '',
                  custom_data: {},
                }],
              };
            }
            return { rows: [] };
          }),
          release: jest.fn(),
        };

        jest.spyOn(realDb.pool, 'connect' as any).mockResolvedValue(fakeClient as any);
        jest.spyOn(realDb, 'query').mockImplementation(async (sql: string, params?: any[]) => {
          const clean = sql.trim();
          sqlLog.push(`pool:${clean}`);
          if (clean.includes('SELECT id FROM users')) {
            return { rows: [{ id: 'user-owner-1' }], rowCount: 1 } as any;
          }
          if (clean.startsWith('INSERT INTO notifications')) {
            if (failNotifInsert) {
              throw new Error('Transient notification DB outage');
            }
            persistedNotifications.push({ userId: params?.[0], actionItemId: params?.[9], eventType: params?.[2] });
            return { rows: [{ id: 'notif-1' }], rowCount: 1 } as any;
          }
          return fakeClient.query(sql, params) as any;
        });

        const bus = new NotificationEventBus();
        const busEmitSpy = jest.spyOn(bus, 'emit');
        const notificationsService = new NotificationsService(realDb as any, {} as any);
        const listener = new NotificationsListener(bus, notificationsService);
        listener.onModuleInit();

        const realActionItems = new ActionItemsService(
          realDb,
          {
            getFiscalContext: jest.fn<any>().mockResolvedValue({}),
            derivePeriod: jest.fn().mockReturnValue({ financialYear: 'FY27', quarter: 'Q3' }),
          } as any,
          {
            getContext: jest.fn<any>().mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() }),
            buildAccountVisibility: jest.fn().mockReturnValue({ conditions: [], params: [] }),
          } as any,
          bus,
          { can: jest.fn<any>().mockResolvedValue(true) } as any,
          {
            sendCreationNotification: jest.fn<any>().mockResolvedValue({ inApp: true, email: true }),
            sendDueReminder: jest.fn<any>().mockResolvedValue({ inApp: true, email: true }),
          } as any,
        );

        try {
          // Case A: Transaction commits — emit MUST happen strictly AFTER COMMIT
          let commitSeenAtEmit = false;
          busEmitSpy.mockImplementationOnce((event) => {
            commitSeenAtEmit = sqlLog.includes('COMMIT');
            return NotificationEventBus.prototype.emit.call(bus, event);
          });

          const createdItem = await realDb.withTransaction(async (client, tx) => {
            const item = await realActionItems.create(
              {
                title: 'Converted Task',
                accountId: 'acc-1',
                ownerStakeholderId: 'stk-c1',
                ownerId: 'user-owner-1',
                openDate: '2026-11-12',
                dueDate: '2026-12-20',
                priority: 'High',
                status: 'To Do',
                actionItemType: 'Stakeholder connect',
                notes: '',
              },
              'user-owner-1',
              client,
              tx.afterCommit,
            );
            // Before returning from callback (prior to COMMIT), bus.emit MUST NOT have fired
            expect(busEmitSpy).not.toHaveBeenCalled();
            return item;
          });

          await new Promise((r) => setImmediate(r));
          expect(createdItem.id).toBe('ai-tx-1');
          expect(commitSeenAtEmit).toBe(true);
          expect(busEmitSpy).toHaveBeenCalledTimes(1);
          expect(persistedNotifications).toEqual([
            { userId: 'user-owner-1', actionItemId: 'ai-tx-1', eventType: 'Created' },
          ]);

          // Case B: Transaction rolls back AFTER ActionItemsService.create — notification MUST NOT emit
          sqlLog.length = 0;
          busEmitSpy.mockClear();
          persistedNotifications.length = 0;

          await expect(
            realDb.withTransaction(async (client, tx) => {
              await realActionItems.create(
                {
                  title: 'Rolled Back Task',
                  accountId: 'acc-1',
                  ownerStakeholderId: 'stk-c1',
                  ownerId: 'user-owner-1',
                  openDate: '2026-11-12',
                  dueDate: '2026-12-20',
                  priority: 'High',
                  status: 'To Do',
                  actionItemType: 'Stakeholder connect',
                  notes: '',
                },
                'user-owner-1',
                client,
                tx.afterCommit,
              );
              throw new Error('Simulated draft conversion step failure');
            }),
          ).rejects.toThrow('Simulated draft conversion step failure');

          await new Promise((r) => setImmediate(r));
          expect(sqlLog).toContain('ROLLBACK');
          expect(sqlLog).not.toContain('COMMIT');
          expect(busEmitSpy).not.toHaveBeenCalled();
          expect(persistedNotifications).toHaveLength(0);

          // Case C: Notification error post-commit never fails committed transaction
          failNotifInsert = true;
          const postCommitRes = await realDb.withTransaction(async (_client, tx) => {
            tx.afterCommit(() => {
              throw new Error('Direct afterCommit error');
            });
            return 'committed-ok';
          });
          expect(postCommitRes).toBe('committed-ok');
        } finally {
          bus.onModuleDestroy();
          await realDb.onModuleDestroy();
          if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
          else process.env.DATABASE_URL = prevDbUrl;
        }
      });
    });

    describe('M-3 MoM Clearing Semantics & L-3 HTTP 413 Status Mapping', () => {
      it('UpdateStakeholderConnectDto preserves omitted MoM as undefined while preserving explicit empty/whitespace/null values', async () => {
        const pipe = new ValidationPipe({ whitelist: true, transform: true });

        const omitted = await pipe.transform(
          { title: 'Title Only' },
          { type: 'body', metatype: UpdateStakeholderConnectDto },
        );
        expect(omitted.mom).toBeUndefined();
        expect(omitted.momNotes).toBeUndefined();

        const clearedEmpty = await pipe.transform(
          { mom: '', momNotes: '' },
          { type: 'body', metatype: UpdateStakeholderConnectDto },
        );
        expect(clearedEmpty.mom).toBe('');
        expect(clearedEmpty.momNotes).toBe('');

        const clearedNull = await pipe.transform(
          { mom: null, momNotes: null },
          { type: 'body', metatype: UpdateStakeholderConnectDto },
        );
        expect(clearedNull.mom).toBeNull();
        expect(clearedNull.momNotes).toBeNull();

        const nonEmpty = await pipe.transform(
          { mom: '  Final notes  ' },
          { type: 'body', metatype: UpdateStakeholderConnectDto },
        );
        expect(nonEmpty.mom).toBe('  Final notes  ');
      });

      it('update() retains existing MoM when omitted, clears to NULL when empty/whitespace/null, trims non-empty, and preserves lifecycle rules', async () => {
        const setupExisting = (status: 'Scheduled' | 'Completed' | 'Cancelled') => {
          mockDb.query.mockReset();
          mockDb.query.mockImplementation((sql: string) => {
            if (sql.includes('FROM stakeholder_connects') && sql.includes('FOR UPDATE')) {
              return {
                rows: [{
                  id: 'conn-1',
                  accountId: 'acc-1',
                  ownerId: 'user-host',
                  title: 'Weekly Sync',
                  meetingDate: '2025-10-01',
                  meetingTime: '10:00:00',
                  status,
                  momNotes: 'Existing MoM text',
                  cancellationReason: null,
                  isDeleted: false,
                }],
              };
            }
            return { rows: [] };
          });
          jest.spyOn(service, 'findOne').mockResolvedValue({
            id: 'conn-1',
            accountId: 'acc-1',
            status,
            isDeleted: false,
          });
        };

        // 1. Omitted MoM retains existing momNotes
        setupExisting('Scheduled');
        await service.update('conn-1', { title: 'Renamed Sync' }, 'user-1');
        let updateCall = mockDb.query.mock.calls.find((c: any) => String(c[0]).includes('UPDATE stakeholder_connects'));
        expect(updateCall[1][5]).toBe('Existing MoM text');

        // 2. Explicit empty string clears mom_notes to null (allowed on Completed too)
        setupExisting('Completed');
        await service.update('conn-1', { mom: '', momNotes: '' }, 'user-1');
        updateCall = mockDb.query.mock.calls.find((c: any) => String(c[0]).includes('UPDATE stakeholder_connects'));
        expect(updateCall[1][5]).toBeNull();

        // 3. Explicit whitespace-only string clears mom_notes to null
        setupExisting('Completed');
        await service.update('conn-1', { mom: '   \n\t  ' }, 'user-1');
        updateCall = mockDb.query.mock.calls.find((c: any) => String(c[0]).includes('UPDATE stakeholder_connects'));
        expect(updateCall[1][5]).toBeNull();

        // 4. Explicit null clears mom_notes to null
        setupExisting('Scheduled');
        await service.update('conn-1', { momNotes: null }, 'user-1');
        updateCall = mockDb.query.mock.calls.find((c: any) => String(c[0]).includes('UPDATE stakeholder_connects'));
        expect(updateCall[1][5]).toBeNull();

        // 5. Non-empty MoM is trimmed and stored
        setupExisting('Completed');
        await service.update('conn-1', { mom: '  Updated summary  ' }, 'user-1');
        updateCall = mockDb.query.mock.calls.find((c: any) => String(c[0]).includes('UPDATE stakeholder_connects'));
        expect(updateCall[1][5]).toBe('Updated summary');

        // 6. Clearing MoM on a Cancelled meeting is still rejected by lifecycle policy
        setupExisting('Cancelled');
        await expect(service.update('conn-1', { mom: '' }, 'user-1')).rejects.toThrow(BadRequestException);
      });

      it('HttpExceptionFilter maps HTTP 413 PayloadTooLargeException to "Payload Too Large" while preserving status and message', () => {
        const filter = new HttpExceptionFilter();
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const host = {
          switchToHttp: () => ({
            getRequest: () => ({ method: 'POST', url: '/api/stakeholder-connects/conn-1/mom-attachments', headers: {} }),
            getResponse: () => ({ status }),
          }),
        } as any;

        filter.catch(new PayloadTooLargeException('File too large'), host);

        expect(status).toHaveBeenCalledWith(413);
        expect(json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 413,
            error: 'Payload Too Large',
            message: 'File too large',
          }),
        );
      });
    });
  });
});

