/**
 * ISO-8601 week helpers.
 *
 * SQA's weekly health grid ("Health Week 31", "Health Week 32", …) buckets the
 * existing project health trail by ISO week. Bucketing happens here, in JS, on
 * UTC dates rather than in SQL: Postgres' `date_trunc('week', …)` resolves a
 * TIMESTAMPTZ against the session timezone, so the same entry could land in
 * different weeks for two callers. These helpers are timezone-stable and are
 * mirrored on the frontend, so both sides always agree on which week a health
 * entry belongs to.
 *
 * ISO rules: weeks start Monday; week 1 is the week containing January 4th
 * (equivalently, the week whose Thursday falls in the ISO year).
 */

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface IsoWeek {
  /** ISO week-numbering year — differs from the calendar year in late Dec / early Jan. */
  isoYear: number;
  /** 1–53. */
  weekNumber: number;
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
}

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Monday 00:00 UTC of the ISO week containing `date`. */
export function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Sunday (0) counts as day 7
  d.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
  return d;
}

/** Monday 00:00 UTC of ISO week `weekNumber` in `isoYear`. */
export function isoWeekStartOf(isoYear: number, weekNumber: number): Date {
  // Jan 4th always falls in ISO week 1, so its Monday anchors the year.
  const firstMonday = isoWeekStart(new Date(Date.UTC(isoYear, 0, 4)));
  return new Date(firstMonday.getTime() + (weekNumber - 1) * MS_PER_WEEK);
}

/** The ISO week a date belongs to. */
export function isoWeekOf(date: Date): IsoWeek {
  const monday = isoWeekStart(date);
  // The ISO year is the calendar year of the week's Thursday.
  const thursday = new Date(monday.getTime() + 3 * MS_PER_DAY);
  const isoYear = thursday.getUTCFullYear();
  const firstMonday = isoWeekStart(new Date(Date.UTC(isoYear, 0, 4)));
  const weekNumber = Math.round((monday.getTime() - firstMonday.getTime()) / MS_PER_WEEK) + 1;
  return { isoYear, weekNumber, weekStart: toIsoDate(monday) };
}

/** Stable map key for a week — `"2026-W31"`. */
export function isoWeekKey(week: { isoYear: number; weekNumber: number }): string {
  return `${week.isoYear}-W${String(week.weekNumber).padStart(2, '0')}`;
}

/**
 * The `count` most recent ISO weeks ending with the week containing `anchor`,
 * oldest first — the window backing the weekly health columns.
 */
export function trailingIsoWeeks(count: number, anchor: Date = new Date()): IsoWeek[] {
  const anchorMonday = isoWeekStart(anchor);
  const weeks: IsoWeek[] = [];
  for (let i = count - 1; i >= 0; i--) {
    weeks.push(isoWeekOf(new Date(anchorMonday.getTime() - i * MS_PER_WEEK)));
  }
  return weeks;
}
