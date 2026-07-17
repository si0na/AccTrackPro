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
