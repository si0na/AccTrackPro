/**
 * Phone-number validation shared by the Service Provider profile DTO and
 * service. The frontend mirrors these exact rules
 * (frontend/src/utils/phone.ts) — keep the two in sync.
 *
 * Rules: after trimming outer whitespace, the value must be 10–15 digits with an
 * optional single leading '+'. No internal spaces, letters, or other separators.
 */
export const PHONE_REGEX = /^\+?\d{10,15}$/;

export const PHONE_ERROR =
  'Enter a valid phone number: 10–15 digits, an optional leading "+", and no spaces, letters or symbols.';

/** Trim outer whitespace; the value is otherwise left untouched (no digit stripping). */
export function normalizePhone(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** True when the trimmed value satisfies {@link PHONE_REGEX}. */
export function isValidPhone(raw: unknown): boolean {
  return PHONE_REGEX.test(normalizePhone(raw));
}
