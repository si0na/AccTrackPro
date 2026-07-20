/**
 * Contract each CRM module service exposes so the Global Import/Export service
 * can validate and commit that module's worksheet through the module's OWN
 * field schema, Create-DTO gate, duplicate rules and create/update paths — so
 * uniqueness, custom_data, notifications and activity writes all run per row
 * exactly as for a single-record write. Cross-sheet reference resolution
 * (account/opportunity name → id, including parents defined in the same
 * workbook) is handled centrally by the global service, not here.
 */
import type { ImportFieldDef } from '../../common/utils/bulk-validate.util';
import type { IEModuleKey } from './import-field-schemas';

export interface BulkModuleAdapter {
  moduleKey: IEModuleKey;
  fields: ImportFieldDef[];
  /** Cross-field business rules run after coercion + reference resolution. */
  postValidate?: (payload: Record<string, any>, raw: Record<string, any>) => string[];
  /** Final DTO gate — the same class-validator rules the create route applies. */
  validate: (payload: Record<string, any>) => Promise<string[]>;
  /** Natural key for duplicate detection (null → row cannot be deduped). */
  naturalKey: (payload: Record<string, any>) => string | null;
  /** Resolve the id of an existing active record this row duplicates, or null. */
  findExistingId: (payload: Record<string, any>) => Promise<string | null>;
  /** Create a new record; returns the created row (with id). */
  create: (payload: Record<string, any>) => Promise<{ id: string }>;
  /** Update an existing record; returns the updated row (with id). */
  update: (id: string, payload: Record<string, any>) => Promise<{ id: string }>;
}

// ── Pending-parent markers ───────────────────────────────────────────────────
// When a reference (Account / Opportunity) resolves to a parent that does NOT
// yet exist in the system but IS present as a valid row earlier in the same
// workbook, the resolved id is stored as a marker string instead of a real id.
// It survives the Create-DTO gate (still a string) during validation, and is
// swapped for the real id at commit time once the parent has been created.

const PENDING = 'PENDING::';

export const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase();

export const pendingAccountId = (name: string): string => `${PENDING}account::${norm(name)}`;
export const pendingOpportunityId = (name: string): string => `${PENDING}opportunity::${norm(name)}`;

export const isPendingId = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith(PENDING);

/** Extracts the kind ('account' | 'opportunity') and normalized name from a marker. */
export function parsePendingId(v: string): { kind: string; name: string } {
  const parts = v.slice(PENDING.length).split('::');
  return { kind: parts[0] ?? '', name: parts[1] ?? '' };
}
