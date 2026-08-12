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
  constructor(private readonly permissions: PermissionsService) {}

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
  buildChildVisibility(childAlias: string, ctx: UserAccessContext, startIdx: number): ScopeFragment {
    if (ctx.canViewAllAccounts) {
      return { conditions: [], params: [], nextIdx: startIdx };
    }

    const inner = this.buildAccountVisibility('acc_scope', ctx, startIdx);
    const innerWhere = inner.conditions.length ? ` AND ${inner.conditions.join(' AND ')}` : '';
    const exists =
      `EXISTS (SELECT 1 FROM accounts acc_scope ` +
      `WHERE acc_scope.id = ${childAlias}.account_id AND acc_scope.is_deleted = FALSE${innerWhere})`;
    return { conditions: [exists], params: inner.params, nextIdx: inner.nextIdx };
  }
}
