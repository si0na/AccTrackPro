/**
 * Phone-number validation for the Service Provider profile. Mirrors the backend
 * rules exactly (backend/src/common/utils/phone.util.ts) — keep the two in sync.
 *
 * Rules: after trimming outer whitespace, the value must be 10–15 digits with an
 * optional single leading '+'. No internal spaces, letters, or other separators.
 */
export const PHONE_REGEX = /^\+?\d{10,15}$/;

export const PHONE_ERROR =
  'Enter a valid phone number: 10–15 digits, an optional leading "+", and no spaces, letters or symbols.';

export function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return PHONE_REGEX.test(normalizePhone(raw));
}
