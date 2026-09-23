import type { ActionItemStatus, OpportunityStage, ServiceProviderUser } from '@/types';
import { LOCATION_OPTIONS, LOCATION_ALIASES } from '@/constants';

export type SortDirection = 'asc' | 'desc';

/** Directory status of a Service Provider — same vocabulary as the Administration user list. */
export type ServiceProviderStatus = 'Active' | 'Inactive' | 'Pending Registration';

/**
 * Registration / activation state of a Service Provider option. People
 * whitelisted in the employee master who have not signed up yet are listed as
 * Service Providers too, and are called out as "Pending Registration" rather
 * than silently hidden.
 */
export function serviceProviderStatus(sp: Pick<ServiceProviderUser, 'isActive' | 'isPending'>): ServiceProviderStatus {
  if (sp.isPending) return 'Pending Registration';
  return sp.isActive ? 'Active' : 'Inactive';
}

/**
 * Single-line label for a Service Provider in a `<select>` / picker. Pending
 * people have no name on record yet, so their email carries the label, and both
 * the pending and deactivated states are spelled out inline.
 */
export function serviceProviderOptionLabel(sp: ServiceProviderUser): string {
  const base = sp.name || sp.email || '(Unnamed)';
  const status = serviceProviderStatus(sp);
  const suffix = status === 'Active' ? '' : ` [${status}]`;
  return `${base}${suffix}`;
}

export function isRawIdStr(s: string): boolean {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) || /^(usr|user|acc|opp|proj|stk|ai)-/i.test(s);
}

/**
 * Deal outcome, derived purely from pipeline stage: 'Won'/'Lost' stages are
 * closed, everything else is still open. There is no separate status field —
 * Won/Lost is just another stage value.
 */
export function deriveOppStatus(stage: OpportunityStage | string): 'Open' | 'Won' | 'Lost' {
  return stage === 'Won' || stage === 'Lost' ? stage : 'Open';
}

/**
 * Single call site for the global Account Selector's scoping rule. Centralized
 * here so a future move to server-side account filtering only needs to touch
 * these call sites, not every inline `=== 'All' || ...` check.
 */
export function matchesGlobalAccount(accountId: string | undefined, globalAccountId: string): boolean {
  return globalAccountId === 'All' || accountId === globalAccountId;
}

/**
 * Strips designation, department, or extra metadata attached to an owner name
 * string (e.g. "John Doe (Senior Manager)" -> "John Doe", "Jane Doe - Engineering" -> "Jane Doe").
 */
export function cleanOwnerName(name?: string | null): string {
  if (!name) return '';
  let str = name.trim();
  // 1. Remove anything in parentheses (e.g. "John Doe (Senior VP)")
  str = str.replace(/\s*\([^)]*\)/g, '');
  // 2. If there is a hyphen/dash separating name and designation/dept (e.g. "John Doe - Manager")
  if (/\s+[-—]\s+/.test(str)) {
    str = str.split(/\s+[-—]\s+/)[0];
  }
  // 3. If there is a comma separating name and designation (e.g. "John Doe, Director of Sales")
  if (/,/.test(str)) {
    str = str.split(',')[0];
  }
  return str.trim();
}

/** Today's date as "YYYY-MM-DD" (local time) — the default Open Date for new action items. */
export function getTodayISODate(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * An action item is still "open" (counts toward open-task widgets, overdue
 * alerts, and quick due-date filters) unless it's Completed or Cancelled.
 */
export function isOpenActionItemStatus(status: ActionItemStatus | string): boolean {
  return status !== 'Completed' && status !== 'Cancelled';
}

/**
 * Generic comparator for table column sorting: numbers compare numerically,
 * booleans compare false-before-true, everything else compares as a
 * locale-aware, numeric-aware string. Nullish values always sort last,
 * regardless of direction, so incomplete rows don't jump position when the
 * user flips between ascending and descending.
 */
export function compareForSort(aVal: unknown, bVal: unknown, direction: SortDirection): number {
  const dir = direction === 'asc' ? 1 : -1;
  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return 1;
  if (bVal == null) return -1;
  if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
    return dir * ((aVal ? 1 : 0) - (bVal ? 1 : 0));
  }
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return dir * (aVal - bVal);
  }
  return dir * String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
}

/** Format a number as USD millions (e.g. 1500000 → "$1.50M") */
export function formatMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

/** Format a number as USD thousands (e.g. 150000 → "$150K") */
export function formatThousands(value: number): string {
  return `$${(value / 1_000).toFixed(0)}K`;
}

/**
 * Returns true when a "YYYY-MM-DD" date falls inside the current calendar week
 * (Monday 00:00 – Sunday 23:59, local time). Used by the dashboard
 * "Action Items Due This Week" widget and its drill-down filter so both share
 * one definition of "this week".
 */
export function isDueThisWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return false;
  const due = new Date(y, m - 1, d);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  return due >= monday && due < nextMonday;
}

/**
 * Maps a legacy free-text "Location" value onto the predefined
 * {@link LOCATION_OPTIONS} country list: exact match, then known alias
 * (e.g. "USA" → "United States"), then a country name found as a substring
 * (e.g. "San Francisco, CA, USA"). Returns '' when nothing maps, so the
 * dropdown falls back to unselected rather than an invalid value.
 */
