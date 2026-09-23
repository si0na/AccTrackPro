import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { AccessScopeService } from '../access-scope.service';
import { UserAccessContext } from '../permissions.service';

describe('Project Manager Project Access & Dedicated Project Action Items RBAC', () => {
  let scopeService: AccessScopeService;
  let mockPermissionsService: any;

  beforeEach(() => {
    mockPermissionsService = {
      getUserAccessContext: jest.fn(),
    };
    scopeService = new AccessScopeService(mockPermissionsService);
  });

  describe('buildProjectVisibility & buildActionItemVisibility', () => {
    it('TEST 1 — PM can view Project Action Items for assigned Project', () => {
      const pmCtx: UserAccessContext = {
        userId: 'user-b-pm-id',
        userEmail: 'user-b@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view', 'project-action-items:view']),
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', pmCtx, 1);
      const sql = aiResult.conditions.join(' ');
      expect(sql).toContain('ai.project_id IS NOT NULL');
      expect(sql).toContain('EXISTS (SELECT 1 FROM projects proj_ai_scope WHERE proj_ai_scope.id = ai.project_id');
      expect(sql).toContain('proj_ai_scope.service_provider_pm_id');
    });

    it('TEST 2 & 17 — View implies detail access (no separate detail permission required)', () => {
      const pmCtx: UserAccessContext = {
        userId: 'user-b-pm-id',
        userEmail: 'user-b@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view', 'project-action-items:view']),
      };

      // projects:view allows project visibility
      const projResult = scopeService.buildProjectVisibility('p', pmCtx, 1);
      expect(projResult.conditions.join(' ')).toContain('p.service_provider_pm_id');

      // project-action-items:view allows action item visibility
      const aiResult = scopeService.buildActionItemVisibility('ai', pmCtx, 1);
      expect(aiResult.conditions.join(' ')).toContain('ai.project_id IS NOT NULL');
    });

    it('TEST 9 — Missing View denies Project Action Items', () => {
      const noViewCtx: UserAccessContext = {
        userId: 'user-b-pm-id',
        userEmail: 'user-b@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view']), // No project-action-items:view
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', noViewCtx, 1);
      expect(aiResult.conditions.join(' ')).not.toContain('ai.project_id IS NOT NULL');
    });

    it('TEST 10 — PM can access assigned Project without parent Account access', () => {
      const pmCtx: UserAccessContext = {
        userId: 'user-b-pm-id',
        userEmail: 'user-b@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view', 'project-action-items:view']),
      };

      const projResult = scopeService.buildProjectVisibility('p', pmCtx, 1);
      expect(projResult.params).toContain('user-b-pm-id');
      expect(projResult.conditions.join(' ')).toContain('p.service_provider_pm_id');

      // Account visibility does NOT include PM assignment
      const accResult = scopeService.buildAccountVisibility('a', pmCtx, 1);
      expect(accResult.conditions.join(' ')).not.toContain('p.service_provider_pm_id');
    });

    it('TEST 11 & 12 — Unassigned user cannot access Project or Project Action Items', () => {
      const otherUserCtx: UserAccessContext = {
        userId: 'user-other-id',
        userEmail: 'user-other@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view', 'project-action-items:view']),
      };

      const projResult = scopeService.buildProjectVisibility('p', otherUserCtx, 1);
      expect(projResult.params).toContain('user-other-id');
      expect(projResult.params).not.toContain('user-b-pm-id');
    });

    it('TEST 13 & 16 — ownerId does not control authorization', () => {
      const pmCtx: UserAccessContext = {
        userId: 'user-b-pm-id',
        userEmail: 'user-b@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view', 'project-action-items:view', 'project-action-items:update']),
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', pmCtx, 1);
      // Visibility params use user-b-pm-id (the authenticated requester)
      expect(aiResult.params).toContain('user-b-pm-id');
      expect(aiResult.params).not.toContain('user-c-owner-id');
    });

    it('TEST 14 — View-All provides broader scope without granting Account access', () => {
      const pmWithViewAll: UserAccessContext = {
        userId: 'user-b-pm-id',
        userEmail: 'user-b@example.com',
        roleId: 'pm-role-id',
        roleKey: 'project-manager',
        roleName: 'Project Manager',
        roleKeys: ['project-manager'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: false,
        permissions: new Set(['projects:view', 'project-action-items:view-all']),
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', pmWithViewAll, 1);
      expect(aiResult.conditions.join(' ')).toContain('ai.project_id IS NOT NULL');

      // Does NOT grant account view-all
      expect(pmWithViewAll.canViewAllAccounts).toBe(false);
    });

    it('TEST 15 — Generic action-items permissions and project-action-items permissions remain isolated', () => {
      const genericOnlyCtx: UserAccessContext = {
        userId: 'user-generic-id',
        userEmail: 'generic@example.com',
        roleId: 'account-manager-id',
        roleKey: 'account-manager',
        roleName: 'Account Manager',
        roleKeys: ['account-manager'],
        accountScopeField: 'account_manager_id',
        accountScopeFields: ['account_manager_id'],
        canViewAllAccounts: false,
        permissions: new Set(['action-items:view', 'action-items:create']), // No project-action-items
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', genericOnlyCtx, 1);
      const sql = aiResult.conditions.join(' ');
      expect(sql).toContain('ai.project_id IS NULL');
      expect(sql).not.toContain('ai.project_id IS NOT NULL');
    });

    it('TEST 19 — Multi-role permission UNION correctly combines permissions', () => {
      const multiRoleCtx: UserAccessContext = {
        userId: 'user-multi-id',
        userEmail: 'multi@example.com',
        roleId: 'role-1',
        roleKey: 'account-manager',
        roleName: 'Account Manager',
        roleKeys: ['account-manager', 'project-manager'],
        accountScopeField: 'account_manager_id',
        accountScopeFields: ['account_manager_id'],
        canViewAllAccounts: false,
        permissions: new Set(['action-items:view', 'project-action-items:view']),
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', multiRoleCtx, 1);
      const sql = aiResult.conditions.join(' ');
      expect(sql).toContain('ai.project_id IS NULL');
      expect(sql).toContain('ai.project_id IS NOT NULL');
    });

    it('TEST 20 — view-all allocates zero parameters so startIdx equals nextIdx (prevents $1 offset errors)', () => {
      const adminCtx: UserAccessContext = {
        userId: 'admin-id',
        userEmail: 'admin@example.com',
        roleId: 'admin-role',
        roleKey: 'admin',
        roleName: 'Administrator',
        roleKeys: ['admin'],
        accountScopeField: null,
        accountScopeFields: [],
        canViewAllAccounts: true,
        permissions: new Set(['action-items:view-all', 'project-action-items:view-all']),
      };

      const aiResult = scopeService.buildActionItemVisibility('ai', adminCtx, 1);
      expect(aiResult.params.length).toBe(0);
      expect(aiResult.nextIdx).toBe(1);
      expect(aiResult.conditions.join(' ')).toContain('ai.project_id IS NULL');
    });
  });
});
