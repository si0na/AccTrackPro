import { Transform } from 'class-transformer';

/**
 * The frontend sends '' for untouched optional inputs. Map empty/whitespace
 * strings to undefined so @IsOptional short-circuits the remaining validators
 * (e.g. @IsEmail, @Matches) instead of rejecting the empty string.
 */
export function EmptyToUndefined(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );
}

/** ISO calendar date as produced by <input type="date">. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ISO_DATE_MSG = 'must be a date in YYYY-MM-DD format';

/** AOP (Annual Operating Plan) fiscal year range, e.g. "2026-2027". */
export const AOP_YEAR_RE = /^\d{4}-\d{4}$/;

export const AOP_YEAR_MSG = 'AOP Year must be in YYYY-YYYY format (e.g. 2026-2027)';

/** First selectable AOP fiscal year — mirrors the frontend's AOP_YEAR_START. */
export const AOP_YEAR_START = 2026;

/**
 * How many fiscal years beyond the current one to keep valid. Large enough to
 * be effectively unlimited (covers a century+ of future years) while staying a
 * finite, computable list — no hardcoded end year is ever reached.
 */
const AOP_YEAR_LOOKAHEAD = 100;

/**
 * Generates the valid AOP fiscal-year range ("YYYY-YYYY") starting at
 * {@link AOP_YEAR_START} and extending {@link AOP_YEAR_LOOKAHEAD} years past
 * whichever is later — today's year or the start year — so the accepted list
 * always reaches well into the future without a hardcoded end date. Mirrors
 * `frontend/src/constants/index.ts`'s `generateAopYearOptions`.
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

/**
 * Service Line master list — the single source of truth backing the
 * opportunity `serviceLine` field's DTO validation, import/export schema, and
 * the `ServiceLine` type. Mirrors `frontend/src/constants/index.ts`'s
 * `SERVICE_LINE_OPTIONS`; keep both in sync when adding values.
 */
export const SERVICE_LINE_OPTIONS = [
  'Data', 'AI', 'Cloud', 'Application Development', 'Application Support',
  'Infrastructure', 'Cyber Security', 'SharePoint',
  'Consulting', 'UI/UX', 'Digital', 'Database', 'Testing',
  'Project Management', 'Architecture', 'Packaged Applications',
] as const;
