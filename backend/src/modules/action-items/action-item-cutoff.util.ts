/**
 * Production notification cutoff utility for Action Item notifications.
 *
 * Enforces the production cutoff date (default 24 November 2026: '2026-11-24')
 * to safeguard against sending emails for historical action items or bulk
 * overdue notifications on deployment / application restarts.
 */

export const DEFAULT_NOTIFICATION_CUTOFF_DATE = '2026-11-24';

/**
 * Returns the effective notification cutoff date in 'YYYY-MM-DD' format.
 * Reads from process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE, safely falling
 * back to '2026-11-24'.
 */
export function getNotificationCutoffDate(): string {
  const envDate = process.env.ACTION_ITEM_NOTIFICATION_CUTOFF_DATE?.trim();
  if (envDate && /^\d{4}-\d{2}-\d{2}$/.test(envDate)) {
    return envDate;
  }
  return DEFAULT_NOTIFICATION_CUTOFF_DATE;
}

/**
 * Formats a Date or ISO timestamp string into 'YYYY-MM-DD' according to the
 * configured application timezone.
 */
export function formatDateInTimezone(
  date: Date | string,
  timeZone: string = process.env.APP_TIMEZONE || process.env.TZ || 'UTC',
): string {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
      return '';
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
}

/**
 * Checks whether an ISO date string 'YYYY-MM-DD' is on or after the specified cutoff date.
 */
export function isDateOnOrAfterCutoff(
  dateStr?: string | null,
  cutoffDate: string = getNotificationCutoffDate(),
): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  return dateStr >= cutoffDate;
}
