import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { PermissionsService } from '../../rbac/permissions.service';
import { AccessScopeService } from '../../rbac/access-scope.service';
import { TtlCacheService } from '../../../common/services/ttl-cache.service';
import { StakeholderConnectsController } from '../stakeholder-connects.controller';
import { StakeholderConnectsService } from '../stakeholder-connects.service';
import type { JwtPayload } from '../../auth/auth-user.decorator';

interface TestRole {
  id: string;
  key: string;
  name: string;
  account_scope_field: string | null;
}

interface TestAccount {
  id: string;
  name: string;
  account_manager_id: string | null;
  practice_lead_id: string | null;
  client_partner_id: string | null;
  vertical_head_id: string | null;
  owner_id: string;
  is_deleted: boolean;
}

interface TestConnect {
  id: string;
  account_id: string;
  owner_id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  status: string;
  mom_notes: string | null;
  cancellation_reason: string | null;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TestDraft {
  id: string;
  connect_id: string;
  title: string;
  description: string | null;
  suggested_owner_id: string | null;
  suggested_due_date: string | null;
  suggested_priority: string | null;
  converted_at: string | null;
  converted_action_item_id: string | null;
}

interface TestStakeholder {
  id: string;
  name: string;
  email: string;
  designation: string;
  account_id: string | null;
  stakeholder_type: 'CLIENT' | 'SERVICE_PROVIDER';
  is_deleted: boolean;
}

interface TestActionItem {
  id: string;
  action_item_number: string;
  title: string;
  account_id: string;
  status: string;
  priority: string;
  due_date: string;
  open_date: string;
  owner: string;
  owner_stakeholder_id: string | null;
  is_deleted: boolean;
}

/**
 * Stateful in-memory DB simulator backing real PermissionsService, AccessScopeService,
 * PermissionsGuard, StakeholderConnectsController, and StakeholderConnectsService.
 * Evaluates generated SQL scoping clauses so account-scoping SQL bugs fail loudly.
 */
class InMemoryRbacDb {
  roles: TestRole[] = [
    { id: 'role-admin', key: 'admin', name: 'Admin', account_scope_field: null },
    { id: 'role-am', key: 'account-manager', name: 'Account Manager', account_scope_field: 'account_manager_id' },
    { id: 'role-vh', key: 'vertical-head', name: 'Vertical Head', account_scope_field: 'vertical_head_id' },
    { id: 'role-pl', key: 'practice-lead', name: 'Practice Lead', account_scope_field: 'practice_lead_id' },
    { id: 'role-cp', key: 'client-partner', name: 'Client Partner', account_scope_field: 'client_partner_id' },
    { id: 'role-pm', key: 'project-manager', name: 'Project Manager', account_scope_field: null },
    { id: 'role-sales', key: 'sales', name: 'Sales', account_scope_field: null },
    { id: 'role-finance', key: 'finance', name: 'Finance', account_scope_field: null },
  ];

  // Reflects migrations 046 + 053 + 062 + 113 + 114
  rolePermissions: Array<{ role_id: string; module_key: string; permission_key: string }> = [
    // Admin: all permissions
    ...[
      ['accounts', 'view'], ['accounts', 'view-all'],
      ['stakeholder-connects', 'view'], ['stakeholder-connects', 'view-all'],
      ['stakeholder-connects', 'create'], ['stakeholder-connects', 'update'], ['stakeholder-connects', 'delete'],
      ['action-items', 'create'],
    ].map(([m, p]) => ({ role_id: 'role-admin', module_key: m, permission_key: p })),

    // Account Manager AFTER migration 114: view-all on stakeholder-connects is FALSE (omitted)
    ...[
      ['accounts', 'view'],
      ['stakeholder-connects', 'view'],
      ['stakeholder-connects', 'create'], ['stakeholder-connects', 'update'], ['stakeholder-connects', 'delete'],
      ['action-items', 'create'],
    ].map(([m, p]) => ({ role_id: 'role-am', module_key: m, permission_key: p })),

    // Vertical Head, Practice Lead, Client Partner: scoped view only
    ...(['role-vh', 'role-pl', 'role-cp'] as const).flatMap((r) => [
      { role_id: r, module_key: 'accounts', permission_key: 'view' },
      { role_id: r, module_key: 'stakeholder-connects', permission_key: 'view' },
    ]),

    // Project Manager: view only on stakeholders/connects (no accounts:view-all, no connect view-all)
    { role_id: 'role-pm', module_key: 'stakeholder-connects', permission_key: 'view' },

    // Sales & Finance: accounts:view-all + stakeholder-connects:view (read-only on connects)
    ...(['role-sales', 'role-finance'] as const).flatMap((r) => [
      { role_id: r, module_key: 'accounts', permission_key: 'view' },
      { role_id: r, module_key: 'accounts', permission_key: 'view-all' },
      { role_id: r, module_key: 'stakeholder-connects', permission_key: 'view' },
    ]),
  ];

  users: Array<{ id: string; email: string; name: string; role_id: string }> = [
    { id: 'u-am-a', email: 'ama@acme.test', name: 'Manager A', role_id: 'role-am' },
    { id: 'u-am-b', email: 'amb@acme.test', name: 'Manager B', role_id: 'role-am' },
    { id: 'u-admin', email: 'admin@acme.test', name: 'Admin User', role_id: 'role-admin' },
    { id: 'u-sales', email: 'sales@acme.test', name: 'Sales User', role_id: 'role-sales' },
    { id: 'u-finance', email: 'fin@acme.test', name: 'Finance User', role_id: 'role-finance' },
    { id: 'u-vh', email: 'vh@acme.test', name: 'Vertical Head', role_id: 'role-vh' },
    { id: 'u-pl', email: 'pl@acme.test', name: 'Practice Lead', role_id: 'role-pl' },
    { id: 'u-cp', email: 'cp@acme.test', name: 'Client Partner', role_id: 'role-cp' },
    { id: 'u-multi-am-pl', email: 'ampl@acme.test', name: 'AM+PL Multi', role_id: 'role-am' },
    { id: 'u-multi-am-pm', email: 'ampm@acme.test', name: 'AM+PM Multi', role_id: 'role-am' },
    { id: 'u-multi-am-admin', email: 'amadmin@acme.test', name: 'AM+Admin Multi', role_id: 'role-am' },
    { id: 'u-am-no-ai', email: 'noai@acme.test', name: 'AM No AI Perm', role_id: 'role-am' },
    { id: 'u-no-view', email: 'noview@acme.test', name: 'No View Perm', role_id: 'role-pm' },
  ];

  userRoles: Array<{ user_id: string; role_id: string }> = [
    { user_id: 'u-am-a', role_id: 'role-am' },
    { user_id: 'u-am-b', role_id: 'role-am' },
    { user_id: 'u-admin', role_id: 'role-admin' },
    { user_id: 'u-sales', role_id: 'role-sales' },
    { user_id: 'u-finance', role_id: 'role-finance' },
    { user_id: 'u-vh', role_id: 'role-vh' },
    { user_id: 'u-pl', role_id: 'role-pl' },
    { user_id: 'u-cp', role_id: 'role-cp' },
    { user_id: 'u-multi-am-pl', role_id: 'role-am' },
    { user_id: 'u-multi-am-pl', role_id: 'role-pl' },
    { user_id: 'u-multi-am-pm', role_id: 'role-am' },
    { user_id: 'u-multi-am-pm', role_id: 'role-pm' },
    { user_id: 'u-multi-am-admin', role_id: 'role-am' },
    { user_id: 'u-multi-am-admin', role_id: 'role-admin' },
    { user_id: 'u-am-no-ai', role_id: 'role-am' },
    { user_id: 'u-no-view', role_id: 'role-pm' },
  ];

