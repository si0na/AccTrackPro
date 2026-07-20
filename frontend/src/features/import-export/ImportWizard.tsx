import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, XCircle, Download,
  ArrowRight, ArrowLeft, Loader2, PartyPopper, Trash2, CopyX, ShieldX,
} from 'lucide-react';
import { Modal, ModalFooter, Button } from '@/components/ui';
import {
  importExportApi,
  type IEModuleKey,
  type WorkbookValidation,
  type WorkbookImportRequest,
  type WorkbookImportResult,
} from '@/api/crm.api';
import type { LiveRowStatus, WorkingImportRow } from './types';
import { MODULE_ORDER } from './types';
import { IE_CONFIGS } from './moduleConfigs';
import { parseWorkbook, FileParseError, type ParsedWorkbook } from './workbookParse';
import { downloadTemplate } from './workbookTemplate';
import { ImportPreviewGrid, rowKeyOf, groupKeyOf, type ModuleGroup } from './ImportPreviewGrid';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a completed import so the caller can refresh its data. */
  onCompleted: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'preview', label: 'Review & Fix' },
  { key: 'done', label: 'Import' },
];

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-2xl font-extrabold tracking-tight">{value.toLocaleString()}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose, onCompleted }) => {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false); // parsing + validating
  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<WorkbookValidation | null>(null);
  const [workingRows, setWorkingRows] = useState<WorkingImportRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<WorkbookImportResult | null>(null);
  const [failedDetails, setFailedDetails] = useState<{ label: string; rowNumber: number; message: string }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload'); setFileName(''); setBusy(false); setParseError(null);
    setValidation(null); setWorkingRows([]); setSelected(new Set()); setDragging(false);
    setOutcome(null); setFailedDetails([]); setImportError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'importing') return; // don't allow closing mid-import
    reset();
    onClose();
  }, [step, reset, onClose]);

  // The wizard stays mounted across opens, so every open must start from a clean
  // slate — no stale upload, validation, preview, or completion state from a
  // prior import session. reset() is also called on close, but this guards any
  // path that could reopen without a preceding reset.
  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  // Members remaining per (namespaced) in-file duplicate group.
  const liveGroupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of workingRows) {
      if (r.fileDupGroup) {
        const k = groupKeyOf(r.module, r.fileDupGroup);
        m[k] = (m[k] ?? 0) + 1;
      }
    }
    return m;
  }, [workingRows]);

  const liveStatus = useCallback((row: WorkingImportRow): LiveRowStatus => {
    if (row.status === 'invalid') return 'invalid';
    if (row.existsInSystem) return 'existing';
    if (row.fileDupGroup && (liveGroupCounts[groupKeyOf(row.module, row.fileDupGroup)] ?? 0) > 1) return 'file-duplicate';
    return 'valid';
  }, [liveGroupCounts]);

  // Live summary across every worksheet — recomputed on each removal.
  const summary = useMemo(() => {
    let valid = 0, invalid = 0, existing = 0, fileDup = 0, ready = 0;
    const groupsCounted = new Set<string>();
    for (const r of workingRows) {
      const s = liveStatus(r);
      if (s === 'invalid') { invalid++; continue; }
      if (s === 'existing') { existing++; continue; }
      if (s === 'file-duplicate') {
        fileDup++;
        const k = groupKeyOf(r.module, r.fileDupGroup!);
        if (!groupsCounted.has(k)) { groupsCounted.add(k); ready++; }
      } else { valid++; ready++; }
    }
    return { valid, invalid, existing, fileDup, duplicates: existing + fileDup, ready };
  }, [workingRows, liveStatus]);

  const totalUploaded = useMemo(
    () => Object.values(validation ?? {}).reduce((sum, v) => sum + (v?.total ?? 0), 0),
    [validation],
  );

  const detectedModules = useMemo(
    () => MODULE_ORDER.filter((m) => (validation?.[m]?.total ?? 0) > 0),
    [validation],
  );

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setParseError(null);
    try {
      const parsed: ParsedWorkbook = await parseWorkbook(file);
      const sheets = Object.fromEntries(
        MODULE_ORDER.filter((m) => parsed[m]).map((m) => [m, { rows: parsed[m]!.rows, headers: parsed[m]!.headers }]),
      );
      const result = await importExportApi.validate(sheets);

      const rows: WorkingImportRow[] = [];
      for (const module of MODULE_ORDER) {
        const v = result[module];
        if (!v) continue;
        const raw = parsed[module]?.rows ?? [];
        for (const r of v.rows) rows.push({ ...r, module, raw: raw[r.index] ?? {} });
      }
      setFileName(file.name);
      setValidation(result);
      setWorkingRows(rows);
      setSelected(new Set());
      setStep('preview');
    } catch (err: any) {
      if (err instanceof FileParseError) setParseError(err.message);
      else {
        const raw = err?.response?.data?.message;
        setParseError(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : 'Validation failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  // ── Row-management actions (operate on the full working set, keyed by rowKey) ─
  const removeKeys = useCallback((keys: string[]) => {
    const drop = new Set(keys);
    setWorkingRows((prev) => prev.filter((r) => !drop.has(rowKeyOf(r))));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const setSelection = useCallback((keys: string[], additive: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (additive) keys.forEach((k) => next.add(k));
      else keys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  const removeAllInvalid = useCallback(() => {
    removeKeys(workingRows.filter((r) => liveStatus(r) === 'invalid').map(rowKeyOf));
  }, [workingRows, liveStatus, removeKeys]);

  const removeAllDuplicates = useCallback(() => {
    removeKeys(
      workingRows.filter((r) => {
        const s = liveStatus(r);
        return s === 'existing' || s === 'file-duplicate';
      }).map(rowKeyOf),
    );
  }, [workingRows, liveStatus, removeKeys]);

  const keepOnly = useCallback((row: WorkingImportRow) => {
    if (!row.fileDupGroup) return;
    removeKeys(
      workingRows
        .filter((r) => r.module === row.module && r.fileDupGroup === row.fileDupGroup && r.index !== row.index)
        .map(rowKeyOf),
    );
  }, [workingRows, removeKeys]);

  const groups: ModuleGroup[] = useMemo(
    () =>
      MODULE_ORDER
        .map((module) => ({
          module,
          label: IE_CONFIGS[module].label,
          previewFields: IE_CONFIGS[module].fields.slice(0, 5),
          rows: workingRows.filter((r) => r.module === module),
        }))
        .filter((g) => g.rows.length > 0),
    [workingRows],
  );

  const runImport = useCallback(async () => {
    // Send every remaining row that isn't invalid; the backend skips existing
    // records and honours the dependency order (accounts → … → action items).
    const toSend = workingRows.filter((r) => liveStatus(r) !== 'invalid');
    if (toSend.length === 0) return;

    const modules: WorkbookImportRequest = {};
    const sentMeta: Partial<Record<IEModuleKey, { rowNumber: number }[]>> = {};
    for (const module of MODULE_ORDER) {
      const rows = toSend.filter((r) => r.module === module);
      if (rows.length === 0) continue;
      modules[module] = rows.map((r) => r.payload);
      sentMeta[module] = rows.map((r) => ({ rowNumber: r.rowNumber }));
    }

    setStep('importing');
    setImportError(null);
    try {
      const result = await importExportApi.importWorkbook(modules, 'skip');
      const failures: { label: string; rowNumber: number; message: string }[] = [];
      for (const module of MODULE_ORDER) {
        const outcomeForModule = result[module];
        if (!outcomeForModule) continue;
        const label = IE_CONFIGS[module].label;
        for (const r of outcomeForModule.results) {
          if (r.status === 'failed') {
            failures.push({
              label,
              rowNumber: sentMeta[module]?.[r.index]?.rowNumber ?? r.index + 1,
              message: r.message ?? 'Import failed',
            });
          }
        }
      }
      setOutcome(result);
      setFailedDetails(failures);
      setStep('done');
      onCompleted();
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setImportError(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : 'The import failed. Please try again.');
      setStep('preview');
    }
  }, [workingRows, liveStatus, onCompleted]);

  const currentStepIndex = step === 'upload' ? 0 : step === 'preview' ? 1 : 2;

  const totals = useMemo(() => {
    const o = outcome ?? {};
    return MODULE_ORDER.reduce(
      (acc, m) => {
        const r = o[m];
        if (!r) return acc;
        acc.created += r.created; acc.updated += r.updated; acc.skipped += r.skipped; acc.failed += r.failed;
        return acc;
      },
      { created: 0, updated: 0, skipped: 0, failed: 0 },
    );
  }, [outcome]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import CRM Workbook"
      icon={<Upload className="w-5 h-5 text-blue-600" aria-hidden="true" />}
      maxWidth="max-w-5xl"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 px-6 pt-5">
        {STEP_LABELS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-2 text-xs font-bold ${i <= currentStepIndex ? 'text-blue-600' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${i <= currentStepIndex ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {i + 1}
              </span>
              {s.label}
            </div>
            {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>

      <div className="px-6 py-5">
        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors ${
                dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              {busy ? (
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" aria-hidden="true" />
              ) : (
                <FileSpreadsheet className="w-10 h-10 text-slate-400" aria-hidden="true" />
              )}
              <p className="text-sm font-bold text-slate-700">
                {busy ? 'Reading & validating…' : 'Drag & drop your workbook here, or click to browse'}
              </p>
              <p className="text-xs text-slate-400">
                One .xlsx workbook with any of: Accounts, Stakeholders, Opportunities, Action Items
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (inputRef.current) inputRef.current.value = '';
                  if (f) void handleFile(f);
                }}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500">
                Not sure about the format? Download the template — one workbook with all four worksheets.
              </div>
              <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={() => void downloadTemplate()}>
                Download Template
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review & Fix ───────────────────────────────────────── */}
        {step === 'preview' && validation && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{fileName}</span> — worksheets detected:{' '}
                <span className="font-semibold text-slate-700">
                  {detectedModules.map((m) => IE_CONFIGS[m].label).join(', ')}
                </span>. Validated against your existing data.
              </p>
              <button className="text-xs font-bold text-blue-600 hover:underline" onClick={reset}>
                Choose a different file
              </button>
            </div>

            {/* Live summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total uploaded" value={totalUploaded} tone="border-slate-200 bg-slate-50 text-slate-700" />
              <StatCard label="Valid" value={summary.valid} tone="border-green-200 bg-green-50 text-green-700" />
              <StatCard label="Invalid" value={summary.invalid} tone="border-red-200 bg-red-50 text-red-700" />
              <StatCard label="File duplicates" value={summary.fileDup} tone="border-amber-200 bg-amber-50 text-amber-700" />
              <StatCard label="Existing records" value={summary.existing} tone="border-purple-200 bg-purple-50 text-purple-700" />
              <StatCard label="Ready to import" value={summary.ready} tone="border-blue-200 bg-blue-50 text-blue-700" />
            </div>

            {importError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{importError}</span>
              </div>
            )}

            {/* Bulk row actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-1">
                {selected.size > 0 ? `${selected.size} selected` : 'Manage rows:'}
              </span>
              <Button
                variant="secondary" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}
                disabled={selected.size === 0}
                onClick={() => removeKeys([...selected])}
              >
                Remove selected
              </Button>
              <Button
                variant="secondary" size="sm" icon={<ShieldX className="w-3.5 h-3.5 text-red-500" />}
                disabled={summary.invalid === 0}
                onClick={removeAllInvalid}
              >
                Remove all invalid ({summary.invalid})
              </Button>
              <Button
                variant="secondary" size="sm" icon={<CopyX className="w-3.5 h-3.5 text-amber-500" />}
                disabled={summary.duplicates === 0}
                onClick={removeAllDuplicates}
              >
                Remove all duplicates ({summary.duplicates})
              </Button>
            </div>

            <ImportPreviewGrid
              groups={groups}
              liveStatus={liveStatus}
              liveGroupCounts={liveGroupCounts}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSetSelection={setSelection}
              onRemove={removeKeys}
              onKeepOnly={keepOnly}
            />

            <p className="text-xs text-slate-500">
              {summary.ready.toLocaleString()} record(s) ready to import.
              {summary.existing > 0 && <> {summary.existing.toLocaleString()} existing record(s) will be skipped.</>}
              {summary.invalid > 0 && <> {summary.invalid.toLocaleString()} invalid row(s) will not be imported.</>}
            </p>
          </div>
        )}

        {/* ── Step 3: Importing ──────────────────────────────────────────── */}
        {step === 'importing' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-700">Importing your workbook…</p>
            <div className="w-full max-w-md h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full w-1/3 bg-blue-600 rounded-full animate-pulse" style={{ width: '66%' }} />
            </div>
            <p className="text-xs text-slate-400">Processing worksheets in dependency order — this may take a moment.</p>
          </div>
        )}

        {/* ── Step 4: Done ───────────────────────────────────────────────── */}
        {step === 'done' && outcome && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-2 py-2">
              <PartyPopper className="w-9 h-9 text-green-600" aria-hidden="true" />
              <p className="text-base font-extrabold text-slate-800">Import complete</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Created" value={totals.created} tone="border-green-200 bg-green-50 text-green-700" />
              <StatCard label="Updated" value={totals.updated} tone="border-blue-200 bg-blue-50 text-blue-700" />
              <StatCard label="Skipped" value={totals.skipped} tone="border-amber-200 bg-amber-50 text-amber-700" />
              <StatCard label="Failed" value={totals.failed} tone="border-red-200 bg-red-50 text-red-700" />
            </div>

            {/* Per-module breakdown */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold">Worksheet</th>
                    <th className="px-4 py-2 text-right font-bold">Created</th>
                    <th className="px-4 py-2 text-right font-bold">Updated</th>
                    <th className="px-4 py-2 text-right font-bold">Skipped</th>
                    <th className="px-4 py-2 text-right font-bold">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULE_ORDER.filter((m) => outcome[m]).map((m) => {
                    const r = outcome[m]!;
                    return (
                      <tr key={m} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-semibold text-slate-700">{IE_CONFIGS[m].label}</td>
                        <td className="px-4 py-2 text-right text-green-700">{r.created}</td>
                        <td className="px-4 py-2 text-right text-blue-700">{r.updated}</td>
                        <td className="px-4 py-2 text-right text-amber-700">{r.skipped}</td>
                        <td className="px-4 py-2 text-right text-red-700">{r.failed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {failedDetails.length > 0 && (
              <div className="rounded-xl border border-red-200 overflow-hidden">
                <p className="px-4 py-2 bg-red-50 text-xs font-bold text-red-700 border-b border-red-200">
                  {failedDetails.length} row(s) failed
                </p>
                <div className="max-h-52 overflow-auto divide-y divide-slate-100">
                  {failedDetails.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 px-4 py-2 text-xs">
                      <span className="font-bold text-slate-500 shrink-0">{f.label} · Row {f.rowNumber}</span>
                      <span className="text-red-600">{f.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        {step === 'upload' && (
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
        )}
        {step === 'preview' && (
          <>
            <Button variant="secondary" icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={reset}>Back</Button>
            <Button
              icon={<ArrowRight className="w-3.5 h-3.5" />}
              disabled={summary.ready === 0}
              onClick={() => void runImport()}
            >
              Import {summary.ready.toLocaleString()} record(s)
            </Button>
          </>
        )}
        {step === 'importing' && <Button disabled>Importing…</Button>}
        {step === 'done' && <Button onClick={handleClose}>Done</Button>}
      </ModalFooter>
    </Modal>
  );
};
