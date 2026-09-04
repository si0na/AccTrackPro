/**
 * Route configuration for the CRM application.
 *
 * Routing strategy: state-driven with URL sync.
 * The CRMContext drives which view is rendered. App.tsx uses a useEffect to
 * sync the current view → URL so the address bar reflects the active page and
 * the browser history stack is populated (enabling the Back button).
 *
 * Deep-linking is intentionally deferred to a future iteration; direct URL
 * entry restores the default Dashboard view.
 */

import type { ViewType } from '@/contexts/CRMContext';

/** Canonical URL path for each view */
export const VIEW_TO_PATH: Record<ViewType, string> = {
  dashboard:              '/',
  accounts:               '/accounts',
  'account-details':      '/accounts/:id',
  opportunities:          '/opportunities',
  'opportunity-details':  '/opportunities/:id',
  'opportunity-forecast': '/opportunities/:id/forecast',
  projects:               '/projects',
  'project-details':      '/projects/:id',
  sqa:                    '/sqa',
  'sqa-details':          '/sqa/:id',
  actionItems:            '/action-items',
  projectActionItems:     '/project-action-items',
  stakeholders:           '/stakeholders',
  forecast:               '/forecast',
  executive:              '/reports',
  reports:                '/reports',
  notifications:          '/notifications',
  administration:         '/administration',
  'audit-log':            '/audit-log',
  'performance-evaluation': '/performance',
  'employee-appreciation': '/employee-appreciation',
};

/** Build the actual browser URL for a given view, substituting real entity IDs */
export function buildPath(
  view: ViewType,
  accountId?: string | null,
  opportunityId?: string | null,
  projectId?: string | null,
  sqaId?: string | null,
): string {
  if (view === 'account-details' && accountId)     return `/accounts/${accountId}`;
  if (view === 'opportunity-details' && opportunityId) return `/opportunities/${opportunityId}`;
  if (view === 'opportunity-forecast' && opportunityId) return `/opportunities/${opportunityId}/forecast`;
  if (view === 'project-details' && projectId)     return `/projects/${projectId}`;
  if (view === 'sqa-details' && sqaId)             return `/sqa/${sqaId}`;
  return VIEW_TO_PATH[view] ?? '/';
}
