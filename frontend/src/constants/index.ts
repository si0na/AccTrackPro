import type { ViewType } from '@/contexts/CRMContext';
import type { OpportunityStage } from '@/types';

/** Maps every ViewType to its canonical URL path */
export const VIEW_PATHS: Record<ViewType, string> = {
  dashboard: '/',
  accounts: '/accounts',
  'account-details': '/accounts/:id',
  opportunities: '/opportunities',
  'opportunity-details': '/opportunities/:id',
  'opportunity-forecast': '/opportunities/:id/forecast',
  projects: '/projects',
  'project-details': '/projects/:id',
  sqa: '/sqa',
  'sqa-details': '/sqa/:id',
  actionItems: '/action-items',
  projectActionItems: '/project-action-items',
  stakeholders: '/stakeholders',
  forecast: '/forecast',
  executive: '/reports',
  reports: '/reports',
  notifications: '/notifications',
  administration: '/administration',
  'audit-log': '/audit-log',
  'performance-evaluation': '/performance',
  'employee-appreciation': '/employee-appreciation',
};

/** Resolves the ViewType path, substituting real IDs where needed */
export function resolveViewPath(
  view: ViewType,
  accountId?: string | null,
  opportunityId?: string | null,
  projectId?: string | null,
  sqaId?: string | null,
): string {
  if (view === 'account-details' && accountId) return `/accounts/${accountId}`;
  if (view === 'opportunity-details' && opportunityId) return `/opportunities/${opportunityId}`;
  if (view === 'opportunity-forecast' && opportunityId) return `/opportunities/${opportunityId}/forecast`;
  if (view === 'project-details' && projectId) return `/projects/${projectId}`;
  if (view === 'sqa-details' && sqaId) return `/sqa/${sqaId}`;
  return VIEW_PATHS[view] ?? '/';
}

export const PRESET_USER_NAMES = ['John Smith', 'Sarah Johnson', 'Mike Brown', 'Lisa Davis'] as const;

export const ACCOUNT_TYPE_OPTIONS = ['Strategic', 'Non Strategic', 'New'] as const;
export const ACCOUNT_HEALTH_OPTIONS = ['Green', 'Amber', 'Red'] as const;
export const PROJECT_HEALTH_OPTIONS = ['Green', 'Amber', 'Red'] as const;
/**
 * RAG choices for every Project Health picker — Create/Edit Project and the
 * Health Tracker's update form. The label is the RAG status alone: no
 * "(On Track)" / "(At Risk)" / "(Critical)" descriptor, so the picker matches
 * the badge shown on the Overview.
 */
export const PROJECT_HEALTH_CHOICES = [
  { value: 'Green', label: '🟢 Green' },
  { value: 'Amber', label: '🟠 Amber' },
  { value: 'Red',   label: '🔴 Red' },
] as const;
export const OPPORTUNITY_STAGE_OPTIONS = [
  'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Hold', 'Lost',
] as const;
/** Deal outcome derived from stage (Won/Lost stages are closed; everything else is Open). */
export const OPPORTUNITY_OUTCOME_OPTIONS = ['Open', 'Won', 'Lost'] as const;

/**
 * Canonical per-stage colour tokens for the Opportunity Pipeline — the single
 * source of truth shared by the Dashboard and Reports pipelines so any given
 * stage always renders in the exact same colour across the application.
 *
 * Green (emerald) is reserved exclusively for Won and Red exclusively for Lost;
 * every other stage carries its own distinct hue.
 *
 *   bar      — progress-bar / accent fill colour
 *   iconBg   — stage icon avatar background
 *   iconText — stage icon avatar foreground
 *
 * Icon accent (iconBg/iconText) and bar are drawn from the same hue per stage
 * so the accent and progress bar always match.
 */
export const OPPORTUNITY_STAGE_STYLE: Record<
  OpportunityStage,
  { bar: string; iconBg: string; iconText: string; hex: string }
