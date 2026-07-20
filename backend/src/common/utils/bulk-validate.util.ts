/**
 * Backend bulk-import validation engine (dry run).
 *
 * The client parses the uploaded .xlsx/.csv (SheetJS runs in the browser) and
 * POSTs the raw rows — keyed by their column header — to a per-module
 * `/:module/bulk/validate` route. This engine is the single source of truth for
 * every verdict shown in the import preview: it coerces each cell to the right
 * type, runs field-level validation (required / type / enum / date / email /
 * phone / URL), resolves relationship columns (account / opportunity name → id)
 * via service-supplied hooks, applies the module's Create DTO as a final gate,
 * and flags duplicates — both against existing system records and against other
 * rows in the same file. The frontend only reviews / edits / confirms.
 *
 * The field-coercion rules here mirror what the single-record create path
 * enforces, so a bulk-imported row is held to exactly the same contract as one
 * created through the UI.
 */

export type ImportFieldType =
  | 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'enum' | 'reference';

/** Declarative definition of one importable column (backend-owned mirror of the template columns). */
export interface ImportFieldDef {
  /** Payload key sent to the create/update path (camelCase), e.g. 'name', 'accountId'. */
  key: string;
  /** Column header as it appears in the uploaded file / template. */
  header: string;
  type: ImportFieldType;
  required?: boolean;
  /** Allowed values for `enum` fields (canonical casing). */
  options?: readonly string[];
  /** Lowercased alias → canonical option, for friendlier enum input. */
  aliases?: Record<string, string>;
  /** For `reference` fields: which entity the human value resolves against. */
  reference?: 'account' | 'opportunity';
  /** Extra format validation for `string` fields. */
  format?: 'email' | 'phone' | 'website';
  /** Applied when the cell is empty. */
  default?: string | number | boolean;
}

export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';

/** Verdict for one uploaded row — everything the preview grid needs to render it. */
export interface ValidatedImportRow {
  /** 0-based index within the uploaded data rows (stable join key with the client's parsed rows). */
  index: number;
  /** 1-based data-row number (header excluded) for display. */
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  /** True when a valid row matches a record that already exists in the system. */
  existsInSystem: boolean;
  /** Group id shared by rows that duplicate each other WITHIN the file (else null). */
  fileDupGroup: string | null;
  /** Normalized payload (ids resolved, types coerced) — sent verbatim on import. */
  payload: Record<string, any>;
  /** Resolved human labels for reference columns (e.g. { account: 'Acme Corp' }). */
  refNames: Record<string, string>;
}

export interface BulkValidationResult {
  rows: ValidatedImportRow[];
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesExisting: number;
  /** Rows the Import button would send by default (valid and not an existing-system duplicate). */
  importable: number;
  missingRequiredColumns: string[];
  unknownColumns: string[];
}

/** Service-supplied hooks that give the engine access to DB-backed checks. */
export interface BulkValidateHandlers {
  fields: ImportFieldDef[];
  /**
   * Resolve reference columns (account/opportunity name → id) against the
   * requesting user's data, mutating `payload` in place. Returns any resolution
   * errors plus resolved display names. Omit for modules with no references.
   */
  resolveReferences?: (
    payload: Record<string, any>,
    raw: Record<string, any>,
  ) => Promise<{ errors: string[]; refNames: Record<string, string> }>;
  /** Cross-field business rules run after coercion + reference resolution. */
  postValidate?: (payload: Record<string, any>, raw: Record<string, any>) => string[];
  /** Final DTO gate — the same class-validator rules the create route applies. */
  validate: (payload: Record<string, any>) => Promise<string[]>;
  /** Natural key for duplicate detection (null → row cannot be deduped). */
  naturalKey: (payload: Record<string, any>) => string | null;
  /** Resolve the id of an existing active record this row duplicates, or null. */
  findExistingId: (payload: Record<string, any>) => Promise<string | null>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().\-/]{5,}$/;
const WEBSITE_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes a header for tolerant matching (case/space/punctuation-insensitive). */
export function normalizeHeader(h: string): string {
  return String(h).trim().toLowerCase().replace(/[\s_]+/g, ' ');
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Excel serial value passed as a number, ISO string, or Date → 'YYYY-MM-DD', or null. */
function coerceDate(v: unknown): string | null {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (v instanceof Date && !isNaN(v.getTime())) return fmt(v);
  const s = String(v).trim();
  if (ISO_DATE_RE.test(s)) return s;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : fmt(parsed);
}

function coerceBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(s)) return true;
  if (['false', 'no', 'n', '0'].includes(s)) return false;
  return null;
}

/**
 * Coerces + validates one raw row into a payload, running the same field-level
 * rules the single-record create path enforces. Reference columns are captured
 * as their raw string here and resolved to ids later by the service hook.
 */
