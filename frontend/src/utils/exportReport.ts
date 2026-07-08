/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared client-side report exporter used by the reporting pages (Forecast,
 * Reports). Each page builds a ReportDefinition from the data it currently
 * displays (all applied filters included) and hands it to one of the two
 * renderers below — the same structure drives both the XLSX and PDF output,
 * so there is a single source of truth for what an exported report contains.
 *
 * The heavy generator libraries (SheetJS, jsPDF) are imported dynamically so
 * they load only when a user actually exports, not with the main bundle.
 */

export interface ReportSection {
  /** Section heading — also used as the worksheet name in XLSX output. */
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface ReportDefinition {
  title: string;
  /** Period / filter description, e.g. "FY 2026-27 — Q1 · All Accounts". */
  subtitle: string;
  /** Base file name without extension. */
  fileName: string;
  sections: ReportSection[];
}

/** Exact currency for exports — no M/K rounding, so figures can be audited. */
export function exportCurrency(val: number): string {
  return val.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/** Worksheet names: max 31 chars, no []:*?/\ characters. */
function sheetName(title: string, index: number): string {
  const clean = title.replace(/[[\]:*?/\\]/g, ' ').trim();
  return clean.length > 31 ? `${index + 1}. ${clean}`.slice(0, 31) : clean;
}

export async function exportReportToXlsx(report: ReportDefinition): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  report.sections.forEach((section, i) => {
    const ws = XLSX.utils.aoa_to_sheet([
      [report.title],
      [report.subtitle],
      [],
      section.headers,
      ...section.rows,
    ]);
    // Size columns to the widest cell so exported sheets open readable.
    ws['!cols'] = section.headers.map((h, col) => ({
      wch: Math.max(
        h.length,
        ...section.rows.map((r) => String(r[col] ?? '').length),
        12,
      ) + 2,
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName(section.title, i));
  });
  XLSX.writeFile(wb, `${report.fileName}.xlsx`);
}

export async function exportReportToPdf(report: ReportDefinition): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  const marginX = 14;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, marginX, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(report.subtitle, marginX, 25);
  doc.setTextColor(0);

  let y = 33;
  report.sections.forEach((section) => {
    // Keep the section heading attached to its table on page breaks.
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, marginX, y);
    autoTable(doc, {
      startY: y + 3,
      head: [section.headers],
      body: section.rows.map((r) => r.map((c) => String(c))),
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  });

  doc.save(`${report.fileName}.pdf`);
}

/** "Revenue Forecast", "FY 2026-27 — Q1", "Acme Corp" → revenue-forecast_fy-2026-27-q1_acme-corp */
export function buildExportFileName(...parts: string[]): string {
  return parts
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('_');
}
