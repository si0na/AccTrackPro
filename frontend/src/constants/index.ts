import type { ViewType } from '@/contexts/CRMContext';
import type { OpportunityStage } from '@/types';

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
  'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Lost',
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
  { bar: string; iconBg: string; iconText: string }
> = {
  Lead:               { bar: 'bg-blue-500',    iconBg: 'bg-blue-100',    iconText: 'text-blue-600' },
  Qualified:          { bar: 'bg-indigo-500',  iconBg: 'bg-indigo-100',  iconText: 'text-indigo-600' },
  Proposal:           { bar: 'bg-purple-500',  iconBg: 'bg-purple-100',  iconText: 'text-purple-600' },
  Negotiation:        { bar: 'bg-pink-500',    iconBg: 'bg-pink-100',    iconText: 'text-pink-600' },
  'Verbal Agreement': { bar: 'bg-teal-500',    iconBg: 'bg-teal-100',    iconText: 'text-teal-600' },
  Won:                { bar: 'bg-emerald-500', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
  Blocked:            { bar: 'bg-orange-500',  iconBg: 'bg-orange-100',  iconText: 'text-orange-600' },
  Delayed:            { bar: 'bg-amber-500',   iconBg: 'bg-amber-100',   iconText: 'text-amber-600' },
  Lost:               { bar: 'bg-red-500',     iconBg: 'bg-red-100',     iconText: 'text-red-600' },
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
export const OPPORTUNITY_TYPE_OPTIONS = ['Growth', 'Pursuit', 'Whitespace'] as const;
export const SERVICE_LINE_OPTIONS = [
  'Data', 'AI', 'Cloud', 'Application Development', 'Application Support',
  'Infrastructure', 'Cyber Security', 'SharePoint',
] as const;

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
