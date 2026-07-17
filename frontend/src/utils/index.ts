import type { ActionItemStatus, OpportunityStage } from '@/types';

export type SortDirection = 'asc' | 'desc';

/**
 * Deal outcome, derived purely from pipeline stage: 'Won'/'Lost' stages are
 * closed, everything else is still open. There is no separate status field —
 * Won/Lost is just another stage value.
 */
export function deriveOppStatus(stage: OpportunityStage | string): 'Open' | 'Won' | 'Lost' {
  return stage === 'Won' || stage === 'Lost' ? stage : 'Open';
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
 * Normalizes an owner display name: trims, collapses inner whitespace, and
 * capitalizes each word that was typed in a single case ("john"/"JOHN" → "John")
 * while leaving intentionally mixed-case words ("McDonald") untouched. Applied
 * on every save so case-only variants never produce duplicate owner entries.
 */
export function normalizeOwnerName(name: string | undefined | null): string {
  const collapsed = (name ?? '').trim().replace(/\s+/g, ' ');
  return collapsed
    .split(' ')
    .map((word) =>
      word === word.toLowerCase() || word === word.toUpperCase()
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ');
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
