import type { ColumnConfig } from '@/types';
import type { IEModuleKey } from '@/api/crm.api';
import { IE_CONFIGS } from './moduleConfigs';
import { SHEET_NAMES } from './types';
import type { ExportColumn, ModuleIEConfig, RefData } from './types';

/** SheetJS worksheet names: max 31 chars, no []:*?/\ characters. */
export function sheetName(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

export function autoWidths(headers: string[], rows: (string | number)[][]) {
  return headers.map((h, col) => ({
    wch: Math.max(h.length, ...rows.map((r) => String(r[col] ?? '').length), 10) + 2,
  }));
}

/** A fully-resolved export column: a header and a value extractor. */
interface ResolvedExportColumn {
  header: string;
  value: (entity: any, ref: RefData) => string | number;
}

/** Formats a custom-column value for export, matching the table cell renderers. */
function formatCustomValue(val: unknown, type: ColumnConfig['type']): string | number {
  if (type === 'boolean') return val ? 'Yes' : 'No';
  if (val === undefined || val === null || val === '') return '';
  if (type === 'number') return typeof val === 'number' ? val : Number(val) || String(val);
  return String(val);
}

/**
 * Resolves the columns an export should contain. When the caller passes the
 * view's live column config, the export mirrors exactly what the user sees —
 * only displayed columns, in their on-screen order, including any custom
 * columns (reference columns resolve to names via the module's value function;
 * custom columns read `entity[key]` formatted by type). Without a config it
 * falls back to the module's full export column set.
 */
export function buildExportColumns(
  config: ModuleIEConfig,
  columnConfig?: ColumnConfig[],
): ResolvedExportColumn[] {
  if (!columnConfig || columnConfig.length === 0) {
    return config.exportColumns.map((c) => ({ header: c.header, value: c.value }));
  }
  const byKey = new Map<string, ExportColumn>();
  for (const c of config.exportColumns) if (c.key) byKey.set(c.key, c);

  return columnConfig
    .filter((col) => col.isDisplayed)
    .map((col) => {
      const mapped = byKey.get(col.key);
      if (mapped) return { header: col.name, value: mapped.value };
      // Custom (or otherwise unmapped) column — read the raw value off the entity.
      return { header: col.name, value: (e: any) => formatCustomValue(e[col.key], col.type) };
    });
}

/** One module's contribution to the exported workbook. */
export interface ExportModuleInput {
  module: IEModuleKey;
  rows: any[];
  /** The view's persisted column configuration (displayed columns, order, custom columns). */
  columns?: ColumnConfig[];
}

/**
 * Builds ONE .xlsx workbook containing one worksheet per selected module
 * (user-friendly headers, current column order/config) and triggers the
 * download. Returns the per-module record counts for the audit log.
 */
export async function exportWorkbook(
  inputs: ExportModuleInput[],
  ref: RefData,
  fileName = 'CRM_Data.xlsx',
): Promise<{ module: IEModuleKey; count: number }[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const counts: { module: IEModuleKey; count: number }[] = [];

  for (const input of inputs) {
    const config = IE_CONFIGS[input.module];
    const cols = buildExportColumns(config, input.columns);
    const headers = cols.map((c) => c.header);
    const data = input.rows.map((e) => cols.map((c) => c.value(e, ref)));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = autoWidths(headers, data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(SHEET_NAMES[input.module]));
    counts.push({ module: input.module, count: input.rows.length });
  }

  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
  return counts;
}
