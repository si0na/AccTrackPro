/**
 * Extract a user-friendly message from an API error.
 *
 * NestJS validation errors arrive as `message: string[]`; business errors as
 * `message: string`; network failures have no response at all. Every surface
 * that shows API errors should go through this helper so wording stays
 * consistent.
 */
export function getApiErrorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback;

  // No HTTP response — server unreachable or CORS/network failure.
  if (err.isAxiosError && !err.response) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  const raw = err?.response?.data?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (Array.isArray(raw) && raw.length) return String(raw[0]);

  const status = err?.response?.status;
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested record could not be found.';
  if (status && status >= 500) return 'The server encountered an error. Please try again shortly.';

  return fallback;
}
