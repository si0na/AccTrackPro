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

export const ACCOUNT_TYPE_OPTIONS = ['Strategic', 'Non Strategic', 'New'] as const;
export const ACCOUNT_HEALTH_OPTIONS = ['Green', 'Amber', 'Red'] as const;
export const OPPORTUNITY_STAGE_OPTIONS = [
  'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Blocked', 'Delayed', 'Lost',
] as const;
/** Deal outcome derived from stage (Won/Lost stages are closed; everything else is Open). */
export const OPPORTUNITY_OUTCOME_OPTIONS = ['Open', 'Won', 'Lost'] as const;
export const ACTION_ITEM_STATUS_OPTIONS = ['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled'] as const;
export const OPPORTUNITY_TYPE_OPTIONS = ['Growth', 'Pursuit', 'Whitespace'] as const;
export const SERVICE_LINE_OPTIONS = [
  'Data', 'AI', 'Cloud', 'Application Development', 'Application Support',
  'Infrastructure', 'Cyber Security', 'SharePoint',
] as const;
