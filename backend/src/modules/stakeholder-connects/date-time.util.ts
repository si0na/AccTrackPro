/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes user-input or API date strings to strict YYYY-MM-DD format.
 * Supports:
 * - YYYY-MM-DD (standard ISO date)
 * - DD-MM-YYYY (common CRM UI format)
 * - DD/MM/YYYY
 * - ISO timestamps (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function normalizeDateToIso(dateStr?: any): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr ?? '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD-MM-YYYY
  const dmyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const day = dmyDash[1].padStart(2, '0');
    const month = dmyDash[2].padStart(2, '0');
    const year = dmyDash[3];
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY
  const dmySlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    const day = dmySlash[1].padStart(2, '0');
    const month = dmySlash[2].padStart(2, '0');
    const year = dmySlash[3];
    return `${year}-${month}-${day}`;
  }

  // ISO timestamp (e.g. 2026-11-04T10:00:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  return trimmed;
}

/**
 * Normalizes time strings to HH:MM:SS standard format.
 */
export function normalizeTimeToStandard(timeStr?: any): string {
  if (!timeStr || typeof timeStr !== 'string') return '00:00:00';
  const trimmed = timeStr.trim();
  if (!trimmed) return '00:00:00';

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}:00`;
  }

  return trimmed;
}

/**
 * Parses date and time components into a local Date instance without timezone shifts.
 */
export function parseDateTimeToLocal(dateStr: string, timeStr?: string): Date {
  const normalizedDate = normalizeDateToIso(dateStr);
  const [year, month, day] = normalizedDate.split('-').map(Number);
  const normalizedTime = normalizeTimeToStandard(timeStr);
  const [hours, minutes, seconds] = normalizedTime.split(':').map(Number);

  return new Date(
    year || 1970,
    (month || 1) - 1,
    day || 1,
    hours || 0,
    minutes || 0,
    seconds || 0,
    0,
  );
}

/**
 * Checks whether the given meeting date and time is in the future relative to system now.
 */
export function isFutureDateTime(dateStr: string, timeStr?: string): boolean {
  if (!dateStr) return false;
  const dt = parseDateTimeToLocal(dateStr, timeStr);
  return dt.getTime() > Date.now();
}

/**
 * Checks whether two date and time combinations are strictly identical.
 */
export function isSameDateTime(
  date1: string,
  time1: string | undefined,
  date2: string,
  time2: string | undefined,
): boolean {
  const d1 = normalizeDateToIso(date1);
  const d2 = normalizeDateToIso(date2);
  const t1 = normalizeTimeToStandard(time1);
  const t2 = normalizeTimeToStandard(time2);
  return d1 === d2 && t1 === t2;
}
