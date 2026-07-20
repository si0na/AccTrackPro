/**
 * Parses an uploaded .xlsx / .csv workbook into per-module worksheets. Each of
 * the four known worksheets is matched by name (case/space/punctuation-tolerant)
 * and its data extracted; sheets that contain no data rows are ignored. SheetJS
 * is imported dynamically so the parser only loads when a user actually imports.
 */
import type { IEModuleKey } from '@/api/crm.api';
import { MODULE_ORDER, SHEET_NAMES } from './types';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
}
export type ParsedWorkbook = Partial<Record<IEModuleKey, ParsedSheet>>;

const MAX_ROWS = 20000;

export class FileParseError extends Error {}

/** Normalizes a worksheet name for tolerant matching. */
function normalizeName(name: string): string {
  return String(name).trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/** Accepted normalized names for each module (its sheet name and its key). */
function acceptedNames(module: IEModuleKey): Set<string> {
  return new Set([normalizeName(SHEET_NAMES[module]), normalizeName(module)]);
}

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const name = file.name.toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(name)) {
    throw new FileParseError('Unsupported file type. Please upload a .xlsx or .csv workbook.');
  }

  const XLSX = await import('xlsx');
  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  } catch {
    throw new FileParseError('The file could not be read — it may be corrupted or not a valid spreadsheet.');
  }

  if (!wb.SheetNames.length) throw new FileParseError('The file contains no worksheets.');

  const result: ParsedWorkbook = {};
  let totalRows = 0;

  for (const module of MODULE_ORDER) {
    const accepted = acceptedNames(module);
    const matched = wb.SheetNames.find((n) => accepted.has(normalizeName(n)));
    if (!matched) continue;

    const ws = wb.Sheets[matched];
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: '' });
    if (!aoa.length) continue;
    const headers = (aoa[0] as any[]).map((h) => String(h ?? '').trim()).filter((h) => h !== '');
    if (headers.length === 0) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: true });
    const nonEmpty = rows.filter((r) => Object.values(r).some((v) => v !== '' && v !== null && v !== undefined));
    if (nonEmpty.length === 0) continue; // ignore empty worksheet

    totalRows += nonEmpty.length;
    result[module] = { headers, rows: nonEmpty };
  }

  if (Object.keys(result).length === 0) {
    throw new FileParseError(
      'No worksheets with data were found. Expected sheets named Accounts, Stakeholders, ' +
        'Opportunities or Action Items — download the template for the correct layout.',
    );
  }
  if (totalRows > MAX_ROWS) {
    throw new FileParseError(
      `This workbook has ${totalRows.toLocaleString()} rows — the import limit is ${MAX_ROWS.toLocaleString()}.`,
    );
  }

  return result;
}
