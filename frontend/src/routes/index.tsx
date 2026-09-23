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
  'action-item-details':  '/action-items/:id',
  projectActionItems:     '/project-action-items',
  'project-action-item-details': '/project-action-items/:id',
  stakeholders:           '/stakeholders',
  forecast:               '/forecast',
  executive:              '/reports',
  reports:                '/reports',
  notifications:          '/notifications',
  administration:         '/administration',
  'audit-log':            '/audit-log',
  'performance-evaluation': '/performance',
  'employee-appreciation': '/employee-appreciation',
  'employee-rewards-recognition': '/employee-rewards-recognition',
  risks:                   '/risks',
  'risk-details':          '/risks/:id',
  'account-growth':        '/account-growth',
  // ── Growth section ────────────────────────────────────────────────────────
  partnership:              '/growth/partnership',
  tracking:                 '/delivery/tracking',
  'delivery-review':        '/delivery/tracking/delivery-review',
  'technical-review':       '/delivery/tracking/technical-review',
  'sqa-review':             '/delivery/tracking/sqa',
  'sqa-tracking':           '/delivery/tracking/sqa',
};

/** Build the actual browser URL for a given view, substituting real entity IDs */
export function buildPath(
  view: ViewType,
  accountId?: string | null,
  opportunityId?: string | null,
  projectId?: string | null,
  sqaId?: string | null,
  riskId?: string | null,
  actionItemId?: string | null,
): string {
  if (view === 'account-details' && accountId)     return `/accounts/${accountId}`;
  if (view === 'opportunity-details' && opportunityId) return `/opportunities/${opportunityId}`;
  if (view === 'opportunity-forecast' && opportunityId) return `/opportunities/${opportunityId}/forecast`;
  if (view === 'project-details' && projectId)     return `/projects/${projectId}`;
  if (view === 'sqa-details' && sqaId)             return `/sqa/${sqaId}`;
  if (view === 'risk-details' && riskId)           return `/risks/${riskId}`;
  if (view === 'action-item-details' && actionItemId) return `/action-items/${actionItemId}`;
  if (view === 'project-action-item-details' && actionItemId) return `/project-action-items/${actionItemId}`;
  return VIEW_TO_PATH[view] ?? '/';
}
