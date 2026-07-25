import { IE_CONFIGS } from './moduleConfigs';
import { MODULE_ORDER, SHEET_NAMES } from './types';
import type { ImportFieldDef } from './types';
import { autoWidths, sheetName } from './workbookExport';

function allowedText(f: ImportFieldDef): string {
  if (f.options) return f.options.join(' | ');
  if (f.reference === 'account') return 'Account name (this workbook or existing)';
  if (f.reference === 'opportunity') return 'Opportunity name within the account (optional)';
  if (f.reference === 'stakeholder') return 'Stakeholder name on the account (this workbook or existing)';
  switch (f.type) {
    case 'boolean': return 'Yes | No';
    case 'date': return 'YYYY-MM-DD';
    case 'number': return 'Number';
    case 'integer': return 'Whole number';
    default:
      if (f.format === 'email') return 'Email address';
      if (f.format === 'phone') return 'Phone number';
      if (f.format === 'website') return 'URL';
      return 'Text';
  }
}

/**
 * Downloads the single standard import template: one .xlsx workbook with all
 * four worksheets (Accounts, Stakeholders, Opportunities, Action Items), each
 * containing only its column headers (no sample data), plus an Instructions
 * worksheet describing every column of every sheet. Header cells match the
 * field headers exactly so a filled-in template re-imports without edits.
 */
export async function downloadTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  for (const module of MODULE_ORDER) {
    const config = IE_CONFIGS[module];
    const headers = config.fields.map((f) => f.header);
    const ws = XLSX.utils.aoa_to_sheet([headers]); // headers only — no sample data
    ws['!cols'] = autoWidths(headers, []);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(SHEET_NAMES[module]));
  }

  const instrHeader = ['Worksheet', 'Column', 'Required', 'Allowed values / format', 'Notes'];
  const instrRows: string[][] = [];
  for (const module of MODULE_ORDER) {
    for (const f of IE_CONFIGS[module].fields) {
      instrRows.push([SHEET_NAMES[module], f.header, f.required ? 'Yes' : 'No', allowedText(f), f.hint ?? '']);
    }
  }
  const wsInstr = XLSX.utils.aoa_to_sheet([instrHeader, ...instrRows]);
  wsInstr['!cols'] = autoWidths(instrHeader, instrRows);
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  XLSX.writeFile(wb, 'CRM_Import_Template.xlsx');
}
