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
  projectActionItems:       'action-items',
  stakeholders:             'stakeholders',
  forecast:                 'forecast',
  executive:                'reports',
  reports:                  'reports',
  notifications:            null,
  administration:           'administration',
  'audit-log':              null,
  'performance-evaluation': 'performance',
  'employee-appreciation':  'employeeAppreciation',
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
  return moduleKey === null || can(moduleKey, 'view');
}
