import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Copy, Database, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { IEModuleKey } from '@/api/crm.api';
import type { ImportFieldDef, LiveRowStatus, WorkingImportRow } from './types';

const PAGE_SIZE = 100;

export const rowKeyOf = (r: WorkingImportRow): string => `${r.module}:${r.index}`;
/** In-file duplicate groups are numbered per-sheet, so namespace them by module. */
export const groupKeyOf = (module: IEModuleKey, group: string): string => `${module}:${group}`;

export interface ModuleGroup {
  module: IEModuleKey;
  label: string;
  previewFields: ImportFieldDef[];
  rows: WorkingImportRow[];
}

interface ImportPreviewGridProps {
  groups: ModuleGroup[];
  liveStatus: (row: WorkingImportRow) => LiveRowStatus;
  /** Members remaining per (namespaced) in-file duplicate group. */
  liveGroupCounts: Record<string, number>;
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onSetSelection: (keys: string[], additive: boolean) => void;
  onRemove: (keys: string[]) => void;
  onKeepOnly: (row: WorkingImportRow) => void;
}

function displayValue(row: WorkingImportRow, field: ImportFieldDef): string {
  if (field.reference === 'account') return String(row.refNames.account ?? row.raw[field.header] ?? '');
  if (field.reference === 'opportunity') return String(row.refNames.opportunity ?? row.raw[field.header] ?? '');
  const v = row.payload[field.key] ?? row.raw[field.header];
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

const StatusChip: React.FC<{ status: LiveRowStatus }> = ({ status }) => {
  switch (status) {
    case 'valid':
      return <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" />Valid</span>;
    case 'invalid':
      return <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="w-3.5 h-3.5" />Invalid</span>;
    case 'existing':
      return <span className="inline-flex items-center gap-1 text-purple-700"><Database className="w-3.5 h-3.5" />Existing</span>;
    case 'file-duplicate':
      return <span className="inline-flex items-center gap-1 text-amber-700"><Copy className="w-3.5 h-3.5" />Duplicate</span>;
  }
};

function messageFor(row: WorkingImportRow, status: LiveRowStatus): React.ReactNode {
  if (status === 'invalid') return <span className="text-red-600">{row.errors.join('; ')}</span>;
  if (status === 'existing') return <span className="text-purple-600">Matches a record already in the system — it will be skipped on import.</span>;
  if (status === 'file-duplicate') return <span className="text-amber-600">Duplicates another row in this workbook — keep one.</span>;
  return <span className="text-slate-400">—</span>;
}

const rowTone = (status: LiveRowStatus) =>
  status === 'invalid' ? 'bg-red-50/40'
    : status === 'existing' ? 'bg-purple-50/40'
    : status === 'file-duplicate' ? 'bg-amber-50/40'
    : '';

const ModuleSection: React.FC<{
  group: ModuleGroup;
  liveStatus: ImportPreviewGridProps['liveStatus'];
  liveGroupCounts: Record<string, number>;
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onSetSelection: (keys: string[], additive: boolean) => void;
  onRemove: (keys: string[]) => void;
  onKeepOnly: (row: WorkingImportRow) => void;
}> = ({ group, liveStatus, liveGroupCounts, selected, onToggleSelect, onSetSelection, onRemove, onKeepOnly }) => {
  const [page, setPage] = useState(1);
  const { module, label, previewFields, rows } = group;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );
  const allKeys = rows.map(rowKeyOf);
  const allSelected = rows.length > 0 && allKeys.every((k) => selected.has(k));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-700">{label}</p>
        <span className="text-[11px] font-semibold text-slate-400">{rows.length.toLocaleString()} row(s)</span>
      </div>
      <div className="max-h-[22rem] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  aria-label={`Select all ${label} rows`}
                  checked={allSelected}
                  onChange={(e) => onSetSelection(allKeys, e.target.checked)}
                />
              </th>
              <th className="px-3 py-2 text-left font-bold w-10">#</th>
              <th className="px-3 py-2 text-left font-bold w-24">Status</th>
              {previewFields.map((f) => (
                <th key={f.key} className="px-3 py-2 text-left font-bold">{f.header}</th>
              ))}
              <th className="px-3 py-2 text-left font-bold">Messages</th>
              <th className="px-3 py-2 text-center font-bold w-16">Remove</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const key = rowKeyOf(row);
              const status = liveStatus(row);
              const inLiveGroup =
                !!row.fileDupGroup && (liveGroupCounts[groupKeyOf(module, row.fileDupGroup)] ?? 0) > 1;
              return (
                <tr key={key} className={`border-b border-slate-100 ${rowTone(status)}`}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${label} row ${row.rowNumber}`}
                      checked={selected.has(key)}
                      onChange={() => onToggleSelect(key)}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-slate-400 font-mono">{row.rowNumber}</td>
                  <td className="px-3 py-1.5 font-semibold"><StatusChip status={status} /></td>
                  {previewFields.map((f) => (
                    <td key={f.key} className="px-3 py-1.5 text-slate-600 max-w-[160px] truncate" title={displayValue(row, f)}>
                      {displayValue(row, f)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 max-w-[280px]">
                    <div className="flex flex-col gap-1">
                      {messageFor(row, status)}
                      {status === 'file-duplicate' && inLiveGroup && (
                        <button
                          type="button"
                          className="self-start text-[11px] font-bold text-amber-700 hover:underline"
                          onClick={() => onKeepOnly(row)}
                        >
                          Keep only this one
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button
                      type="button"
                      aria-label={`Remove ${label} row ${row.rowNumber}`}
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onRemove([key])}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            <span className="px-1 font-semibold">{currentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ImportPreviewGrid: React.FC<ImportPreviewGridProps> = ({ groups, ...handlers }) => (
  <div className="space-y-4">
    {groups.map((group) => (
      <ModuleSection key={group.module} group={group} {...handlers} />
    ))}
  </div>
);
