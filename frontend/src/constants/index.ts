import type { ViewType } from '@/contexts/CRMContext';

/** Maps every ViewType to its canonical URL path */
export const VIEW_PATHS: Record<ViewType, string> = {
  dashboard: '/',
  accounts: '/accounts',
  'account-details': '/accounts/:id',
  opportunities: '/opportunities',
  'opportunity-details': '/opportunities/:id',
  actionItems: '/action-items',
  stakeholders: '/stakeholders',
  forecast: '/forecast',
  executive: '/reports',
  reports: '/reports',
  notifications: '/notifications',
  administration: '/administration',
  'audit-log': '/audit-log',
  'performance-evaluation': '/performance',
};

/** Resolves the ViewType path, substituting real IDs where needed */
export function resolveViewPath(
  view: ViewType,
  accountId?: string | null,
  opportunityId?: string | null,
): string {
  if (view === 'account-details' && accountId) return `/accounts/${accountId}`;
  if (view === 'opportunity-details' && opportunityId) return `/opportunities/${opportunityId}`;
  return VIEW_PATHS[view] ?? '/';
}

export const PRESET_USER_NAMES = ['John Smith', 'Sarah Johnson', 'Mike Brown', 'Lisa Davis'] as const;
