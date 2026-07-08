import type { QueryResult } from 'pg';

/**
 * Converts a pg Date value or ISO string to an ISO string.
 * Returns the value unchanged if it is already a string, or undefined if null/undefined.
 */
export function toIsoString(val: Date | string | null | undefined): string | undefined {
  if (val == null) return undefined;
  return val instanceof Date ? val.toISOString() : val;
}

/**
 * Looks up a user's display name from the users table by UUID.
 * Returns an empty string when ownerId is absent or the user is not found.
 */
export async function resolveOwnerName(
  db: { query(sql: string, params?: any[]): Promise<QueryResult> },
  ownerId: string | undefined,
): Promise<string> {
  if (!ownerId) return '';
  const { rows } = await db.query(`SELECT name FROM users WHERE id = $1`, [ownerId]);
  return rows[0]?.name || '';
}

/**
 * Extracts dynamic custom-column values from a request body by removing all
 * keys that belong to the entity's fixed schema (the `known` set).
 * The result is stored in the entity's `custom_data` JSONB column.
 */
export function extractCustomData(
  body: Record<string, any>,
  known: Set<string>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!known.has(k)) out[k] = v;
  }
  return out;
}
