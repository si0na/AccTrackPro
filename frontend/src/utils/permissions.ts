import type { ViewType } from '@/contexts/CRMContext';

/**
 * Maps a frontend ViewType to the RBAC module key it belongs to. `null` means
 * the view is always available to any authenticated user (no permission gate) —
 * e.g. notifications and the audit log (whose rows are already scoped server-side).
 *
 * A view is accessible when the user has `<moduleKey>:view`.
 */
export const VIEW_MODULE: Record<ViewType, string | null> = {
  dashboard:                'dashboard',
  accounts:                 'accounts',
  'account-details':        'accounts',
  opportunities:            'opportunities',
  'opportunity-details':    'opportunities',
  'opportunity-forecast':   'opportunities',
  projects:                 'projects',
  'project-details':        'projects',
  sqa:                      'sqa',
  'sqa-details':            'sqa',
  actionItems:              'action-items',
  'action-item-details':     'action-items',
  projectActionItems:       'project-action-items',
  'project-action-item-details': 'project-action-items',
  stakeholders:             'stakeholders',
  forecast:                 'forecast',
  executive:                'reports',
  reports:                  'reports',
  notifications:            null,
  administration:           'administration',
  'audit-log':              null,
  'performance-evaluation': 'performance',
  'employee-appreciation':  'employeeAppreciation',
  'employee-rewards-recognition': 'employeeRewardsRecognition',
  risks:                    'risks',
  'risk-details':           'risks',
  'account-growth':         'accountGrowth',
  // ── Delivery / Tracking section placeholders ──────────────────────────────
  partnership:              'accountGrowth',
  tracking:                 'sqa',
  'delivery-review':        'sqa',
  'technical-review':       'sqa',
  'sqa-review':             'sqa',
  'sqa-tracking':           'sqa',
};

/** The RBAC module key backing a view, or null when the view is ungated. */
export function moduleForView(view: ViewType): string | null {
  return VIEW_MODULE[view] ?? null;
}

/**
 * Whether a view is reachable given a `can(module, permission)` checker.
 * Ungated views (null module) are always reachable.
 */
export function canAccessView(view: ViewType, can: (m: string, p: string) => boolean): boolean {
  const moduleKey = moduleForView(view);
  return moduleKey === null || can(moduleKey, 'view') || can(moduleKey, 'view-all');
}

/**
 * All primary navigable views in canonical sidebar order.
 */
export const ORDERED_NAV_VIEWS: ViewType[] = [
  'dashboard',
  'accounts',
  'opportunities',
  'actionItems',
  'stakeholders',
  'risks',
  'account-growth',
  'partnership',
  'projects',
  'projectActionItems',
  'delivery-review',
  'technical-review',
  'sqa-review',
  'forecast',
  'reports',
  'employee-appreciation',
  'employee-rewards-recognition',
  'performance-evaluation',
  'notifications',
  'audit-log',
  'administration',
];

/**
 * Returns the user's first accessible view based on canonical sidebar order.
 * If Dashboard is accessible, returns 'dashboard'.
 * Otherwise, returns the first accessible view in sidebar order.
 * Returns null if no modules are accessible.
 */
export function getFirstAccessibleView(can: (m: string, p: string) => boolean): ViewType | null {
  for (const view of ORDERED_NAV_VIEWS) {
    if (canAccessView(view, can)) {
      return view;
    }
  }
  return null;
}
