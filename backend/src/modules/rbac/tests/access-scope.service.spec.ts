import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { AccessScopeService } from '../access-scope.service';
import { UserAccessContext } from '../permissions.service';

describe('AccessScopeService', () => {
  let service: AccessScopeService;
  let mockPermissionsService: any;

  beforeEach(() => {
    mockPermissionsService = {
      getUserAccessContext: jest.fn(),
    };
    service = new AccessScopeService(mockPermissionsService);
  });

  describe('buildAccountVisibility', () => {
    it('Test 4 — Admin: should return empty conditions when canViewAllAccounts is true', () => {
      const ctx: UserAccessContext = {
        userId: 'admin-user-id',
        roleId: 'admin-role-id',
        roleKey: 'admin',
        roleName: 'Admin',
        roleKeys: ['admin'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: true,
        permissions: new Set(['accounts:view-all']),
      };

      const result = service.buildAccountVisibility('acc', ctx, 1);

      expect(result.conditions).toEqual([]);
      expect(result.params).toEqual([]);
      expect(result.nextIdx).toBe(1);
    });

    it('Test 1 & 2 & 6 (Predicate Correctness): Account Manager should generate OR condition for assigned AM and owner_id', () => {
      const ctx: UserAccessContext = {
        userId: 'am-user-id',
        roleId: 'am-role-id',
        roleKey: 'account-manager',
        roleName: 'Account Manager',
        roleKeys: ['account-manager'],
        accountScopeField: 'account_manager_id',
        accountScopeFields: ['account_manager_id'],
        canViewAllAccounts: false,
        permissions: new Set(['accounts:view']),
      };

      const result = service.buildAccountVisibility('acc', ctx, 1);

      // Should produce: (acc.account_manager_id = $1 OR acc.owner_id = $2)
      expect(result.conditions).toEqual(['(acc.account_manager_id = $1 OR acc.owner_id = $2)']);
      expect(result.params).toEqual(['am-user-id', 'am-user-id']);
      expect(result.nextIdx).toBe(3);
    });

    it('Test 3 — Other ownership-scoped roles (e.g. Practice Lead): should NOT include owner_id in OR condition', () => {
      const ctx: UserAccessContext = {
        userId: 'pl-user-id',
        roleId: 'pl-role-id',
        roleKey: 'practice-lead',
        roleName: 'Practice Lead',
        roleKeys: ['practice-lead'],
        accountScopeField: 'practice_lead_id',
        accountScopeFields: ['practice_lead_id'],
        canViewAllAccounts: false,
        permissions: new Set(['accounts:view']),
      };

      const result = service.buildAccountVisibility('acc', ctx, 1);

      // Should produce: acc.practice_lead_id = $1
      expect(result.conditions).toEqual(['acc.practice_lead_id = $1']);
      expect(result.params).toEqual(['pl-user-id']);
      expect(result.nextIdx).toBe(2);
    });

    it('Test 5 — Multiple roles: should correctly union conditions and include owner_id because of Account Manager role', () => {
      const ctx: UserAccessContext = {
        userId: 'multi-user-id',
        roleId: 'am-role-id',
        roleKey: 'account-manager',
        roleName: 'Account Manager',
        roleKeys: ['account-manager', 'practice-lead'],
        accountScopeField: 'account_manager_id',
        accountScopeFields: ['account_manager_id', 'practice_lead_id'],
        canViewAllAccounts: false,
        permissions: new Set(['accounts:view']),
      };

      const result = service.buildAccountVisibility('acc', ctx, 1);

      // Should produce: (acc.account_manager_id = $1 OR acc.practice_lead_id = $2 OR acc.owner_id = $3)
      expect(result.conditions).toEqual([
        '(acc.account_manager_id = $1 OR acc.practice_lead_id = $2 OR acc.owner_id = $3)',
      ]);
      expect(result.params).toEqual(['multi-user-id', 'multi-user-id', 'multi-user-id']);
      expect(result.nextIdx).toBe(4);
    });

    it('Default user (no scope fields): should fall back to owner_id condition only', () => {
      const ctx: UserAccessContext = {
        userId: 'basic-user-id',
        roleId: 'basic-role-id',
        roleKey: 'basic',
        roleName: 'Basic User',
        roleKeys: ['basic'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['accounts:view']),
      };

      const result = service.buildAccountVisibility('acc', ctx, 1);

      // Should produce: acc.owner_id = $1
      expect(result.conditions).toEqual(['acc.owner_id = $1']);
      expect(result.params).toEqual(['basic-user-id']);
      expect(result.nextIdx).toBe(2);
    });
  });
});
