import { Injectable } from '@nestjs/common';
import { PermissionsService, UserAccessContext } from './permissions.service';

export interface ScopeFragment {
  conditions: string[];
  params: any[];
  nextIdx: number;
}

/**
 * Builds role-aware SQL visibility fragments, replacing the old owner-only
 * scoping. Account visibility is driven entirely by DB configuration:
 *
 *   • any role has accounts:view-all → sees every account (admin / sales / finance)
 *   • any role has an account_scope_field → sees accounts where ANY of those FKs
 *     = the user (account-manager / practice-lead / client-partner / vertical-head);
 *     with multiple roles the conditions are OR-ed together
 *   • otherwise → falls back to owner_id = the user
 *
 * Child records (opportunities, action items, stakeholders, activities) inherit
 * their parent account's visibility via an EXISTS sub-query.
 */
@Injectable()
export class AccessScopeService {
  constructor(private readonly permissions: PermissionsService) { }

  /** Convenience: resolve the caller's authorization context. */
  getContext(userId: string): Promise<UserAccessContext> {
    return this.permissions.getUserAccessContext(userId);
  }

  /**
   * Visibility conditions on an accounts row aliased `alias`.
   * `startIdx` is the first free $N placeholder index.
   */
  buildAccountVisibility(alias: string, ctx: UserAccessContext, startIdx: number): ScopeFragment {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = startIdx;

    // View-all short-circuits: no row restriction at all.
    if (ctx.canViewAllAccounts) {
      return { conditions, params, nextIdx: idx };
    }

    // A user may hold several ownership-scoped roles at once — visible when they
    // occupy ANY of those ownership fields on the account (OR-ed).
    const scopeFields = (ctx.accountScopeFields ?? [])
      .map((f) => PermissionsService.safeScopeField(f))
      .filter((f): f is string => !!f);
    if (scopeFields.length) {
      const ors = scopeFields.map((field) => {
        const clause = `${alias}.${field} = $${idx++}`;
        params.push(ctx.userId);
        return clause;
      });

      // Include base ownership check specifically for the Account Manager scope
      if (scopeFields.includes('account_manager_id')) {
        ors.push(`${alias}.owner_id = $${idx++}`);
        params.push(ctx.userId);
      }

      conditions.push(ors.length === 1 ? ors[0] : `(${ors.join(' OR ')})`);
      return { conditions, params, nextIdx: idx };
    }

    // Default (no view-all, no scope field): own records only.
    conditions.push(`${alias}.owner_id = $${idx++}`);
    params.push(ctx.userId);
    return { conditions, params, nextIdx: idx };
  }

  /**
   * Visibility for a child entity aliased `childAlias` that carries an
   * `account_id` FK — it is visible when its parent account is visible.
   * Produces a single EXISTS condition.
   */
  buildChildVisibility(childAlias: string, ctx: UserAccessContext, startIdx: number, moduleKey?: string): ScopeFragment {
    if (ctx.canViewAllAccounts || (moduleKey && ctx.permissions.has(`${moduleKey}:view-all`))) {
      return { conditions: [], params: [], nextIdx: startIdx };
    }

    const inner = this.buildAccountVisibility('acc_scope', ctx, startIdx);
    const innerWhere = inner.conditions.length ? ` AND ${inner.conditions.join(' AND ')}` : '';
    const exists =
      `(${childAlias}.account_id IS NULL OR EXISTS (SELECT 1 FROM accounts acc_scope ` +
      `WHERE acc_scope.id = ${childAlias}.account_id AND acc_scope.is_deleted = FALSE${innerWhere}))`;
    return { conditions: [exists], params: inner.params, nextIdx: inner.nextIdx };
  }

  /**
   * Dedicated RBAC visibility for stakeholders.
   * - stakeholders:view-all grants visibility to ALL Client Stakeholders regardless of Account permissions.
   * - stakeholders:view (without view-all) provides scoped visibility via parent account.
   * - No stakeholder view permission returns 1=0 (no access).
   */
  buildStakeholderVisibility(alias: string, ctx: UserAccessContext, startIdx: number): ScopeFragment {
    const hasView = ctx.permissions.has('stakeholders:view') || ctx.permissions.has('stakeholders:view-all');
    const hasViewAll = ctx.permissions.has('stakeholders:view-all');

    if (!hasView) {
      return { conditions: ['1=0'], params: [], nextIdx: startIdx };
    }
    if (hasViewAll) {
      return { conditions: [], params: [], nextIdx: startIdx };
    }

    const inner = this.buildAccountVisibility('acc_stk_scope', ctx, startIdx);
    const innerWhere = inner.conditions.length ? ` AND ${inner.conditions.join(' AND ')}` : '';
    const exists =
      `(${alias}.account_id IS NULL OR EXISTS (SELECT 1 FROM accounts acc_stk_scope ` +
      `WHERE acc_stk_scope.id = ${alias}.account_id AND acc_stk_scope.is_deleted = FALSE${innerWhere}))`;
    return { conditions: [exists], params: inner.params, nextIdx: inner.nextIdx };
  }