export function mapLocationToOption(raw: string | undefined | null): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  const exact = LOCATION_OPTIONS.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  if (LOCATION_ALIASES[lower]) return LOCATION_ALIASES[lower];
  const alias = Object.keys(LOCATION_ALIASES).find((key) => lower.includes(key));
  if (alias) return LOCATION_ALIASES[alias];
  const bySubstring = LOCATION_OPTIONS.find((o) => lower.includes(o.toLowerCase()));
  if (bySubstring) return bySubstring;
  return '';
}

/**
 * Year options for the "Customer Since" selector: current year down to 2000,
 * recomputed on every call so next year's value appears with no code change.
 */
export function getCustomerSinceYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear; year >= 2000; year--) years.push(String(year));
  return years;
}

/**
 * Calculates Project Risk Severity based on Impact and Likelihood.
 * Risk Matrix:
 * Impact High   | Likelihood Low -> Medium, Medium -> High,     High -> Critical
 * Impact Medium | Likelihood Low -> Low,    Medium -> Medium,   High -> High
 * Impact Low    | Likelihood Low -> Low,    Medium -> Low,      High -> Medium
 */
export function calculateRiskSeverity(impact?: string, likelihood?: string): string {
  const imp = (impact || '').trim();
  const lik = (likelihood || '').trim();

  if (imp === 'High') {
    if (lik === 'Low') return 'Medium';
    if (lik === 'Medium') return 'High';
    if (lik === 'High') return 'Critical';
  }

  if (imp === 'Medium') {
    if (lik === 'Low') return 'Low';
    if (lik === 'Medium') return 'Medium';
    if (lik === 'High') return 'High';
  }

  if (imp === 'Low') {
    if (lik === 'Low') return 'Low';
    if (lik === 'Medium') return 'Low';
    if (lik === 'High') return 'Medium';
  }

  return '';
}

/** Format a number as USD currency string (e.g. 1500 -> "$1,500.00") */
export function formatCur(value: number | undefined | null): string {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** Known sentinel option values for special/synthetic options */
const SPECIAL_OPTION_SENTINELS = new Set([
  '',
  'all',
  'all accounts',
  'all projects',
  'all opportunities',
  'all stakeholders',
  'none',
  'n/a',
  'na',
  'select',
  'not_assigned',
  'not assigned',
  '—',
  '__none__',
]);

/**
 * Checks whether an item/option represents a special/system/synthetic option
 * (e.g. "Select...", "All...", "None", "N/A", "Not assigned").
 * Does NOT use label-prefix matching so that legitimate data (e.g. "Allison", "Selecta")
 * is treated as normal data.
 */
export function isSpecialOption(item: any): boolean {
  if (item == null) return true;

  if (typeof item === 'object') {
    // 1. Explicit semantic flags
    if (
      item.isSpecial === true ||
      item.isPlaceholder === true ||
      item.isDefault === true ||
      item.isSystem === true ||
      item.isSynthetic === true
    ) {
      return true;
    }

    // 2. Known option `value` sentinel
    const val = item.value;
    if (val === '' || val === null || val === undefined) return true;
    if (typeof val === 'string') {
      const lowerVal = val.trim().toLowerCase();
      if (SPECIAL_OPTION_SENTINELS.has(lowerVal)) return true;
    }

    return false;
  }

  // 3. Primitive option value
  if (typeof item === 'string') {
    const lowerItem = item.trim().toLowerCase();
    if (SPECIAL_OPTION_SENTINELS.has(lowerItem)) return true;
  }

  return false;
}

/**
 * Generic helper to sort any collection of options/entities in ascending
 * alphabetical order by display label or name. Case-insensitive, numeric-aware.
 * Special/system options retain their exact original array slot positions.
 */
export function sortOptionsAlphabetically<T>(
  items: readonly T[],
  getLabel: (item: T) => string = (item: any) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      if (item.label) return String(item.label);
      if (item.name) return String(item.name);
      if (item.displayName) return String(item.displayName);
      if (item.rawName) return String(item.rawName);
      if (item.title) return String(item.title);
      if (item.email) return String(item.email);
      if (item.isActive !== undefined || item.isPending !== undefined) {
        return serviceProviderOptionLabel(item);
      }
      return String(item.id || item.value || item);
    }
    return String(item ?? '');
  },
  preserveOrder: boolean = false,
): T[] {
  if (!items || items.length <= 1 || preserveOrder) {
    return Array.from(items || []);
  }

  const specialIndices: number[] = [];
  const regularIndices: number[] = [];
  const regularItems: T[] = [];

  const result: T[] = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (isSpecialOption(item)) {
      specialIndices.push(i);
      result[i] = item;
    } else {
      regularIndices.push(i);
      regularItems.push(item);
    }
  }

  if (regularItems.length <= 1) {
    return Array.from(items);
  }

  regularItems.sort((a, b) => {
    const labelA = String(getLabel(a) ?? '');
    const labelB = String(getLabel(b) ?? '');
    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base', numeric: true });
  });

  for (let k = 0; k < regularIndices.length; k++) {
    result[regularIndices[k]] = regularItems[k];
  }

  return result;
}

/**
 * Formats a comment timestamp into "DD MMM YYYY hh:mm AM/PM" (e.g. "23 Sep 2026 10:42 AM").
 */
export function formatCommentTimestamp(timestamp?: string | Date): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);

  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');

  return `${day} ${month} ${year} ${hoursStr}:${minutes} ${ampm}`;
}
