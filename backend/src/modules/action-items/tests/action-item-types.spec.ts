import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateActionItemDto, UpdateActionItemDto, ACTION_ITEM_TYPES } from '../dto/action-item.dto';
import { validateDto } from '../../../common/utils/validate-dto.util';
import { ActionItemsService, generateAccountPrefix } from '../action-items.service';
import { DatabaseService } from '../../../database/database.service';
import { FilterContextService } from '../../../common/services/filter-context.service';
import { AccessScopeService } from '../../rbac/access-scope.service';
import { PermissionsService } from '../../rbac/permissions.service';
import { NotificationEventBus } from '../../../common/events/notification-event-bus.service';
import { ActionItemNotificationsService } from '../action-item-notifications.service';

describe('Action Item Types — DTO Validation, Service Mapping, and Constraints', () => {
  describe('1. Supported Action Item Types List', () => {
    it('defines exactly the 20 approved action item types including CEO Connect', () => {
      expect(ACTION_ITEM_TYPES).toEqual([
        'Account mining',
        'Approval',
        'Board Meeting',
        'CEO Connect',
        'Communication',
        'Customer Request',
        'Decision',
        'Dependency',
        'Documentation',
        'Escalation',
        'Follow-up',
        'Issue Resolution',
        'Meeting Action',
        'Opportunity / Growth',
        'Other',
        'Proposals',
        'Review',
        'Risk Mitigation',
        'Stakeholder connect',
        'Task',
      ]);
      expect(ACTION_ITEM_TYPES).toContain('CEO Connect');
      expect(ACTION_ITEM_TYPES.length).toBe(20);
    });
  });

  describe('2. DTO Validation for Supported Types', () => {
    const baseValidPayload = {
      title: 'Valid Action Item Title',
      accountId: 'acc-123',
      priority: 'High',
      status: 'To Do',
    };

    it.each(ACTION_ITEM_TYPES)(
      'validates CreateActionItemDto successfully with actionItemType="%s"',
      async (typeValue) => {
        const errors = await validateDto(CreateActionItemDto, {
          ...baseValidPayload,
          actionItemType: typeValue,
        });
        expect(errors).toEqual([]);
      },
    );

    it.each(ACTION_ITEM_TYPES)(
      'validates CreateActionItemDto successfully with alias type="%s"',
      async (typeValue) => {
        const errors = await validateDto(CreateActionItemDto, {
          ...baseValidPayload,
          type: typeValue,
        });
        expect(errors).toEqual([]);
      },
    );

    it('validates CreateActionItemDto when type is omitted or undefined', async () => {
      const errors = await validateDto(CreateActionItemDto, {
        ...baseValidPayload,
      });
      expect(errors).toEqual([]);
    });

    it.each(ACTION_ITEM_TYPES)(
      'validates UpdateActionItemDto successfully with actionItemType="%s"',
      async (typeValue) => {
        const errors = await validateDto(UpdateActionItemDto, {
          id: 'ai-1',
          actionItemType: typeValue,
        });
        expect(errors).toEqual([]);
      },
    );

    it.each(ACTION_ITEM_TYPES)(
      'validates UpdateActionItemDto successfully with alias type="%s"',
      async (typeValue) => {
        const errors = await validateDto(UpdateActionItemDto, {
          id: 'ai-1',
          type: typeValue,
        });
        expect(errors).toEqual([]);
      },
    );
  });

  describe('3. DTO Rejection of Invalid Types (400 Bad Request)', () => {
    const baseValidPayload = {
      title: 'Valid Action Item Title',
      accountId: 'acc-123',
      priority: 'High',
      status: 'To Do',
    };

    const invalidTypes = [
      'InvalidType',
      'CEO',
      'Random Nonexistent Type',
      'Task123',
      'meeting',
      'OTHER',
    ];

    it.each(invalidTypes)(
      'rejects CreateActionItemDto with invalid actionItemType="%s"',
      async (invalidType) => {
        const errors = await validateDto(CreateActionItemDto, {
          ...baseValidPayload,
          actionItemType: invalidType,
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.includes('actionItemType') || e.includes('type'))).toBe(true);
      },
    );

    it.each(invalidTypes)(
      'rejects CreateActionItemDto with invalid type="%s"',
      async (invalidType) => {
        const errors = await validateDto(CreateActionItemDto, {
          ...baseValidPayload,
          type: invalidType,
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.includes('actionItemType') || e.includes('type'))).toBe(true);
      },
    );

    it.each(invalidTypes)(
      'rejects UpdateActionItemDto with invalid actionItemType="%s"',
      async (invalidType) => {
        const errors = await validateDto(UpdateActionItemDto, {
          id: 'ai-1',
          actionItemType: invalidType,
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.includes('actionItemType') || e.includes('type'))).toBe(true);
      },
    );

    it.each(invalidTypes)(
      'rejects UpdateActionItemDto with invalid type="%s"',
      async (invalidType) => {
        const errors = await validateDto(UpdateActionItemDto, {
          id: 'ai-1',
          type: invalidType,
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.includes('actionItemType') || e.includes('type'))).toBe(true);
      },
    );
  });

  describe('4. Service Layer Mapping & Persistence', () => {
    let service: ActionItemsService;
    let mockDb: any;
    let mockFilterContext: any;
    let mockAccessScope: any;
    let mockPermissions: any;
    let mockBus: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
        withTransaction: jest.fn(async (callback: any) => {
          const client = {
            query: jest.fn().mockImplementation(async (...args: any[]) => {
              const sql = String(args[0] || '');
              if (sql.includes('INSERT INTO action_item_sequences')) {
                return { rows: [{ last_seq: 1 }] };
              }
              if (sql.includes('INSERT INTO action_items')) {
                return { rows: [{ id: 'ai-new-uuid' }] };
              }
              return { rows: [] };
            }),
          };
          return callback(client);
        }),
        pool: {} as any,
      };

      mockFilterContext = {
        getFiscalContext: jest.fn().mockReturnValue({ deriveFiscalPeriod: () => ({ financialYear: '2026-27', quarter: 'Q3' }) }),
      };
      mockAccessScope = {};
      mockPermissions = {
        can: jest.fn().mockReturnValue(Promise.resolve(true)),
      };
      mockBus = {
        emit: jest.fn(),
      };
      mockNotifications = {
        sendCreationNotification: jest.fn().mockReturnValue(Promise.resolve({ inApp: true, email: false })),
        handleDueDateChanged: jest.fn(),
        handleActionItemCompleted: jest.fn(),
        handleActionItemDeleted: jest.fn(),
      };

      service = new ActionItemsService(
        mockDb as DatabaseService,
        mockFilterContext as FilterContextService,
        mockAccessScope as AccessScopeService,
        mockBus as NotificationEventBus,
        mockPermissions as PermissionsService,
        mockNotifications as ActionItemNotificationsService,
      );

      // Mock relation checks and findOne in service
      jest.spyOn(service as any, 'assertValidRelations').mockResolvedValue(undefined as never);
      jest.spyOn(service as any, 'assertOwnerStakeholder').mockResolvedValue(undefined as never);
      jest.spyOn(service as any, 'log').mockResolvedValue(undefined as never);
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'ai-new-uuid',
        title: 'CEO Connect Item',
        accountId: 'acc-1',
        priority: 'High',
        status: 'To Do',
        actionItemType: 'CEO Connect',
      } as any);
    });

    it('successfully creates an action item with actionItemType="CEO Connect"', async () => {
      mockDb.query.mockImplementation(async (...args: any[]) => {
        const sql = String(args[0] || '');
        if (sql.includes('SELECT name FROM accounts WHERE id = $1')) {
          return { rows: [{ name: 'Enterprise Corp' }] };
        }
        return { rows: [] };
      });

      const result = await service.create({
        title: 'Strategy Meeting with CEO',
        accountId: 'acc-1',
        priority: 'High',
        status: 'To Do',
        actionItemType: 'CEO Connect',
        ownerId: 'user-creator',
      });

      expect(result.id).toBe('ai-new-uuid');
      expect(mockDb.withTransaction).toHaveBeenCalledTimes(1);
    });

    it('correctly maps alias type="CEO Connect" to actionItemType in SQL insert', async () => {
      let insertedParams: any[] = [];
      mockDb.query.mockImplementation(async (...args: any[]) => {
        const sql = String(args[0] || '');
        if (sql.includes('SELECT name FROM accounts WHERE id = $1')) {
          return { rows: [{ name: 'Reflections' }] };
        }
        return { rows: [] };
      });

      mockDb.withTransaction.mockImplementationOnce(async (callback: any) => {
        const client = {
          query: jest.fn().mockImplementation(async (...args: any[]) => {
            const sql = String(args[0] || '');
            const params = args[1] || [];
            if (sql.includes('INSERT INTO action_item_sequences')) {
              return { rows: [{ last_seq: 1 }] };
            }
            if (sql.includes('INSERT INTO action_items')) {
              insertedParams = params;
              return { rows: [{ id: 'ai-alias-uuid' }] };
            }
            return { rows: [] };
          }),
        };
        return callback(client);
      });

      await service.create({
        title: 'Alias Type Item',
        accountId: 'acc-1',
        priority: 'Medium',
        status: 'To Do',
        type: 'CEO Connect', // alias
        ownerId: 'user-creator',
      });

      // Parameter index 11 (0-based) corresponds to action_item_type ($12 in SQL)
      expect(insertedParams[11]).toBe('CEO Connect');
    });
  });
});
