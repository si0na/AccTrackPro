import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Modal, ModalFooter, Button } from '@/components/ui';
import type { IEModuleKey } from '@/api/crm.api';
import { IE_CONFIGS } from './moduleConfigs';
import { MODULE_ORDER } from './types';
import type { ExportSelection } from './types';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Record count available per module (shown next to each checkbox). */
  counts: Record<IEModuleKey, number>;
  busy: boolean;
  onConfirm: (selection: ExportSelection) => void;
}

const allSelected = (): ExportSelection => ({
  accounts: true, stakeholders: true, opportunities: true, actionItems: true,
});

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, counts, busy, onConfirm }) => {
  const [selection, setSelection] = useState<ExportSelection>(allSelected);

  // The dialog stays mounted across opens, so reset the module selection to its
  // default (everything checked) each time it reopens — otherwise the previous
  // session's toggles would linger.
  useEffect(() => {
    if (isOpen) setSelection(allSelected());
  }, [isOpen]);

  const toggle = (m: IEModuleKey) => setSelection((prev) => ({ ...prev, [m]: !prev[m] }));
  const chosen = MODULE_ORDER.filter((m) => selection[m]);
  const totalRecords = chosen.reduce((sum, m) => sum + (counts[m] ?? 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Export CRM Workbook"
      icon={<Download className="w-5 h-5 text-blue-600" aria-hidden="true" />}
      maxWidth="max-w-lg"
    >
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-slate-500">
          Choose the worksheets to include. A single <span className="font-semibold text-slate-700">CRM_Data.xlsx</span> workbook
          will be generated with one sheet per selected module, using your current column configuration.
        </p>

        <div className="space-y-2">
          {MODULE_ORDER.map((m) => (
            <label
              key={m}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                selection[m] ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selection[m]} onChange={() => toggle(m)} className="w-4 h-4" />
                <FileSpreadsheet className={`w-4 h-4 ${selection[m] ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="text-sm font-semibold text-slate-700">{IE_CONFIGS[m].label}</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">{(counts[m] ?? 0).toLocaleString()} record(s)</span>
            </label>
          ))}
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          icon={busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          disabled={chosen.length === 0 || busy}
          onClick={() => onConfirm(selection)}
        >
          {busy ? 'Exporting…' : `Export ${totalRecords.toLocaleString()} record(s)`}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