  // Role overrides per user for negative permission tests (e.g., u-no-view, u-am-no-ai)
  deniedPermsByUser = new Map<string, Set<string>>([
    ['u-no-view', new Set(['stakeholder-connects:view'])],
    ['u-am-no-ai', new Set(['action-items:create'])],
  ]);

  accounts: TestAccount[] = [
    {
      id: 'acc-x',
      name: 'Account X',
      account_manager_id: 'u-am-a',
      practice_lead_id: 'u-pl',
      client_partner_id: 'u-cp',
      vertical_head_id: 'u-vh',
      owner_id: 'u-am-a',
      is_deleted: false,
    },
    {
      id: 'acc-y',
      name: 'Account Y',
      account_manager_id: null,
      practice_lead_id: 'u-multi-am-pl',
      client_partner_id: null,
      vertical_head_id: null,
      owner_id: 'u-am-a', // owned via owner_id for Manager A & practice_lead_id for AM+PL
      is_deleted: false,
    },
    {
      id: 'acc-z',
      name: 'Account Z',
      account_manager_id: 'u-am-b',
      practice_lead_id: null,
      client_partner_id: null,
      vertical_head_id: null,
      owner_id: 'u-am-b',
      is_deleted: false,
    },
    {
      id: 'acc-z-del',
      name: 'Account Z Deleted',
      account_manager_id: 'u-am-b',
      practice_lead_id: null,
      client_partner_id: null,
      vertical_head_id: null,
      owner_id: 'u-am-b',
      is_deleted: true,
    },
  ];

  stakeholders: TestStakeholder[] = [
    { id: 'stk-x-1', name: 'X Client', email: 'xc@x.test', designation: 'VP', account_id: 'acc-x', stakeholder_type: 'CLIENT', is_deleted: false },
    { id: 'stk-y-1', name: 'Y Client', email: 'yc@y.test', designation: 'VP', account_id: 'acc-y', stakeholder_type: 'CLIENT', is_deleted: false },
    { id: 'stk-z-1', name: 'Z Client', email: 'zc@z.test', designation: 'VP', account_id: 'acc-z', stakeholder_type: 'CLIENT', is_deleted: false },
    { id: 'stk-null-client', name: 'Orphan Client', email: 'oc@null.test', designation: 'VP', account_id: null, stakeholder_type: 'CLIENT', is_deleted: false },
    { id: 'stk-sp-global', name: 'Global SP', email: 'sp@acme.test', designation: 'Architect', account_id: null, stakeholder_type: 'SERVICE_PROVIDER', is_deleted: false },
  ];

  connects: TestConnect[] = [
    {
      id: 'conn-x', account_id: 'acc-x', owner_id: 'u-am-a', title: 'X Quarterly Sync',
      meeting_date: '2025-10-01', meeting_time: '10:00:00', status: 'Scheduled',
      mom_notes: 'Confidential X MoM', cancellation_reason: null, is_deleted: false,
      created_by: 'u-am-a', created_at: '2025-09-20T00:00:00Z', updated_at: '2025-09-20T00:00:00Z',
    },
    {
      id: 'conn-y', account_id: 'acc-y', owner_id: 'u-am-a', title: 'Y Strategy Sync',
      meeting_date: '2025-10-02', meeting_time: '11:00:00', status: 'Completed',
      mom_notes: 'Confidential Y MoM', cancellation_reason: null, is_deleted: false,
      created_by: 'u-am-a', created_at: '2025-09-21T00:00:00Z', updated_at: '2025-09-21T00:00:00Z',
    },
    {
      id: 'conn-y-del', account_id: 'acc-y', owner_id: 'u-am-a', title: 'Y Deleted Sync',
      meeting_date: '2025-09-15', meeting_time: '09:00:00', status: 'Scheduled',
      mom_notes: null, cancellation_reason: null, is_deleted: true,
      created_by: 'u-am-a', created_at: '2025-09-10T00:00:00Z', updated_at: '2025-09-10T00:00:00Z',
    },
    {
      id: 'conn-z', account_id: 'acc-z', owner_id: 'u-am-b', title: 'Z Secret Board Sync',
      meeting_date: '2025-10-05', meeting_time: '14:00:00', status: 'Scheduled',
      mom_notes: 'Top secret Z pricing MoM', cancellation_reason: null, is_deleted: false,
      created_by: 'u-am-b', created_at: '2025-09-25T00:00:00Z', updated_at: '2025-09-25T00:00:00Z',
    },
    {
      id: 'conn-z-del', account_id: 'acc-z', owner_id: 'u-am-b', title: 'Z Deleted Sync',
      meeting_date: '2025-09-18', meeting_time: '15:00:00', status: 'Scheduled',
      mom_notes: 'Deleted Z MoM', cancellation_reason: null, is_deleted: true,
      created_by: 'u-am-b', created_at: '2025-09-12T00:00:00Z', updated_at: '2025-09-12T00:00:00Z',
    },
    {
      id: 'conn-z-parent-del', account_id: 'acc-z-del', owner_id: 'u-am-b', title: 'Z Deleted Parent Sync',
      meeting_date: '2025-09-19', meeting_time: '16:00:00', status: 'Scheduled',
      mom_notes: null, cancellation_reason: null, is_deleted: true,
      created_by: 'u-am-b', created_at: '2025-09-13T00:00:00Z', updated_at: '2025-09-13T00:00:00Z',
    },
  ];

  attendees: Array<{ connect_id: string; stakeholder_id: string }> = [
    { connect_id: 'conn-x', stakeholder_id: 'stk-x-1' },
    { connect_id: 'conn-y', stakeholder_id: 'stk-y-1' },
    { connect_id: 'conn-z', stakeholder_id: 'stk-z-1' },
  ];

  drafts: TestDraft[] = [
    {
      id: 'draft-x-1', connect_id: 'conn-x', title: 'Follow up X', description: 'Desc X',
      suggested_owner_id: 'stk-x-1', suggested_due_date: null, suggested_priority: null,
      converted_at: null, converted_action_item_id: null,
    },
    {
      id: 'draft-z-1', connect_id: 'conn-z', title: 'Secret Draft Z', description: 'Secret Z',
      suggested_owner_id: 'stk-z-1', suggested_due_date: null, suggested_priority: null,
      converted_at: null, converted_action_item_id: null,
    },
    {
      id: 'draft-z-conv', connect_id: 'conn-z', title: 'Converted Draft Z', description: 'Already converted',
      suggested_owner_id: 'stk-z-1', suggested_due_date: null, suggested_priority: null,
      converted_at: '2025-10-06T00:00:00Z', converted_action_item_id: 'ai-z-1',
    },
  ];

  actionItems: TestActionItem[] = [
    { id: 'ai-x-1', action_item_number: 'X-0001', title: 'AI X', account_id: 'acc-x', status: 'To Do', priority: 'High', due_date: '2026-12-01', open_date: '2025-10-01', owner: 'X Client', owner_stakeholder_id: 'stk-x-1', is_deleted: false },
    { id: 'ai-z-1', action_item_number: 'Z-0001', title: 'AI Z', account_id: 'acc-z', status: 'To Do', priority: 'High', due_date: '2026-12-01', open_date: '2025-10-01', owner: 'Z Client', owner_stakeholder_id: 'stk-z-1', is_deleted: false },
  ];

  linkedActionItems: Array<{ connect_id: string; action_item_id: string }> = [
    { connect_id: 'conn-z', action_item_id: 'ai-z-1' },
  ];

  private seq = 1;

