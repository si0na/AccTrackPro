import type { Account, Opportunity, ActionItem, Stakeholder } from '@/types';
import type { DuplicateMode, ValidatedImportRow, IEModuleKey } from '@/api/crm.api';

export type { DuplicateMode, IEModuleKey };
export type ExportFormat = 'xlsx';

/**
 * The workbook's worksheets, in the fixed DEPENDENCY order they are always
 * processed (parents before children) regardless of their order in the file.
 * Mirrors the backend's MODULE_ORDER.
 */
export const MODULE_ORDER: IEModuleKey[] = ['accounts', 'stakeholders', 'opportunities', 'actionItems'];

/** Worksheet (tab) name used in the workbook for each module. */
export const SHEET_NAMES: Record<IEModuleKey, string> = {
  accounts: 'Accounts',
  stakeholders: 'Stakeholders',
  opportunities: 'Opportunities',
  actionItems: 'Action Items',
};

/**
 * One row in the interactive import preview: the backend's verdict plus the
 * original parsed cells (kept client-side, joined by index) and the module it
 * belongs to, so the grid can group rows by worksheet.
 */
export interface WorkingImportRow extends ValidatedImportRow {
  module: IEModuleKey;
  raw: Record<string, any>;
}

/** Live per-row status recomputed as the user removes rows from the preview. */
export type LiveRowStatus = 'valid' | 'invalid' | 'existing' | 'file-duplicate';

/**
 * Live reference data used to resolve human-friendly values in a spreadsheet
 * (e.g. an account *name*) to the IDs the API expects, and to detect duplicates
 * against records that already exist.
 */
export interface RefData {
  accounts: Account[];
  opportunities: Opportunity[];
  actionItems: ActionItem[];
  stakeholders: Stakeholder[];
}

export type ImportFieldType =
  | 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'enum' | 'reference';

/** Declarative definition of one importable/templatable column. */
export interface ImportFieldDef {
  /** Payload key sent to the API (camelCase), e.g. 'name', 'accountId'. */
  key: string;
  /** User-friendly column header shown in templates and exported files. */
  header: string;
  type: ImportFieldType;
  required?: boolean;
  /** Allowed values for `enum` fields (canonical casing). */
  options?: readonly string[];
  /** Lowercased alias → canonical option, for friendlier enum input. */
  aliases?: Record<string, string>;
  /** For `reference` fields: which entity the human value resolves against. */
  reference?: 'account' | 'opportunity' | 'stakeholder';
  /** Extra format validation for `string` fields. */
  format?: 'email' | 'phone' | 'website';
  /** Applied when the cell is empty. */
  default?: string | number | boolean;
  /** Example value (used only for template guidance, never written as data). */
  example?: string;
  /** Short guidance appended to the template's notes sheet. */
  hint?: string;
}

/** A column that appears in EXPORTS (e.g. read-only Owner, joined names). */
export interface ExportColumn {
  /**
   * Matches the `ColumnConfig.key` of the corresponding table column, so a
   * config-driven export can resolve a displayed column to its value function.
   * Absent for export-only columns that have no table-column counterpart.
   */
  key?: string;
  header: string;
  value: (entity: any, ref: RefData) => string | number;
}

/** Everything needed to import/export/template one module. */
export interface ModuleIEConfig {
  moduleKey: IEModuleKey;
  /** Plural label, e.g. "Accounts". */
  label: string;
  /** Singular label, e.g. "Account". */
  singular: string;
  /** Import + template columns. */
  fields: ImportFieldDef[];
  /** Export columns (a superset of `fields`, incl. read-only/joined columns). */
  exportColumns: ExportColumn[];
  /** Human description of the natural key used for duplicate detection. */
  duplicateKeyLabel: string;
}

/** Which modules the user chose to include in an export. */
export type ExportSelection = Record<IEModuleKey, boolean>;
