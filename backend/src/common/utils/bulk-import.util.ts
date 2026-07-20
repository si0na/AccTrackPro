import { HttpException } from '@nestjs/common';

/**
 * How duplicate rows (matched against an existing active record by the module's
 * natural key) are handled during a bulk import:
 *   • 'skip'       — leave the existing record untouched, skip the incoming row
 *   • 'update'     — update the existing record from the incoming row
 *   • 'create-new' — import only rows that don't already exist (duplicates skipped)
 *
 * 'skip' and 'create-new' behave identically for existing records (both skip);
 * they are kept distinct so the UI can surface the user's stated intent.
 */
export type DuplicateMode = 'skip' | 'update' | 'create-new';

export type BulkRowStatus = 'created' | 'updated' | 'skipped' | 'failed';

export interface BulkRowResult {
  index: number;
  status: BulkRowStatus;
  id?: string;
  message?: string;
}

export interface BulkImportOutcome {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: BulkRowResult[];
}

export interface BulkImportHandlers {
  duplicateMode: DuplicateMode;
  /** Field-level validation — return error messages ([] when valid). */
  validate: (row: Record<string, any>) => Promise<string[]>;
  /** Resolve the id of an existing active record this row duplicates, or null. */
  findDuplicateId: (row: Record<string, any>) => Promise<string | null>;
  /** Create a new record; returns the created row (with id). */
  create: (row: Record<string, any>) => Promise<{ id: string }>;
  /** Update an existing record; returns the updated row (with id). */
  update: (id: string, row: Record<string, any>) => Promise<{ id: string }>;
}

/** Pulls a readable message out of a Nest HttpException or a plain Error. */
function messageOf(err: unknown): string {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    if (typeof res === 'string') return res;
    const m = (res as { message?: unknown })?.message;
    if (Array.isArray(m)) return m.join('; ');
    if (typeof m === 'string') return m;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Runs a bulk import row-by-row, reusing the module's own create/update service
 * methods so ALL existing business logic runs per row — relational validation,
 * uniqueness checks, custom_data handling, audit-activity writes and
 * notifications are all preserved exactly as for a single-record write.
 *
 * Each row is committed independently (partial success): one bad row never rolls
 * back the others. Invalid rows and rows that throw are recorded as `failed`
 * with a message; the summary is returned for the caller to audit and surface.
 */
export async function runBulkImport(
  rows: Record<string, any>[],
  handlers: BulkImportHandlers,
): Promise<BulkImportOutcome> {
  const results: BulkRowResult[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] ?? {};
    try {
      const errors = await handlers.validate(row);
      if (errors.length) {
        results.push({ index, status: 'failed', message: errors.join('; ') });
        continue;
      }

      const dupId = await handlers.findDuplicateId(row);
      if (dupId) {
        if (handlers.duplicateMode === 'update') {
          const updated = await handlers.update(dupId, row);
          results.push({ index, status: 'updated', id: updated.id });
        } else {
          results.push({ index, status: 'skipped', id: dupId, message: 'Duplicate of an existing record' });
        }
      } else {
        const created = await handlers.create(row);
        results.push({ index, status: 'created', id: created.id });
      }
    } catch (err) {
      results.push({ index, status: 'failed', message: messageOf(err) });
    }
  }

  return {
    total: rows.length,
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  };
}