  /**
   * Evaluates the SQL scope fragment emitted by AccessScopeService.buildAccountVisibility /
   * buildChildVisibility so tests genuinely verify the generated SQL clauses.
   */
  private matchesAccountScope(account: TestAccount, sql: string, params: any[]): boolean {
    if (account.is_deleted) return false;

    const checkPair = (col: string, val: string): boolean => {
      if (col === 'account_manager_id') return account.account_manager_id === val;
      if (col === 'practice_lead_id') return account.practice_lead_id === val;
      if (col === 'client_partner_id') return account.client_partner_id === val;
      if (col === 'vertical_head_id') return account.vertical_head_id === val;
      if (col === 'owner_id') return account.owner_id === val;
      return false;
    };

    const matches = [...sql.matchAll(/(?:acc_scope|a)\.(account_manager_id|practice_lead_id|client_partner_id|vertical_head_id|owner_id)\s*=\s*\$(\d+)/g)];
    if (matches.length === 0) return true; // view-all query has no scope conditions
    return matches.some((m) => {
      const col = m[1];
      const idx = Number(m[2]) - 1;
      return checkPair(col, params[idx]);
    });
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    // 1. PermissionsService.getUserAccessContext
    if (sql.includes('FROM users u') && sql.includes('LEFT JOIN roles r')) {
      const u = this.users.find((x) => x.id === params[0]);
      if (!u) return { rows: [] };
      const r = this.roles.find((x) => x.id === u.role_id)!;
      return {
        rows: [{ role_id: r.id, email: u.email, role_key: r.key, role_name: r.name, account_scope_field: r.account_scope_field }],
      };
    }

    if (sql.includes('FROM user_roles ur')) {
      const uid = params[0];
      const assigned = this.userRoles
        .filter((ur) => ur.user_id === uid)
        .map((ur) => this.roles.find((r) => r.id === ur.role_id)!)
        .filter(Boolean);
      return { rows: assigned };
    }

    if (sql.includes('FROM role_permissions') && sql.includes('role_id = ANY($1)')) {
      const roleIds: string[] = params[0] || [];
      const u = this.users.find((user) =>
        this.userRoles.filter((ur) => ur.user_id === user.id).every((ur) => roleIds.includes(ur.role_id)) &&
        this.userRoles.some((ur) => ur.user_id === user.id && roleIds.includes(ur.role_id)) &&
        roleIds.length === this.userRoles.filter((ur) => ur.user_id === user.id).length,
      );
      const denied = u ? this.deniedPermsByUser.get(u.id) : undefined;
      const rows = this.rolePermissions
        .filter((rp) => roleIds.includes(rp.role_id))
        .filter((rp) => !denied?.has(`${rp.module_key}:${rp.permission_key}`));
      return { rows };
    }

    // 2. assertAccountAccess
    if (sql.includes('SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE')) {
      const acc = this.accounts.find((a) => a.id === params[0]);
      if (!acc || !this.matchesAccountScope(acc, sql, params)) {
        return { rows: [] };
      }
      return { rows: [{ id: acc.id }] };
    }

    // 3. findAll / findAllDeactivated
    if (
      sql.includes('FROM stakeholder_connects sc') &&
      sql.includes('JOIN accounts a') &&
      sql.includes('JOIN users u') &&
      !sql.includes('WHERE sc.id = $1')
    ) {
      const isDeactivatedQuery = sql.includes('sc.is_deleted = TRUE');
      const onlyActive = sql.includes('sc.is_deleted = FALSE');
      const activeAccountRequired = sql.includes('JOIN accounts a ON a.id = sc.account_id AND a.is_deleted = FALSE');

      // Check optional sc.account_id = $N filter
      const accFilterMatch = sql.match(/sc\.account_id = \$(\d+)/);
      const accountIdFilter = accFilterMatch ? params[Number(accFilterMatch[1]) - 1] : null;

      let rows = this.connects.filter((sc) => {
        if (isDeactivatedQuery && !sc.is_deleted) return false;
        if (onlyActive && sc.is_deleted) return false;
        const acc = this.accounts.find((a) => a.id === sc.account_id);
        if (!acc) return false;
        if (activeAccountRequired && acc.is_deleted) return false;
        if (accountIdFilter && sc.account_id !== accountIdFilter) return false;
        if (sql.includes('acc_scope')) {
          return this.matchesAccountScope(acc, sql, params);
        }
        return true;
      });

      const hasLimit = sql.includes('LIMIT');
      const total = rows.length;
      if (hasLimit) {
        const limitMatch = sql.match(/LIMIT \$(\d+) OFFSET \$(\d+)/);
        if (limitMatch) {
          const limit = params[Number(limitMatch[1]) - 1];
          const offset = params[Number(limitMatch[2]) - 1];
          rows = rows.slice(offset, offset + limit);
        }
      }

      return {
        rows: rows.map((sc) => {
          const acc = this.accounts.find((a) => a.id === sc.account_id)!;
          const u = this.users.find((x) => x.id === sc.owner_id);
          return {
            id: sc.id,
            accountId: sc.account_id,
            accountName: acc.name,
            accountDeleted: acc.is_deleted,
            ownerId: sc.owner_id,
            ownerName: u?.name || 'Owner',
            ownerEmail: u?.email || '',
            title: sc.title,
            meetingDate: sc.meeting_date,
            meetingTime: sc.meeting_time,
            status: sc.status,
            momNotes: sc.mom_notes,
            mom: sc.mom_notes,
            cancellationReason: sc.cancellation_reason,
            isDeleted: sc.is_deleted,
            createdBy: sc.created_by,
            createdAt: sc.created_at,
            updatedAt: sc.updated_at,
            attendees: this.attendees
              .filter((att) => att.connect_id === sc.id)
              .map((att) => this.stakeholders.find((s) => s.id === att.stakeholder_id)!)
              .filter(Boolean)
              .map((s) => ({ id: s.id, name: s.name, email: s.email, designation: s.designation, stakeholderType: s.stakeholder_type })),
            draftFollowUps: this.drafts.filter((d) => d.connect_id === sc.id),
            ...(sql.includes('__total') ? { __total: total } : {}),
          };
        }),
      };
    }

    // 4. findOne by sc.id = $1
    if (sql.includes('FROM stakeholder_connects sc') && sql.includes('WHERE sc.id = $1') && !sql.includes('a.is_deleted AS "accountDeleted"')) {
      const sc = this.connects.find((c) => c.id === params[0]);
      if (!sc) return { rows: [] };
      const acc = this.accounts.find((a) => a.id === sc.account_id)!;
      const u = this.users.find((x) => x.id === sc.owner_id);
      return {
        rows: [{
          id: sc.id,
          accountId: sc.account_id,
          accountName: acc.name,
          ownerId: sc.owner_id,
          ownerName: u?.name || 'Owner',
          ownerEmail: u?.email || '',
          title: sc.title,
          meetingDate: sc.meeting_date,
          meetingTime: sc.meeting_time,
          status: sc.status,
          momNotes: sc.mom_notes,
          mom: sc.mom_notes,
          cancellationReason: sc.cancellation_reason,
          isDeleted: sc.is_deleted,
          createdBy: sc.created_by,
          createdAt: sc.created_at,
          updatedAt: sc.updated_at,
        }],
      };
    }

    // 5. restore lookup (includes isDeleted and accountDeleted)
    if (sql.includes('FROM stakeholder_connects sc') && sql.includes('a.is_deleted AS "accountDeleted"')) {
      const sc = this.connects.find((c) => c.id === params[0]);
      if (!sc) return { rows: [] };
      const acc = this.accounts.find((a) => a.id === sc.account_id)!;
      return {
        rows: [{
          id: sc.id,
          accountId: sc.account_id,
          title: sc.title,
          isDeleted: sc.is_deleted,
          accountDeleted: acc.is_deleted,
        }],
      };
    }

    // 6. Transaction SELECTs on stakeholder_connects
    if (sql.includes('FROM stakeholder_connects') && sql.includes('WHERE id = $1')) {
      const sc = this.connects.find((c) => c.id === params[0]);
      if (!sc) return { rows: [] };
      return {
        rows: [{
          id: sc.id,
          accountId: sc.account_id,
          account_id: sc.account_id,
          ownerId: sc.owner_id,
          title: sc.title,
          meetingDate: sc.meeting_date,
          meeting_date: sc.meeting_date,
          meetingTime: sc.meeting_time,
          status: sc.status,
          momNotes: sc.mom_notes,
          cancellationReason: sc.cancellation_reason,
          isDeleted: sc.is_deleted,
          is_deleted: sc.is_deleted,
        }],
      };
    }

    // 7. Attendees / Drafts / ActionItems / History subqueries in findOne & mutations
    if (sql.includes('FROM stakeholder_connect_attendees sca')) {
      return {
        rows: this.attendees
          .filter((a) => a.connect_id === params[0])
          .map((a) => {
            const s = this.stakeholders.find((st) => st.id === a.stakeholder_id)!;
            return {
              id: s.id,
              stakeholder_id: s.id,
              name: s.name,
              email: s.email,
              designation: s.designation,
              stakeholderType: s.stakeholder_type,
              stakeholder_type: s.stakeholder_type,
              account_id: s.account_id,
              is_deleted: s.is_deleted,
            };
          }),
      };
    }

    if (sql.includes('FROM stakeholder_connect_draft_follow_ups') && sql.includes('WHERE id = $1 AND connect_id = $2')) {
      const d = this.drafts.find((x) => x.id === params[0] && x.connect_id === params[1]);
      return { rows: d ? [d] : [] };
    }

    if (sql.includes('FROM stakeholder_connect_draft_follow_ups d')) {
      const filtered = sql.includes('WHERE d.id = $1')
        ? this.drafts.filter((d) => d.id === params[0])
        : this.drafts.filter((d) => d.connect_id === params[0]);
      return {
        rows: filtered.map((d) => {
          const stk = d.suggested_owner_id ? this.stakeholders.find((s) => s.id === d.suggested_owner_id) : null;
          const ai = d.converted_action_item_id ? this.actionItems.find((a) => a.id === d.converted_action_item_id) : null;
          return {
            id: d.id,
            connectId: d.connect_id,
            title: d.title,
            description: d.description,
            suggestedOwnerId: d.suggested_owner_id,
            suggestedOwnerName: stk?.name ?? null,
            suggestedDueDate: d.suggested_due_date ?? null,
            suggestedPriority: d.suggested_priority ?? null,
            convertedAt: d.converted_at,
            convertedActionItemId: d.converted_action_item_id,
            actionItemNumber: ai?.action_item_number ?? null,
          };
        }),
      };
    }

    if (sql.includes('FROM stakeholder_connect_action_items scai') && sql.includes('WHERE scai.connect_id = $1')) {
      return {
        rows: this.linkedActionItems
          .filter((l) => l.connect_id === params[0])
          .map((l) => this.actionItems.find((x) => x.id === l.action_item_id && !x.is_deleted))
          .filter((ai): ai is TestActionItem => Boolean(ai))
          .map((ai) => ({ id: ai.id, actionItemId: ai.id, actionItemNumber: ai.action_item_number, title: ai.title })),
      };
    }

    if (sql.includes('SELECT 1 FROM stakeholder_connect_action_items')) {
      const exists = this.linkedActionItems.some((l) => l.connect_id === params[0] && l.action_item_id === params[1]);
      return { rows: exists ? [{ '?column?': 1 }] : [] };
    }

    if (sql.includes('FROM users WHERE id = $1')) {
      const u = this.users.find((x) => x.id === params[0]);
      return { rows: u ? [{ id: u.id, name: u.name }] : [] };
    }

    if (sql.includes('FROM stakeholders WHERE id = $1')) {
      const s = this.stakeholders.find((x) => x.id === params[0]);
      if (!s) return { rows: [] };
      if (sql.includes('is_deleted = FALSE') && s.is_deleted) return { rows: [] };
      return { rows: [s] };
    }

    if (sql.includes('FROM action_items WHERE id = $1')) {
      const ai = this.actionItems.find((x) => x.id === params[0]);
      return { rows: ai ? [ai] : [] };
    }

    // 8. Writes
    if (sql.startsWith('INSERT INTO stakeholder_connects')) {
      const id = `conn-new-${this.seq++}`;
      this.connects.push({
        id,
        account_id: params[0],
        owner_id: params[1],
        title: params[2],
        meeting_date: params[3],
        meeting_time: params[4],
        status: params[5],
        mom_notes: params[6],
        cancellation_reason: null,
        is_deleted: false,
        created_by: params[7],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { rows: [{ id }] };
    }

    if (sql.startsWith('INSERT INTO stakeholder_connect_attendees')) {
      if (!this.attendees.some((a) => a.connect_id === params[0] && a.stakeholder_id === params[1])) {
        this.attendees.push({ connect_id: params[0], stakeholder_id: params[1] });
      }
      return { rows: [] };
    }

    if (sql.startsWith('DELETE FROM stakeholder_connect_attendees')) {
      this.attendees = this.attendees.filter((a) => !(a.connect_id === params[0] && a.stakeholder_id === params[1]));
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET is_deleted = TRUE')) {
      const sc = this.connects.find((c) => c.id === params[1]);
      if (sc) sc.is_deleted = true;
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET is_deleted = FALSE')) {
      const sc = this.connects.find((c) => c.id === params[1]);
      if (sc) sc.is_deleted = false;
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET status = \'Completed\'')) {
      const sc = this.connects.find((c) => c.id === params[1]);
      if (sc) sc.status = 'Completed';
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET status = \'Cancelled\'')) {
      const sc = this.connects.find((c) => c.id === params[2]);
      if (sc) {
        sc.status = 'Cancelled';
        sc.cancellation_reason = params[0];
      }
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET meeting_date = $1')) {
      const sc = this.connects.find((c) => c.id === params[3]);
      if (sc) {
        sc.meeting_date = params[0];
        sc.meeting_time = params[1];
        sc.status = 'Rescheduled';
      }
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET title = $1')) {
      const sc = this.connects.find((c) => c.id === params[8]);
      if (sc) {
        sc.title = params[0];
        sc.owner_id = params[1];
        sc.meeting_date = params[2];
        sc.meeting_time = params[3];
        sc.status = params[4];
        sc.mom_notes = params[5];
        sc.cancellation_reason = params[6];
      }
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO stakeholder_connect_draft_follow_ups')) {
      const draft: TestDraft = {
        id: `draft-new-${this.seq++}`,
        connect_id: params[0],
        title: params[1],
        description: params[2],
        suggested_owner_id: params[3],
        suggested_due_date: params[4] ?? null,
        suggested_priority: params[5] ?? null,
        converted_at: null,
        converted_action_item_id: null,
      };
      this.drafts.push(draft);
      return { rows: [draft] };
    }

    if (sql.startsWith('UPDATE stakeholder_connect_draft_follow_ups') && sql.includes('SET title = $1')) {
      const d = this.drafts.find((x) => x.id === params[5]);
      if (d) {
        d.title = params[0];
        d.description = params[1];
        d.suggested_owner_id = params[2];
        d.suggested_due_date = params[3] ?? null;
        d.suggested_priority = params[4] ?? null;
      }
      return { rows: d ? [d] : [] };
    }

    if (sql.startsWith('UPDATE stakeholder_connect_draft_follow_ups') && sql.includes('SET converted_at = NOW()')) {
      const d = this.drafts.find((x) => x.id === params[1]);
      if (d) {
        d.converted_at = new Date().toISOString();
        d.converted_action_item_id = params[0];
      }
      return { rows: d ? [d] : [] };
    }

    if (sql.startsWith('DELETE FROM stakeholder_connect_draft_follow_ups')) {
      this.drafts = this.drafts.filter((d) => !(d.id === params[0] && d.connect_id === params[1]));
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO stakeholder_connect_action_items')) {
      if (!this.linkedActionItems.some((l) => l.connect_id === params[0] && l.action_item_id === params[1])) {
        this.linkedActionItems.push({ connect_id: params[0], action_item_id: params[1] });
      }
      return { rows: [] };
    }

    if (sql.startsWith('DELETE FROM stakeholder_connect_action_items')) {
      this.linkedActionItems = this.linkedActionItems.filter((l) => !(l.connect_id === params[0] && l.action_item_id === params[1]));
      return { rows: [] };
    }

    return { rows: [] };
  }

