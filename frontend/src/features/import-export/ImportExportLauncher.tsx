import React, { useState } from 'react';
import {
  ArrowDownUp, Download, Upload, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { useCRM } from '@/contexts/CRMContext';
import type { ColumnConfig } from '@/types';
import { importExportApi, type IEModuleKey } from '@/api/crm.api';
import { IE_CONFIGS } from './moduleConfigs';
import { MODULE_ORDER } from './types';
import type { ExportSelection, RefData } from './types';
import { exportWorkbook, type ExportModuleInput } from './workbookExport';
import { ExportDialog } from './ExportDialog';
import { ImportWizard } from './ImportWizard';

/**
 * Globally-accessible Import / Export entry point. Renders a top-navbar button
 * that opens a compact chooser modal (instead of navigating to a standalone
 * page). The chooser is a minimal two-action launcher — Export and Import —
 * each of which continues directly into the unchanged Export (module picker →
 * single workbook) or Import (upload → server-side validation → interactive
 * preview → commit) workflow.
 */
export const ImportExportLauncher: React.FC = () => {
  const {
    accounts, opportunities, actionItems, stakeholders,
    accountsColumnConfig, opportunitiesColumnConfig, actionItemsColumnConfig,
    refreshData,
  } = useCRM();

  const [hubOpen, setHubOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  // Always open the hub from a clean slate — no stale success message from a
  // previous export session should ever be visible on reopen.
  const openHub = () => {
    setLastExport(null);
    setHubOpen(true);
  };

  // Closing the hub (X, Cancel, overlay click, or Esc — all routed through the
  // Modal's onClose) tears down every transient bit of state so the next open
  // starts from the initial Import / Export chooser.
  const closeHub = () => {
    setHubOpen(false);
    setLastExport(null);
  };

  const refData: RefData = { accounts, opportunities, actionItems, stakeholders };

  const rowsFor: Record<IEModuleKey, any[]> = {
    accounts, stakeholders, opportunities, actionItems,
  };
  const columnsFor: Record<IEModuleKey, ColumnConfig[] | undefined> = {
    accounts: accountsColumnConfig,
    opportunities: opportunitiesColumnConfig,
    actionItems: actionItemsColumnConfig,
    stakeholders: undefined, // Stakeholders has no column customization
  };
  const counts: Record<IEModuleKey, number> = {
    accounts: accounts.length,
    stakeholders: stakeholders.length,
    opportunities: opportunities.length,
    actionItems: actionItems.length,
  };

  const doExport = async (selection: ExportSelection) => {
    if (exporting) return;
    setExporting(true);
    try {
      const inputs: ExportModuleInput[] = MODULE_ORDER
        .filter((m) => selection[m])
        .map((m) => ({ module: m, rows: rowsFor[m], columns: columnsFor[m] }));
      const written = await exportWorkbook(inputs, refData);
      void importExportApi.logExport(written);
      setLastExport(
        `Exported ${written.map((w) => `${w.count} ${IE_CONFIGS[w.module].label}`).join(', ')} to CRM_Data.xlsx`,
      );
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Navbar trigger — matches the global header's action-button styling */}
      <button
        onClick={openHub}
        title="Import / Export"
        className="flex items-center gap-2 h-9 px-2.5 md:px-3 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
      >
        <ArrowDownUp className="w-4 h-4" />
        <span className="hidden md:inline text-xs font-semibold">Import / Export</span>
      </button>

      <Modal
        isOpen={hubOpen}
        onClose={closeHub}
        title="Import / Export"
        icon={<ArrowDownUp className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        maxWidth="max-w-md"
      >
        <div className="p-5 space-y-3">
          {/* Export — continues into the unchanged export module picker. */}
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors text-left cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/15 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900">Export</h3>
              <p className="text-xs text-slate-500">Download your data as an Excel workbook.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />
          </button>

          {/* Import — continues into the unchanged upload → validate → preview wizard. */}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="group w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors text-left cursor-pointer"
          >
            <div className="w-11 h-11 rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900">Import</h3>
              <p className="text-xs text-slate-500">Upload an Excel workbook to add records.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-400 transition-colors shrink-0" />
          </button>

          {lastExport && (
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium px-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {lastExport}
            </p>
          )}
        </div>
      </Modal>

      <ExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        counts={counts}
        busy={exporting}
        onConfirm={(sel) => void doExport(sel)}
      />
      <ImportWizard
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onCompleted={() => { void refreshData(); }}
      />
    </>
  );
};
