import type { ColumnConfig } from '@/types';
import type { IEModuleKey } from '@/api/crm.api';
import { IE_CONFIGS } from './moduleConfigs';
import { SHEET_NAMES } from './types';
import type { ExportColumn, ModuleIEConfig, RefData } from './types';

/** SheetJS worksheet names: max 31 chars, no []:*?/\ characters. */
export function sheetName(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

export function autoWidths(headers: string[], rows: (string | number)[][], maxColWidth = 40) {
  return headers.map((h, col) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[col] ?? '').length), 10);
    return { wch: Math.min(maxLen + 2, maxColWidth) };
  });
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
    let exportRows = input.rows;
    if (input.module === 'actionItems') {
      // Global export ONLY exports Account Management Action Items (projectId IS NULL).
      exportRows = input.rows.filter((r) => !r.projectId);
    }
    const cols = buildExportColumns(config, input.columns).filter(
      (c) => c.header !== 'Project' && c.header !== 'Project Name',
    );
    const headers = cols.map((c) => c.header);
    const data = exportRows.map((e) => cols.map((c) => c.value(e, ref)));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = autoWidths(headers, data, 40);

    // Apply wrapText alignment to data cells so long text wraps cleanly
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          if (ws[cellAddr]) {
            ws[cellAddr].s = {
              ...(ws[cellAddr].s || {}),
              alignment: { wrapText: true, vertical: 'top' },
            };
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName(SHEET_NAMES[input.module]));
    counts.push({ module: input.module, count: exportRows.length });
  }

  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
  return counts;
}