  async withTransaction<T>(fn: (client: any, tx?: { afterCommit: (cb: () => void | Promise<void>) => void }) => Promise<T>): Promise<T> {
    const hooks: Array<() => void | Promise<void>> = [];
    const result = await fn(this, { afterCommit: (cb) => hooks.push(cb) });
    for (const hook of hooks) {
      await hook();
    }
    return result;
  }
}

describe('Stakeholder Connects Account-Level RBAC & BOLA Regression Suite', () => {
  let db: InMemoryRbacDb;
  let permissionsService: PermissionsService;
  let accessScopeService: AccessScopeService;
  let service: StakeholderConnectsService;
  let controller: StakeholderConnectsController;
  let guard: PermissionsGuard;
  let mockActionItems: any;
  let mockServiceProvider: any;

  const auth = (sub: string, name = 'Test User'): JwtPayload => ({
    sub,
    email: `${sub}@acme.test`,
    name,
    role: 'User',
    roleId: 'r',
    type: 'access',
  });

  const enforceGuard = async (methodName: keyof StakeholderConnectsController, userId: string, fn: () => Promise<any>) => {
    const handler = StakeholderConnectsController.prototype[methodName];
    const ctx: ExecutionContext = {
      getHandler: () => handler,
      getClass: () => StakeholderConnectsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: userId } }),
      }),
    } as any;
    await guard.canActivate(ctx);
    return fn();
  };

  beforeEach(() => {
    db = new InMemoryRbacDb();
    const cache = new TtlCacheService();
    permissionsService = new PermissionsService(db as any, cache);
    accessScopeService = new AccessScopeService(permissionsService);
    mockActionItems = {
      create: jest.fn<any>().mockImplementation(async (payload: any) => {
        const created = {
          id: 'ai-converted-1',
          action_item_number: 'X-0099',
          title: payload?.title || 'Converted Task',
          account_id: payload?.accountId || 'acc-x',
          status: payload?.status || 'To Do',
          priority: payload?.priority || 'High',
          due_date: payload?.dueDate || '2026-12-20',
          open_date: payload?.openDate || '2025-10-01',
          owner: 'Client',
          owner_stakeholder_id: payload?.ownerStakeholderId || null,
          is_deleted: false,
        };
        db.actionItems.push(created);
        return { id: created.id, actionItemNumber: created.action_item_number, title: created.title };
      }),
    };
    mockServiceProvider = {
      resolveOrCreate: jest.fn<any>(),
    };
    service = new StakeholderConnectsService(
      db as any,
      accessScopeService,
      permissionsService,
      mockActionItems,
      mockServiceProvider,
    );
    controller = new StakeholderConnectsController(service);
    guard = new PermissionsGuard(new Reflector(), permissionsService);
  });

  describe('Migration 114 Definition', () => {
    it('idempotently revokes stakeholder-connects:view-all from account-manager only', () => {
      const migrationPath = join(
        __dirname,
        '../../../database/migrations/121_fix_stakeholder_connects_account_manager_scope.sql',
      );
      const sql = readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain("'account-manager'");
      expect(sql).toContain("'stakeholder-connects'");
      expect(sql).toContain("'view-all'");
      expect(sql).toContain('is_allowed = FALSE');
      expect(sql).toContain('ON CONFLICT (role_id, module_key, permission_key)');
    });
  });

  describe('Account Manager A (owns X & Y) vs Account Manager B (owns Z)', () => {
    it('list & deactivated endpoints return only authorized accounts X & Y with accurate totals', async () => {
      const activeList = await enforceGuard('findAll', 'u-am-a', () =>
        controller.findAll(auth('u-am-a'), '1', '25'),
      );
      expect(activeList.total).toBe(2);
      expect(activeList.data.map((m: any) => m.id).sort()).toEqual(['conn-x', 'conn-y']);

      // Query parameter manipulation: passing Account Z's ID returns empty and 0 total
      const tamperedList = await enforceGuard('findAll', 'u-am-a', () =>
        controller.findAll(auth('u-am-a'), '1', '25', 'acc-z'),
      );
      expect(tamperedList.total).toBe(0);
      expect(tamperedList.data).toEqual([]);

      const deactivatedList = await enforceGuard('findAllDeactivated', 'u-am-a', () =>
        controller.findAllDeactivated(auth('u-am-a'), '1', '25'),
      );
      expect(deactivatedList.total).toBe(1);
      expect(deactivatedList.data.map((m: any) => m.id)).toEqual(['conn-y-del']);

      const tamperedDeactivated = await enforceGuard('findAllDeactivated', 'u-am-a', () =>
        controller.findAllDeactivated(auth('u-am-a'), '1', '25', 'acc-z'),
      );
      expect(tamperedDeactivated.total).toBe(0);
      expect(tamperedDeactivated.data).toEqual([]);
    });

    it('denies Manager A read and all write/lifecycle operations on Manager B Account Z', async () => {
      // View meeting details / MoM / attendees / drafts / action items / reschedule history
      await expect(enforceGuard('findOne', 'u-am-a', () => controller.findOne('conn-z', auth('u-am-a')))).rejects.toThrow(
        ForbiddenException,
      );

      // Create connect on Account Z
      await expect(
        enforceGuard('create', 'u-am-a', () =>
          controller.create(
            {
              accountId: 'acc-z',
              ownerId: 'u-am-a',
              title: 'Unauthorized Connect',
              meetingDate: '2026-12-10',
              meetingTime: '10:00',
              attendees: ['stk-z-1'],
            } as any,
            auth('u-am-a'),
          ),
        ),
      ).rejects.toThrow(ForbiddenException);

      // Edit connect & Edit MoM on Account Z
      await expect(
        enforceGuard('update', 'u-am-a', () =>
          controller.update('conn-z', { title: 'Tampered', momNotes: 'Tampered MoM' } as any, auth('u-am-a')),
        ),
      ).rejects.toThrow(ForbiddenException);

      // Complete / Reschedule / Cancel / Soft-delete on Account Z
      await expect(enforceGuard('complete', 'u-am-a', () => controller.complete('conn-z', auth('u-am-a')))).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        enforceGuard('reschedule', 'u-am-a', () =>
          controller.reschedule('conn-z', { newDate: '2026-12-15', newTime: '11:00', reason: 'Nope' } as any, auth('u-am-a')),
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enforceGuard('cancel', 'u-am-a', () => controller.cancel('conn-z', { reason: 'Nope' } as any, auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);
      await expect(enforceGuard('remove', 'u-am-a', () => controller.remove('conn-z', auth('u-am-a')))).rejects.toThrow(
        ForbiddenException,
      );

      // Restore on deleted Account Z meeting AND deleted parent account Z meeting (must NOT leak BadRequest parent deleted)
      await expect(enforceGuard('restore', 'u-am-a', () => controller.restore('conn-z-del', auth('u-am-a')))).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        enforceGuard('restore', 'u-am-a', () => controller.restore('conn-z-parent-del', auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);

      // Add / Remove attendee on Account Z
      await expect(
        enforceGuard('addAttendee', 'u-am-a', () => controller.addAttendee('conn-z', 'stk-z-1', auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enforceGuard('removeAttendee', 'u-am-a', () => controller.removeAttendee('conn-z', 'stk-z-1', auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);

      // Drafts CRUD on Account Z
      await expect(
        enforceGuard('createDraft', 'u-am-a', () => controller.createDraft('conn-z', { title: 'Hijack' } as any, auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enforceGuard('updateDraft', 'u-am-a', () =>
          controller.updateDraft('conn-z', 'draft-z-1', { title: 'Hijack' } as any, auth('u-am-a')),
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enforceGuard('deleteDraft', 'u-am-a', () => controller.deleteDraft('conn-z', 'draft-z-1', auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);

      // Convert draft on Account Z — both unconverted and already-converted must return Forbidden (no 409 state oracle)
      await expect(
        enforceGuard('convertDraft', 'u-am-a', () =>
          controller.convertDraft(
            'conn-z',
            'draft-z-1',
            { ownerStakeholderId: 'stk-z-1', dueDate: '2026-12-20', priority: 'High' } as any,
            auth('u-am-a'),
          ),
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enforceGuard('convertDraft', 'u-am-a', () =>
          controller.convertDraft(
            'conn-z',
            'draft-z-conv',
            { ownerStakeholderId: 'stk-z-1', dueDate: '2026-12-20', priority: 'High' } as any,
            auth('u-am-a'),
          ),
        ),
      ).rejects.toThrow(ForbiddenException);

      // Link / Unlink Action Items on Account Z
      await expect(
        enforceGuard('linkActionItem', 'u-am-a', () => controller.linkActionItem('conn-z', 'ai-z-1', auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enforceGuard('unlinkActionItem', 'u-am-a', () => controller.unlinkActionItem('conn-z', 'ai-z-1', auth('u-am-a'))),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects cross-account stakeholder or action-item injection into authorized Account X connect', async () => {
      // Cross-account CLIENT suggestedOwnerId in draft create/update
      await expect(
        enforceGuard('createDraft', 'u-am-a', () =>
          controller.createDraft('conn-x', { title: 'Follow up', suggestedOwnerId: 'stk-z-1' } as any, auth('u-am-a')),
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        enforceGuard('createDraft', 'u-am-a', () =>
          controller.createDraft('conn-x', { title: 'Follow up', suggestedOwnerId: 'stk-null-client' } as any, auth('u-am-a')),
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        enforceGuard('updateDraft', 'u-am-a', () =>
          controller.updateDraft('conn-x', 'draft-x-1', { suggestedOwnerId: 'stk-z-1' } as any, auth('u-am-a')),
        ),
      ).rejects.toThrow(BadRequestException);

      // Cross-account Action Item linking
      await expect(
        enforceGuard('linkActionItem', 'u-am-a', () => controller.linkActionItem('conn-x', 'ai-z-1', auth('u-am-a'))),
      ).rejects.toThrow(BadRequestException);

      // Cross-account attendee addition
      await expect(
        enforceGuard('addAttendee', 'u-am-a', () => controller.addAttendee('conn-x', 'stk-z-1', auth('u-am-a'))),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows Manager A full CRUD, draft conversion, and linking on own Accounts X and Y', async () => {
      const detailY = await enforceGuard('findOne', 'u-am-a', () => controller.findOne('conn-y', auth('u-am-a')));
      expect(detailY.momNotes).toBe('Confidential Y MoM');

      const created = await enforceGuard('create', 'u-am-a', () =>
        controller.create(
          {
            accountId: 'acc-x',
            ownerId: 'u-am-a',
            title: 'X Follow-up Meeting',
            meetingDate: '2026-12-10',
            meetingTime: '09:30',
            attendees: ['stk-x-1'],
          } as any,
          auth('u-am-a', 'Manager A'),
        ),
      );
      expect(created.accountId).toBe('acc-x');

      const updated = await enforceGuard('update', 'u-am-a', () =>
        controller.update(created.id, { momNotes: 'Updated MoM Notes' } as any, auth('u-am-a', 'Manager A')),
      );
      expect(updated.momNotes).toBe('Updated MoM Notes');

      const converted = await enforceGuard('convertDraft', 'u-am-a', () =>
        controller.convertDraft(
          'conn-x',
          'draft-x-1',
          { ownerStakeholderId: 'stk-x-1', dueDate: '2026-12-20', priority: 'High' } as any,
          auth('u-am-a', 'Manager A'),
        ),
      );
      expect(converted.actionItem.id).toBe('ai-converted-1');

      const linked = await enforceGuard('linkActionItem', 'u-am-a', () =>
        controller.linkActionItem('conn-x', 'ai-x-1', auth('u-am-a', 'Manager A')),
      );
      expect(linked.actionItems.some((a: any) => a.id === 'ai-x-1')).toBe(true);
    });
  });

  describe('Admin, Sales, Finance, Scoped Roles & Multi-Role Users', () => {
    it('Admin retains full cross-account read and write access (including deleted-parent restore check)', async () => {
      const all = await enforceGuard('findAll', 'u-admin', () => controller.findAll(auth('u-admin'), '1', '25'));
      expect(all.total).toBe(3);

      const zDetail = await enforceGuard('findOne', 'u-admin', () => controller.findOne('conn-z', auth('u-admin')));
      expect(zDetail.id).toBe('conn-z');

      // Admin hitting restore on deleted parent account receives domain 400 rather than 403
      await expect(
        enforceGuard('restore', 'u-admin', () => controller.restore('conn-z-parent-del', auth('u-admin'))),
      ).rejects.toThrow(new BadRequestException('Cannot restore meeting because its parent account is deleted.'));
    });

    it('Sales and Finance retain cross-account read access via accounts:view-all while writes stay blocked by guard', async () => {
      for (const uid of ['u-sales', 'u-finance']) {
        const list = await enforceGuard('findAll', uid, () => controller.findAll(auth(uid), '1', '25'));
        expect(list.total).toBe(3);

        const zDetail = await enforceGuard('findOne', uid, () => controller.findOne('conn-z', auth(uid)));
        expect(zDetail.id).toBe('conn-z');

        await expect(
          enforceGuard('update', uid, () => controller.update('conn-z', { title: 'Blocked' } as any, auth(uid))),
        ).rejects.toThrow(ForbiddenException);
      }
    });

    it('Vertical Head, Practice Lead, and Client Partner are scoped strictly to their assigned accounts', async () => {
      for (const uid of ['u-vh', 'u-pl', 'u-cp']) {
        const list = await enforceGuard('findAll', uid, () => controller.findAll(auth(uid), '1', '25'));
        expect(list.data.map((m: any) => m.id)).toEqual(['conn-x']);

        const xDetail = await enforceGuard('findOne', uid, () => controller.findOne('conn-x', auth(uid)));
        expect(xDetail.id).toBe('conn-x');

        await expect(enforceGuard('findOne', uid, () => controller.findOne('conn-z', auth(uid)))).rejects.toThrow(
          ForbiddenException,
        );
      }
    });

    it('Multi-role combinations obey union of authorized account scopes without unintended global bypass', async () => {
      // Account Manager + Practice Lead: sees acc-y (practice_lead_id), denied on acc-x & acc-z
      const amplList = await enforceGuard('findAll', 'u-multi-am-pl', () =>
        controller.findAll(auth('u-multi-am-pl'), '1', '25'),
      );
      expect(amplList.data.map((m: any) => m.id)).toEqual(['conn-y']);
      await expect(
        enforceGuard('findOne', 'u-multi-am-pl', () => controller.findOne('conn-z', auth('u-multi-am-pl'))),
      ).rejects.toThrow(ForbiddenException);

      // Account Manager + Project Manager: neither grants view-all, denied on acc-z
      const ampmList = await enforceGuard('findAll', 'u-multi-am-pm', () =>
        controller.findAll(auth('u-multi-am-pm'), '1', '25'),
      );
      expect(ampmList.total).toBe(0);
      await expect(
        enforceGuard('findOne', 'u-multi-am-pm', () => controller.findOne('conn-z', auth('u-multi-am-pm'))),
      ).rejects.toThrow(ForbiddenException);

      // Account Manager + Admin: canViewAllAccounts = true, sees all 3 active connects
      const amAdminList = await enforceGuard('findAll', 'u-multi-am-admin', () =>
        controller.findAll(auth('u-multi-am-admin'), '1', '25'),
      );
      expect(amAdminList.total).toBe(3);
    });

    it('Rejects operations when required module permissions are absent', async () => {
      await expect(enforceGuard('findAll', 'u-no-view', () => controller.findAll(auth('u-no-view')))).rejects.toThrow(
        ForbiddenException,
      );

      // AM lacking action-items:create cannot convert draft even on own Account X
      await expect(
        enforceGuard('convertDraft', 'u-am-no-ai', () =>
          controller.convertDraft(
            'conn-x',
            'draft-x-1',
            { ownerStakeholderId: 'stk-x-1', dueDate: '2026-12-20', priority: 'High' } as any,
            auth('u-am-no-ai'),
          ),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    describe('Lifecycle + Account Scoping & BOLA State-Oracle Prevention', () => {
      it('Completed connect (conn-y): authorized AM can update MoM and manage/convert drafts with suggested fields, while details/attendees/AI/status are rejected', async () => {
        // MoM-only update succeeds on Completed connect
        const updatedMom = await enforceGuard('update', 'u-am-a', () =>
          controller.update('conn-y', { mom: 'Updated Completed MoM' } as any, auth('u-am-a')),
        );
        expect(updatedMom.momNotes).toBe('Updated Completed MoM');

        // Draft create -> update -> convert with canonical camelCase + suggested fields succeed
        const createdDraft = await enforceGuard('createDraft', 'u-am-a', () =>
          controller.createDraft(
            'conn-y',
            {
              title: 'Completed Follow-up',
              description: 'Post-meeting action',
              suggestedOwnerId: 'stk-y-1',
              suggestedDueDate: '2026-12-30',
              suggestedPriority: 'High',
            } as any,
            auth('u-am-a'),
          ),
        );
        expect(createdDraft.suggestedOwnerId).toBe('stk-y-1');
        expect(createdDraft.suggestedOwnerName).toBe('Y Client');
        expect(createdDraft.suggestedDueDate).toBe('2026-12-30');
        expect(createdDraft.suggestedPriority).toBe('High');

        const editedDraft = await enforceGuard('updateDraft', 'u-am-a', () =>
          controller.updateDraft(
            'conn-y',
            createdDraft.id,
            {
              title: 'Edited Completed Follow-up',
              suggestedDueDate: null,
              suggestedPriority: 'Low',
            } as any,
            auth('u-am-a'),
          ),
        );
        expect(editedDraft.title).toBe('Edited Completed Follow-up');
        expect(editedDraft.suggestedDueDate).toBeNull();
        expect(editedDraft.suggestedPriority).toBe('Low');

        const converted = await enforceGuard('convertDraft', 'u-am-a', () =>
          controller.convertDraft(
            'conn-y',
            createdDraft.id,
            {
              title: 'Converted From Completed',
              notes: '',
              ownerStakeholderId: 'stk-y-1',
              priority: 'Low',
              openDate: '2026-11-12',
              dueDate: '2026-12-20',
              actionItemType: 'Stakeholder connect',
            } as any,
            auth('u-am-a'),
          ),
        );
        expect(converted.draft.convertedActionItemId).toBe('ai-converted-1');
        expect(mockActionItems.create).toHaveBeenCalledWith(
          expect.objectContaining({
            notes: '',
            actionItemType: 'Stakeholder connect',
          }),
          'u-am-a',
          expect.anything(),
          expect.any(Function),
        );

        // Draft delete works on unconverted draft in Completed connect
        const tempDraft = await controller.createDraft('conn-y', { title: 'Temp' } as any, auth('u-am-a'));
        const delRes = await controller.deleteDraft('conn-y', tempDraft.id, auth('u-am-a'));
        expect(delRes).toEqual({ success: true });

        // Disallowed mutations on Completed connect reject with 400 BadRequestException
        await expect(controller.update('conn-y', { title: 'Changed' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.addAttendee('conn-y', { stakeholderId: 'stk-y-1' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.removeAttendee('conn-y', 'stk-y-1', auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.linkActionItem('conn-y', { actionItemId: 'ai-converted-1' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.unlinkActionItem('conn-y', 'ai-converted-1', auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.reschedule('conn-y', { meetingDate: '2027-01-01', meetingTime: '11:00', reason: 'Later' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.complete('conn-y', auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.cancel('conn-y', { reason: 'Nope' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
      });

      it('Cancelled & Soft-deleted connects reject unauthorized cross-account caller with 403 Forbidden (no 400/404 state oracle)', async () => {
        // Seed a Cancelled connect and a Soft-Deleted connect on Account Y (owned by AM A, inaccessible to AM B)
        db.connects.push(
          {
            id: 'conn-y-canc',
            account_id: 'acc-y',
            owner_id: 'u-am-a',
            title: 'Y Cancelled',
            meeting_date: '2025-10-02',
            meeting_time: '10:00:00',
            status: 'Cancelled',
            mom_notes: 'Cancelled notes',
            cancellation_reason: 'Client request',
            is_deleted: false,
            created_by: 'u-am-a',
            created_at: '2025-09-20T00:00:00Z',
            updated_at: '2025-09-20T00:00:00Z',
          },
          {
            id: 'conn-y-del',
            account_id: 'acc-y',
            owner_id: 'u-am-a',
            title: 'Y Deleted',
            meeting_date: '2025-10-03',
            meeting_time: '10:00:00',
            status: 'Scheduled',
            mom_notes: null,
            cancellation_reason: null,
            is_deleted: true,
            created_by: 'u-am-a',
            created_at: '2025-09-20T00:00:00Z',
            updated_at: '2025-09-20T00:00:00Z',
          },
        );
        db.drafts.push({
          id: 'draft-y-canc',
          connect_id: 'conn-y-canc',
          title: 'Locked Draft',
          description: null,
          suggested_owner_id: 'stk-y-1',
          suggested_due_date: null,
          suggested_priority: null,
          converted_at: null,
          converted_action_item_id: null,
        });

        // Unauthorized AM B gets 403 Forbidden FIRST on Cancelled/Completed/Deleted connects — never 400 or 404
        for (const cid of ['conn-y', 'conn-y-canc', 'conn-y-del']) {
          await expect(controller.findOne(cid, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.update(cid, { mom: 'Probe' } as any, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.createDraft(cid, { title: 'Probe' } as any, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.reschedule(cid, { meetingDate: '2027-01-01', meetingTime: '10:00' } as any, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.complete(cid, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.cancel(cid, { reason: 'Probe' } as any, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.remove(cid, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
          await expect(controller.convertDraft(cid, 'draft-y-canc', { ownerStakeholderId: 'stk-y-1', priority: 'High', dueDate: '2027-01-01' } as any, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
        }

        // Authorized AM A is rejected with 400 on ALL Cancelled mutations, while soft-delete succeeds -> then 404 on findOne
        await expect(controller.update('conn-y-canc', { mom: 'Cannot edit cancelled MoM' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.createDraft('conn-y-canc', { title: 'No' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.updateDraft('conn-y-canc', 'draft-y-canc', { title: 'No' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.deleteDraft('conn-y-canc', 'draft-y-canc', auth('u-am-a'))).rejects.toThrow(BadRequestException);
        await expect(controller.convertDraft('conn-y-canc', 'draft-y-canc', { ownerStakeholderId: 'stk-y-1', priority: 'High', dueDate: '2027-01-01' } as any, auth('u-am-a'))).rejects.toThrow(BadRequestException);

        // Soft-deleted connect returns 404 to authorized caller
        await expect(controller.findOne('conn-y-del', auth('u-am-a'))).rejects.toThrow(NotFoundException);
        await expect(controller.remove('conn-y-del', auth('u-am-a'))).rejects.toThrow(NotFoundException);
      });
    });

    describe('Soft-Deleted / Deactivated Connect Authorization (M-2)', () => {
      it('rejects view-only users on GET /deactivated and GET /?includeDeleted=true while preserving normal active listing', async () => {
        // Roles with stakeholder-connects:view ONLY (no stakeholder-connects:delete)
        const viewOnlyUsers = ['u-vh', 'u-pl', 'u-cp', 'u-sales', 'u-finance'];

        for (const uid of viewOnlyUsers) {
          // 1. Guard rejects GET /deactivated with 403 Forbidden
          await expect(
            enforceGuard('findAllDeactivated', uid, () => controller.findAllDeactivated(auth(uid), '1', '25')),
          ).rejects.toThrow(ForbiddenException);

          // 2. Service defense-in-depth also rejects direct findAllDeactivated call with 403 Forbidden
          await expect(service.findAllDeactivated({ userId: uid })).rejects.toThrow(ForbiddenException);

          // 3. GET /?includeDeleted=true is rejected with 403 Forbidden
          await expect(
            enforceGuard('findAll', uid, () =>
              controller.findAll(auth(uid), '1', '25', undefined, undefined, undefined, undefined, undefined, 'true'),
            ),
          ).rejects.toThrow(ForbiddenException);

          // 4. Normal active listing (includeDeleted omitted or 'false') continues to succeed and returns only active records
          const activeList = await enforceGuard('findAll', uid, () =>
            controller.findAll(auth(uid), '1', '25'),
          );
          expect(activeList.data.every((m: any) => !m.isDeleted)).toBe(true);
          expect(activeList.data.length).toBeGreaterThan(0);

          const activeExplicitFalse = await enforceGuard('findAll', uid, () =>
            controller.findAll(auth(uid), '1', '25', undefined, undefined, undefined, undefined, undefined, 'false'),
          );
          expect(activeExplicitFalse.data.every((m: any) => !m.isDeleted)).toBe(true);
        }
      });

      it('permits authorized Account Manager with delete permission to list deactivated & includeDeleted within own account scope only', async () => {
        // AM A has delete permission and owns Accounts X & Y (not Account Z)
        const deactivated = await enforceGuard('findAllDeactivated', 'u-am-a', () =>
          controller.findAllDeactivated(auth('u-am-a'), '1', '25'),
        );
        expect(deactivated.total).toBe(1);
        expect(deactivated.data.map((m: any) => m.id)).toEqual(['conn-y-del']);

        const withDeleted = await enforceGuard('findAll', 'u-am-a', () =>
          controller.findAll(auth('u-am-a'), '1', '25', undefined, undefined, undefined, undefined, undefined, 'true'),
        );
        expect(withDeleted.data.map((m: any) => m.id).sort()).toEqual(['conn-x', 'conn-y', 'conn-y-del']);
        expect(withDeleted.data.some((m: any) => m.accountId === 'acc-z')).toBe(false);

        // Cross-account query parameter tampering with includeDeleted=true returns 0 rows
        const tamperedWithDeleted = await enforceGuard('findAll', 'u-am-a', () =>
          controller.findAll(auth('u-am-a'), '1', '25', 'acc-z', undefined, undefined, undefined, undefined, 'true'),
        );
        expect(tamperedWithDeleted.total).toBe(0);
        expect(tamperedWithDeleted.data).toEqual([]);
      });

      it('rejects Account Manager whose delete permission is revoked while keeping active list intact', async () => {
        db.deniedPermsByUser.set('u-am-a', new Set(['stakeholder-connects:delete']));

        await expect(
          enforceGuard('findAllDeactivated', 'u-am-a', () => controller.findAllDeactivated(auth('u-am-a'), '1', '25')),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          enforceGuard('findAll', 'u-am-a', () =>
            controller.findAll(auth('u-am-a'), '1', '25', undefined, undefined, undefined, undefined, undefined, 'true'),
          ),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          enforceGuard('restore', 'u-am-a', () => controller.restore('conn-y-del', auth('u-am-a'))),
        ).rejects.toThrow(ForbiddenException);

        // Normal active listing still succeeds for AM A's authorized accounts
        const activeList = await enforceGuard('findAll', 'u-am-a', () =>
          controller.findAll(auth('u-am-a'), '1', '25'),
        );
        expect(activeList.total).toBe(2);
        expect(activeList.data.map((m: any) => m.id).sort()).toEqual(['conn-x', 'conn-y']);
      });

      it('preserves Admin view-all deactivated access and authorized restore workflow', async () => {
        const adminDeactivated = await enforceGuard('findAllDeactivated', 'u-admin', () =>
          controller.findAllDeactivated(auth('u-admin'), '1', '25'),
        );
        expect(adminDeactivated.data.map((m: any) => m.id).sort()).toEqual([
          'conn-y-del',
          'conn-z-del',
          'conn-z-parent-del',
        ]);

        // View-only user cannot restore
        await expect(
          enforceGuard('restore', 'u-sales', () => controller.restore('conn-y-del', auth('u-sales'))),
        ).rejects.toThrow(ForbiddenException);

        // Authorized AM A restores own deactivated connect (conn-y-del) and remains blocked on Account Z (conn-z-del)
        await expect(
          enforceGuard('restore', 'u-am-a', () => controller.restore('conn-z-del', auth('u-am-a'))),
        ).rejects.toThrow(ForbiddenException);

        const restored = await enforceGuard('restore', 'u-am-a', () =>
          controller.restore('conn-y-del', auth('u-am-a')),
        );
        expect(restored.id).toBe('conn-y-del');
        expect(restored.isDeleted).toBe(false);

        // L-4: Restoring an already-active connect on authorized account is rejected with 400 Bad Request
        await expect(
          enforceGuard('restore', 'u-am-a', () => controller.restore('conn-x', auth('u-am-a'))),
        ).rejects.toThrow(new BadRequestException('Cannot restore meeting because it is already active.'));

        // L-4: Restoring an already-active connect on unauthorized Account Z still throws 403 Forbidden FIRST (no state leak)
        await expect(
          enforceGuard('restore', 'u-am-a', () => controller.restore('conn-z', auth('u-am-a'))),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});

