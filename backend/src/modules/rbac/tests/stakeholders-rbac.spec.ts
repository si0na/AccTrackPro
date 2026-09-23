import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { AccessScopeService } from '../access-scope.service';
import { UserAccessContext } from '../permissions.service';

describe('AccessScopeService - Stakeholders Visibility RBAC', () => {
  let service: AccessScopeService;
  let mockPermissionsService: any;

  beforeEach(() => {
    mockPermissionsService = {
      getUserAccessContext: jest.fn(),
    };
    service = new AccessScopeService(mockPermissionsService);
  });

  it('1. No stakeholder permission: should return 1=0 (no access)', () => {
    const ctx: UserAccessContext = {
      userId: 'user-no-stk-perm',
      userEmail: 'user1@example.com',
      roleId: 'r1',
      roleKey: 'custom-role',
      roleName: 'Custom Role',
      roleKeys: ['custom-role'],
      accountScopeField: null,
      accountScopeFields: [],
      canViewAllAccounts: false,
      permissions: new Set(['projects:view']),
    };

    const scope = service.buildStakeholderVisibility('s', ctx, 1);
    expect(scope.conditions).toEqual(['1=0']);
    expect(scope.params).toEqual([]);
  });

  it('2. Account view-all (canViewAllAccounts) must NOT grant stakeholder view-all if stakeholder permissions are absent', () => {
    const ctx: UserAccessContext = {
      userId: 'user-acc-viewall-only',
      userEmail: 'user2@example.com',
      roleId: 'r2',
      roleKey: 'sales-admin',
      roleName: 'Sales Admin',
      roleKeys: ['sales-admin'],
      accountScopeField: null,
      accountScopeFields: [],
      canViewAllAccounts: true, // Account view-all MUST NOT automatically grant stakeholder view-all
      permissions: new Set(['accounts:view-all']),
    };

    const scope = service.buildStakeholderVisibility('s', ctx, 1);
    expect(scope.conditions).toEqual(['1=0']);
    expect(scope.params).toEqual([]);
  });

  it('3. stakeholders:view ONLY (without view-all): should return scoped account visibility', () => {
    const ctx: UserAccessContext = {
      userId: 'user-am-view-only',
      userEmail: 'user3@example.com',
      roleId: 'r3',
      roleKey: 'account-manager',
      roleName: 'Account Manager',
      roleKeys: ['account-manager'],
      accountScopeField: 'account_manager_id',
      accountScopeFields: ['account_manager_id'],
      canViewAllAccounts: false,
      permissions: new Set(['stakeholders:view']),
    };

    const scope = service.buildStakeholderVisibility('s', ctx, 1);
    expect(scope.conditions.length).toBe(1);
    expect(scope.conditions[0]).toContain('s.account_id IS NULL OR EXISTS');
    expect(scope.conditions[0]).toContain('acc_stk_scope.account_manager_id = $1');
    expect(scope.params).toEqual(['user-am-view-only', 'user-am-view-only']);
  });

  it('4. stakeholders:view-all ONLY: should return empty conditions (all Client Stakeholders visible)', () => {
    const ctx: UserAccessContext = {
      userId: 'user-viewall-only',
      userEmail: 'user4@example.com',
      roleId: 'r4',
      roleKey: 'custom-auditor',
      roleName: 'Custom Auditor',
      roleKeys: ['custom-auditor'],
      accountScopeField: null,
      accountScopeFields: [],
      canViewAllAccounts: false,
      permissions: new Set(['stakeholders:view-all']),
    };

    const scope = service.buildStakeholderVisibility('s', ctx, 1);
    expect(scope.conditions).toEqual([]);
    expect(scope.params).toEqual([]);
  });

  it('5. stakeholders:view + stakeholders:view-all: should return empty conditions', () => {
    const ctx: UserAccessContext = {
      userId: 'user-view-and-viewall',
      userEmail: 'user5@example.com',
      roleId: 'r5',
      roleKey: 'project-manager',
      roleName: 'Project Manager',
      roleKeys: ['project-manager'],
      accountScopeField: null,
      accountScopeFields: [],
      canViewAllAccounts: false,
      permissions: new Set(['stakeholders:view', 'stakeholders:view-all']),
    };

    const scope = service.buildStakeholderVisibility('s', ctx, 1);
    expect(scope.conditions).toEqual([]);
    expect(scope.params).toEqual([]);
  });

  it('6. User with stakeholders:view + stakeholders:view-all, projects:view, but NO accounts or opportunities permissions: should see all Client Stakeholders', () => {
    const ctx: UserAccessContext = {
      userId: 'user-pm-no-acc-perm',
      userEmail: 'pm@example.com',
      roleId: 'r6',
      roleKey: 'project-manager',
      roleName: 'Project Manager',
      roleKeys: ['project-manager'],
      accountScopeField: null,
      accountScopeFields: [],
      canViewAllAccounts: false,
      permissions: new Set([
        'stakeholders:view',
        'stakeholders:view-all',
        'projects:view',
        'projects:view-all',
      ]),
    };

    const scope = service.buildStakeholderVisibility('s', ctx, 1);
    expect(scope.conditions).toEqual([]);
    expect(scope.params).toEqual([]);
  });
});