  /**
   * Role-aware visibility for a projects row aliased `alias`.
   */
  buildProjectVisibility(alias: string, ctx: UserAccessContext, startIdx: number): ScopeFragment {
    if (ctx.permissions.has('projects:view-all') || ctx.canViewAllAccounts) {
      return { conditions: [], params: [], nextIdx: startIdx };
    }

    let idx = startIdx;
    const params: any[] = [];

    const uId = idx;
    const uEmail = idx + 1;
    params.push(ctx.userId, ctx.userEmail ?? '');
    idx += 2;

    const accountScope = this.buildAccountVisibility('acc_proj_scope', ctx, idx);
    const innerAccWhere = accountScope.conditions.length ? ` AND ${accountScope.conditions.join(' AND ')}` : '';

    params.push(...accountScope.params);
    idx = accountScope.nextIdx;

    const matchAssigned = (col: string) =>
      `(${alias}.${col} = $${uId} OR ($${uEmail} <> '' AND LOWER(${alias}.${col}) = LOWER($${uEmail})))`;

    const ors = [
      matchAssigned('owner_id'),
      matchAssigned('service_provider_pm_id'),
      matchAssigned('practice_lead_id'),
      matchAssigned('client_partner_id'),
      `EXISTS (SELECT 1 FROM accounts acc_proj_scope WHERE acc_proj_scope.id = ${alias}.account_id AND acc_proj_scope.is_deleted = FALSE${innerAccWhere})`,
    ];

    return { conditions: [`(${ors.join(' OR ')})`], params, nextIdx: idx };
  }

  /**
   * Role-aware visibility for an action_items row aliased `alias`.
   */
  buildActionItemVisibility(alias: string, ctx: UserAccessContext, startIdx: number): ScopeFragment {
    const hasNormalView = ctx.permissions.has('action-items:view') || ctx.permissions.has('action-items:view-all') || ctx.canViewAllAccounts;
    const hasNormalViewAll = ctx.permissions.has('action-items:view-all') || ctx.canViewAllAccounts;

    const hasProjView = ctx.permissions.has('project-action-items:view') || ctx.permissions.has('project-action-items:view-all');
    const hasProjViewAll = ctx.permissions.has('project-action-items:view-all');

    if (!hasNormalView && !hasProjView) {
      return { conditions: ['1=0'], params: [], nextIdx: startIdx };
    }

    let idx = startIdx;
    const params: any[] = [];
    const mainOrs: string[] = [];

    if (hasNormalView) {
      if (hasNormalViewAll) {
        mainOrs.push(`${alias}.project_id IS NULL`);
      } else {
        const uOwner = idx;
        params.push(ctx.userId);
        idx += 1;

        const accountScope = this.buildAccountVisibility('acc_ai_scope', ctx, idx);
        const innerAccWhere = accountScope.conditions.length ? ` AND ${accountScope.conditions.join(' AND ')}` : '';
        params.push(...accountScope.params);
        idx = accountScope.nextIdx;

        mainOrs.push(
          `(${alias}.project_id IS NULL AND (${alias}.owner_id = $${uOwner} OR EXISTS (SELECT 1 FROM accounts acc_ai_scope WHERE acc_ai_scope.id = ${alias}.account_id AND acc_ai_scope.is_deleted = FALSE${innerAccWhere})))`
        );
      }
    }

    if (hasProjView) {
      if (hasProjViewAll) {
        mainOrs.push(`${alias}.project_id IS NOT NULL`);
      } else {
        const uOwner = idx;
        params.push(ctx.userId);
        idx += 1;

        const projScope = this.buildProjectVisibility('proj_ai_scope', ctx, idx);
        const innerProjWhere = projScope.conditions.length ? ` AND ${projScope.conditions.join(' AND ')}` : '';
        params.push(...projScope.params);
        idx = projScope.nextIdx;

        mainOrs.push(
          `(${alias}.project_id IS NOT NULL AND (${alias}.owner_id = $${uOwner} OR EXISTS (SELECT 1 FROM projects proj_ai_scope WHERE proj_ai_scope.id = ${alias}.project_id AND proj_ai_scope.is_deleted = FALSE${innerProjWhere})))`
        );
      }
    }

    return { conditions: [`(${mainOrs.join(' OR ')})`], params, nextIdx: idx };
  }
}