> = {
  Lead:               { bar: 'bg-blue-500',    iconBg: 'bg-blue-100',    iconText: 'text-blue-600',    hex: '#3b82f6' },
  Qualified:          { bar: 'bg-indigo-500',  iconBg: 'bg-indigo-100',  iconText: 'text-indigo-600',  hex: '#6366f1' },
  Proposal:           { bar: 'bg-purple-500',  iconBg: 'bg-purple-100',  iconText: 'text-purple-600',  hex: '#a855f7' },
  Negotiation:        { bar: 'bg-pink-500',    iconBg: 'bg-pink-100',    iconText: 'text-pink-600',    hex: '#ec4899' },
  'Verbal Agreement': { bar: 'bg-teal-500',    iconBg: 'bg-teal-100',    iconText: 'text-teal-600',    hex: '#14b8a6' },
  Won:                { bar: 'bg-emerald-500', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', hex: '#10b981' },
  Blocked:            { bar: 'bg-orange-500',  iconBg: 'bg-orange-100',  iconText: 'text-orange-600',  hex: '#f97316' },
  Delayed:            { bar: 'bg-amber-500',   iconBg: 'bg-amber-100',   iconText: 'text-amber-600',   hex: '#f59e0b' },
  Hold:               { bar: 'bg-zinc-500',    iconBg: 'bg-zinc-100',    iconText: 'text-zinc-600',    hex: '#71717a' },
  Lost:               { bar: 'bg-red-500',     iconBg: 'bg-red-100',     iconText: 'text-red-600',     hex: '#ef4444' },
};

/**
 * Suggested default probability (%) for each pipeline stage. Selecting a stage
 * auto-populates the Probability field with this value while keeping the field
 * fully editable — the value is a suggestion the user can override at any time.
 *
 * Blocked/Delayed are transient holding states with no inherent likelihood, so
 * they carry no default and leave the existing probability untouched.
 */
export const STAGE_DEFAULT_PROBABILITY: Partial<Record<OpportunityStage, number>> = {
  Lead: 10,
  Qualified: 25,
  Proposal: 50,
  Negotiation: 75,
  'Verbal Agreement': 90,
  Won: 100,
  Lost: 0,
};

/**
 * Builds the patch to apply when an opportunity's stage changes: always the new
 * stage, plus the suggested default probability when the stage has one (see
 * {@link STAGE_DEFAULT_PROBABILITY}). Stages without a default (Blocked/Delayed)
 * return only the stage so the current probability is preserved.
 */
export function stageChangePatch(
  stage: OpportunityStage,
): { stage: OpportunityStage; probability?: number } {
  const probability = STAGE_DEFAULT_PROBABILITY[stage];
  return probability === undefined ? { stage } : { stage, probability };
}
export const ACTION_ITEM_STATUS_OPTIONS = ['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled'] as const;
export const OPPORTUNITY_TYPE_OPTIONS = ['Growth', 'Pursuit', 'Whitespace', 'New', 'Extension'] as const;

/** First selectable AOP (Annual Operating Plan) fiscal year — "2026-2027". */
export const AOP_YEAR_START = 2026;

/**
 * How many fiscal years beyond the current one to keep in the dropdown. Large
 * enough to be effectively unlimited (covers a century+ of future years) while
 * staying a finite, computable list — no hardcoded end year is ever reached.
 */
const AOP_YEAR_LOOKAHEAD = 100;

/**
 * Generates the selectable AOP fiscal-year range ("YYYY-YYYY") starting at
 * {@link AOP_YEAR_START} and extending {@link AOP_YEAR_LOOKAHEAD} years past
 * whichever is later — today's year or the start year — so the list always
 * reaches well into the future without a hardcoded end date.
 */
export function generateAopYearOptions(today: Date = new Date()): string[] {
  const endYear = Math.max(today.getFullYear(), AOP_YEAR_START) + AOP_YEAR_LOOKAHEAD;
  const options: string[] = [];
  for (let year = AOP_YEAR_START; year <= endYear; year++) {
    options.push(`${year}-${year + 1}`);
  }
  return options;
}

export const AOP_YEAR_OPTIONS = generateAopYearOptions();

/** Default AOP Year for newly created opportunities. */
export const DEFAULT_AOP_YEAR = AOP_YEAR_OPTIONS[0];
export const SERVICE_LINE_OPTIONS = [
  'Data', 'AI', 'Cloud', 'Application Development', 'Application Support',
  'Infrastructure', 'Cyber Security', 'SharePoint',
  'Consulting', 'UI/UX', 'Digital', 'Database', 'Testing',
  'Project Management', 'Architecture', 'Packaged Applications',
] as const;

export const OPPORTUNITY_HEALTH_OPTIONS = ['Green', 'Amber', 'Red'] as const;
export const OPPORTUNITY_PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;

/**
 * Predefined countries for the Account "Location" field, already alphabetical.
 * Selection is restricted to this list (searchable dropdown) to prevent
 * free-text duplicates/typos.
 */
export const LOCATION_OPTIONS = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia',
  'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China',
  'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
  'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
  'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
  'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine',
  'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
  'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
  'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
] as const;