export function coerceAndValidateRow(
  raw: Record<string, any>,
  fields: ImportFieldDef[],
  headerMap: Map<string, string>,
): { payload: Record<string, any>; errors: string[] } {
  const payload: Record<string, any> = {};
  const errors: string[] = [];

  for (const field of fields) {
    const actualKey = headerMap.get(normalizeHeader(field.header));
    const rawVal = actualKey === undefined ? undefined : raw[actualKey];

    if (isBlank(rawVal)) {
      if (field.required && field.default === undefined) {
        errors.push(`${field.header} is required`);
      } else if (field.default !== undefined) {
        payload[field.key] = field.default;
      }
      continue;
    }

    const err = (msg: string) => errors.push(`${field.header}: ${msg}`);

    switch (field.type) {
      case 'reference': // resolved to an id later; capture the trimmed string now
      case 'string': {
        const s = String(rawVal).trim();
        if (field.format === 'email' && !EMAIL_RE.test(s)) { err('must be a valid email address'); break; }
        if (field.format === 'phone' && !PHONE_RE.test(s)) { err('must be a valid phone number'); break; }
        if (field.format === 'website' && !WEBSITE_RE.test(s)) { err('must be a valid URL'); break; }
        payload[field.key] = s;
        break;
      }
      case 'number':
      case 'integer': {
        const n = Number(String(rawVal).replace(/[$,\s]/g, ''));
        if (isNaN(n)) { err('must be a number'); break; }
        if (field.type === 'integer' && !Number.isInteger(n)) { err('must be a whole number'); break; }
        if (n < 0) { err('cannot be negative'); break; }
        payload[field.key] = field.type === 'integer' ? Math.round(n) : n;
        break;
      }
      case 'boolean': {
        const b = coerceBoolean(rawVal);
        if (b === null) { err('must be Yes or No'); break; }
        payload[field.key] = b;
        break;
      }
      case 'date': {
        const d = coerceDate(rawVal);
        if (!d) { err('must be a valid date (YYYY-MM-DD)'); break; }
        payload[field.key] = d;
        break;
      }
      case 'enum': {
        const s = String(rawVal).trim();
        const match =
          field.options?.find((o) => o.toLowerCase() === s.toLowerCase()) ??
          field.aliases?.[s.toLowerCase()];
        if (!match) { err(`must be one of: ${field.options?.join(', ')}`); break; }
        payload[field.key] = match;
        break;
      }
    }
  }

  return { payload, errors };
}

/**
 * Runs the full dry-run validation over every uploaded row and returns per-row
 * verdicts plus aggregate counts. Duplicate detection covers both existing
 * system records (via `findExistingId`) and in-file duplicates (rows sharing a
 * natural key are grouped so the UI can let the user keep one and drop the rest).
 */
export async function runBulkValidate(
  rows: Record<string, any>[],
  headers: string[],
  handlers: BulkValidateHandlers,
): Promise<BulkValidationResult> {
  const { fields } = handlers;

  const headerMap = new Map<string, string>();
  for (const h of headers) headerMap.set(normalizeHeader(h), h);

  const knownHeaders = new Set(fields.map((f) => normalizeHeader(f.header)));
  const missingRequiredColumns = fields
    .filter((f) => f.required && !headerMap.has(normalizeHeader(f.header)))
    .map((f) => f.header);
  const unknownColumns = headers.filter((h) => !knownHeaders.has(normalizeHeader(h)));

  // Pass 1 — coerce, resolve references, run business rules + DTO gate.
  const validated: ValidatedImportRow[] = [];
  for (let index = 0; index < rows.length; index++) {
    const raw = rows[index] ?? {};
    const { payload, errors } = coerceAndValidateRow(raw, fields, headerMap);
    const refNames: Record<string, string> = {};

    if (errors.length === 0 && handlers.resolveReferences) {
      const res = await handlers.resolveReferences(payload, raw);
      errors.push(...res.errors);
      Object.assign(refNames, res.refNames);
    }
    if (errors.length === 0 && handlers.postValidate) {
      errors.push(...handlers.postValidate(payload, raw));
    }
    if (errors.length === 0) {
      errors.push(...(await handlers.validate(payload)));
    }

    validated.push({
      index,
      rowNumber: index + 1,
      status: errors.length ? 'invalid' : 'valid',
      errors,
      existsInSystem: false,
      fileDupGroup: null,
      payload,
      refNames,
    });
  }

  // Pass 2 — duplicate detection over the rows that passed field validation.
  const keyOf = new Map<number, string>();
  const keyCounts = new Map<string, number>();
  for (const row of validated) {
    if (row.status !== 'valid') continue;
    const key = handlers.naturalKey(row.payload);
    if (!key) continue;
    keyOf.set(row.index, key);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  // Existing-system check — one query per distinct key (cached).
  const existsCache = new Map<string, boolean>();
  for (const row of validated) {
    const key = keyOf.get(row.index);
    if (!key) continue;
    if (!existsCache.has(key)) {
      existsCache.set(key, (await handlers.findExistingId(row.payload)) !== null);
    }
    row.existsInSystem = existsCache.get(key)!;
  }

  // In-file duplicate grouping — assign a stable group id to each duplicated key.
  const groupIds = new Map<string, string>();
  let nextGroup = 1;
  for (const [key, count] of keyCounts) {
    if (count > 1) groupIds.set(key, `dup-${nextGroup++}`);
  }
  for (const row of validated) {
    const key = keyOf.get(row.index);
    if (key && groupIds.has(key)) row.fileDupGroup = groupIds.get(key)!;
    if (row.status === 'valid' && (row.existsInSystem || row.fileDupGroup)) {
      row.status = 'duplicate';
    }
  }

  const valid = validated.filter((r) => r.status === 'valid').length;
  const invalid = validated.filter((r) => r.status === 'invalid').length;
  const duplicatesExisting = validated.filter((r) => r.existsInSystem).length;
  const duplicatesInFile = validated.filter((r) => r.fileDupGroup && !r.existsInSystem).length;
  const importable = validated.filter((r) => r.status !== 'invalid' && !r.existsInSystem).length;

  return {
    rows: validated,
    total: validated.length,
    valid,
    invalid,
    duplicatesInFile,
    duplicatesExisting,
    importable,
    missingRequiredColumns,
    unknownColumns,
  };
}
