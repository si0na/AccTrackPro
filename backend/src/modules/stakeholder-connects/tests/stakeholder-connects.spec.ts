import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StakeholderConnectsService } from '../stakeholder-connects.service';
import { StakeholderConnectsController } from '../stakeholder-connects.controller';
import { CONNECT_STATUSES, TIME_FORMAT_RE } from '../dto/create-stakeholder-connect.dto';
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
          if (sql.includes('FROM stakeholder_connect_draft_follow_ups')) {
            return {
              rows: [{ id: 'draft-1', connect_id: 'conn-1', title: 'Follow-up Item', converted_at: null }],
            };
          }
          if (sql.includes('FROM stakeholder_connects WHERE id = $1')) {
            return {
              rows: [{ id: 'conn-1', account_id: 'acc-1', meeting_date: '2026-11-05', is_deleted: false }],
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
            return {
              rows: [
                {
                  id: 'draft-1',
                  converted_at: new Date(),
                  converted_action_item_id: 'ai-created-1',
                },
              ],
            };
          }
          return { rows: [] };
        });

        mockActionItems.create.mockResolvedValue({ id: 'ai-created-1', title: 'Follow-up Item' });

        const result = await service.convertDraft('conn-1', 'draft-1', draftPayload, 'user-1', 'User One');
        expect(result.actionItem.id).toBe('ai-created-1');
        expect(result.draft.converted_action_item_id).toBe('ai-created-1');
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
          attendees: [
            { id: 'stk-client', name: 'Jane Client', stakeholderType: 'CLIENT' },
            { id: 'stk-sp', name: 'John SP', stakeholderType: 'SERVICE_PROVIDER' },
          ],
        });

        await expect(
          service.removeAttendee('conn-1', 'stk-client', 'user-1'),
        ).rejects.toThrow(new BadRequestException('A meeting must retain at least one client attendee from the account.'));
      });

      it('successfully removes attendee when meeting retains at least one client attendee', async () => {
        jest.spyOn(service, 'findOne')
          .mockResolvedValueOnce({
            id: 'conn-1',
            accountId: 'acc-1',
            title: 'Group Meeting',
            attendees: [
              { id: 'stk-1', name: 'Attendee 1', stakeholderType: 'CLIENT' },
              { id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' },
            ],
          })
          .mockResolvedValueOnce({
            id: 'conn-1',
            accountId: 'acc-1',
            title: 'Group Meeting',
            attendees: [{ id: 'stk-2', name: 'Attendee 2', stakeholderType: 'CLIENT' }],
          });

        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await service.removeAttendee('conn-1', 'stk-1', 'user-1');
        expect(result.attendees.length).toBe(1);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM stakeholder_connect_attendees'),
          ['conn-1', 'stk-1'],
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
      it('rejects restoration if parent account is deleted', async () => {
        mockDb.query.mockImplementation((sql: string) => {
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('accounts a')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-del', title: 'Deleted Account Meeting', accountDeleted: true }],
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
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Meeting', accountDeleted: false }],
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
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Meeting', accountDeleted: false }],
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
    });

    // ─── Hard-Delete & Soft-Delete Protections ────────────────────────────────
    describe('Hard-Delete & Cascade Protection', () => {
      it('performs soft deletion only when removing meeting', async () => {
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'conn-1',
          accountId: 'acc-1',
          title: 'Meeting 1',
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
          { newDate: '2026-11-25', newTime: '11:00', reason: 'Client requested postponement' },
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
    });
  });

  // ─── 4. Controller Route Registration & Disambiguation ─────────────────────
  describe('StakeholderConnectsController Route Registration & Disambiguation', () => {
    let controller: StakeholderConnectsController;
    let mockService: any;

    beforeEach(() => {
      mockService = {
        findAll: jest.fn<any>().mockResolvedValue([]),
        findAllDeactivated: jest.fn<any>().mockResolvedValue([{ id: 'deact-1', isDeleted: true }]),
        findOne: jest.fn<any>().mockImplementation((id: string) => Promise.resolve({ id, title: 'Sample Meeting' })),
      };
      controller = new StakeholderConnectsController(mockService);
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

    it('routes GET :id with an actual meeting ID to findOne correctly', async () => {
      const authUser = { sub: 'user-1', email: 'test@example.com' } as any;
      const meetingId = 'e2c34a8e-2f98-4d3b-9a48-89c0a6b7d123';
      const result = await controller.findOne(meetingId, authUser);
      expect(mockService.findOne).toHaveBeenCalledWith(meetingId, 'user-1');
      expect(result.id).toBe(meetingId);
    });

    it('routes POST :id/complete to complete method on service', async () => {
      mockService.complete = jest.fn<any>().mockResolvedValue({ id: 'conn-1', status: 'Completed' });
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.complete('conn-1', authUser);

      expect(mockService.complete).toHaveBeenCalledWith('conn-1', 'user-1', 'Tester');
      expect(result.status).toBe('Completed');
    });

    it('routes POST :id/action-items with body to linkActionItem on service', async () => {
      mockService.linkActionItem = jest.fn<any>().mockResolvedValue({ id: 'conn-1', success: true });
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
      mockService.linkActionItem = jest.fn<any>().mockResolvedValue({ id: 'conn-1', success: true });
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.linkActionItem('conn-1', 'ai-123', authUser);

      expect(mockService.linkActionItem).toHaveBeenCalledWith('conn-1', 'ai-123', 'user-1', 'Tester');
      expect(result.success).toBe(true);
    });

    it('routes POST :id/action-items/:actionItemId/delete to unlinkActionItem on service', async () => {
      mockService.unlinkActionItem = jest.fn<any>().mockResolvedValue({ id: 'conn-1', success: true });
      const authUser = { sub: 'user-1', name: 'Tester', email: 'test@example.com' } as any;
      const result = await controller.unlinkActionItemPost('conn-1', 'ai-123', authUser);

      expect(mockService.unlinkActionItem).toHaveBeenCalledWith('conn-1', 'ai-123', 'user-1', 'Tester');
      expect(result.success).toBe(true);
    });

    it('routes DELETE :id/action-items/:actionItemId to unlinkActionItem on service', async () => {
      mockService.unlinkActionItem = jest.fn<any>().mockResolvedValue({ id: 'conn-1', success: true });
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
});