/**
 * Common free-text aliases seen in legacy "Location" data, mapped to their
 * canonical entry in {@link LOCATION_OPTIONS}. Keys are lowercased.
 */
export const LOCATION_ALIASES: Record<string, string> = {
  'usa': 'United States', 'u.s.a.': 'United States', 'us': 'United States',
  'u.s.': 'United States', 'united states of america': 'United States',
  'america': 'United States',
  'uk': 'United Kingdom', 'u.k.': 'United Kingdom', 'great britain': 'United Kingdom',
  'britain': 'United Kingdom', 'england': 'United Kingdom',
  'uae': 'United Arab Emirates', 'u.a.e.': 'United Arab Emirates',
  'south korea': 'South Korea', 'republic of korea': 'South Korea', 'korea': 'South Korea',
  'russia federation': 'Russia', 'russian federation': 'Russia',
  'czechia': 'Czech Republic',
  'ivory coast': 'Ivory Coast', "cote d'ivoire": 'Ivory Coast', 'côte d’ivoire': 'Ivory Coast',
  'holland': 'Netherlands',
};

// ─── SQA (Software Quality Assurance) ─────────────────────────────────────────
// Mirrors backend/src/common/utils/sqa-options.util.ts — keep both in sync.
//
// Two of these lists are not new master data: SQA's "Billing Model" and "Tower"
// are the same domains as an opportunity's Revenue Model and Service Line, so
// they alias those existing lists rather than restating them.

export const SQA_IMPORTANCE_OPTIONS = ['High', 'Medium', 'Low'] as const;

/** No existing field in the application carries this, so SQA owns it. */
export const SQA_DELIVERY_MODEL_OPTIONS = [
  'Onsite', 'Offshore', 'Onsite-Offshore', 'Nearshore', 'Hybrid',
] as const;

/** SQA Billing Model options. */
export const SQA_BILLING_MODEL_OPTIONS = ['T&E', 'Fixed Bid', 'Fixed Capacity', 'Managed Services'] as const;

export const TOWER_OPTIONS = ['Tower 1', 'Tower 2'] as const;

/** Aliases the Tower master list. */
export const SQA_TOWER_OPTIONS = TOWER_OPTIONS;

export const SQA_RESOURCING_STATUS_OPTIONS = [
  'Fully Staffed', 'Partially Staffed', 'Open Positions', 'Attrition Risk', 'Ramp Down',
] as const;

export const SQA_SDLC_PHASE_OPTIONS = [
  'Requirements', 'Design', 'Development', 'Testing', 'UAT',
  'Deployment', 'Hypercare', 'Maintenance', 'Closure',
] as const;

/** Weekly health picker; the RAG scale is the Project Health one, reused as-is. */
export const SQA_WEEK_HEALTH_CHOICES = PROJECT_HEALTH_CHOICES;

/** How many trailing ISO weeks the weekly health grid shows by default. */
export const SQA_DEFAULT_HEALTH_WEEKS = 3;

/** Options offered by the list view's "weeks shown" control. */
export const SQA_HEALTH_WEEK_CHOICES = [3, 6, 12] as const;

// ─── Business Fields Options ──────────────────────────────────────────────────
export const DELIVERY_MODEL_OPTIONS = ['Staff Aug', 'Fixed Bid', 'Managed', 'Fixed Capacity', 'Others'] as const;
export const BILLING_MODEL_OPTIONS = ['T&M', 'Milestone Based', 'Monthly Fixed', 'Others'] as const;
export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;
export const RISK_RAG_OPTIONS = ['Red', 'Amber', 'Green'] as const;
export const RISK_CLASSIFICATION_OPTIONS = ['Cost', 'Resource', 'Schedule', 'Operational', 'Technical', 'Environment', 'Quality', 'Scope', 'Others'] as const;
export const RISK_IMPACT_OPTIONS = ['Low', 'Medium', 'High'] as const;
export const RISK_LIKELIHOOD_OPTIONS = ['Low', 'Medium', 'High'] as const;

export const PROJECT_DEPENDENCY_TYPE_OPTIONS = [
  'Client Dependency',
  'Technical Dependency',
  'Resource Dependency',
  'Access Dependency',
  'Data Dependency',
  'Environment Dependency',
  'Vendor / Third-Party Dependency',
  'Approval / Decision Dependency',
  'Cross-Team Dependency',
  'Schedule / Milestone Dependency',
  'Compliance / Security Dependency',
  'Commercial / Procurement Dependency',
  'Others',
] as const;

