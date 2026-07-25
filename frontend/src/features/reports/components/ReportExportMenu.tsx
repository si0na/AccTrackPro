/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui';

export interface ReportExportMenuProps {
  label?: string;
  onExportPdf: () => void;
  onExportXlsx: () => void;
  disabled?: boolean;
}

/**
 * Minimal feature-scoped export popover (PDF / Excel) — no generic Dropdown
 * primitive exists elsewhere in the app, so this is deliberately kept small
 * and local rather than introducing one. If a second feature later needs the
 * same affordance, promote this to `@/components/ui`.
 */
export const ReportExportMenu: React.FC<ReportExportMenuProps> = ({
  label = 'Export',
  onExportPdf,
  onExportXlsx,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="secondary"
        size="xs"
        icon={<Download className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        {label}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-44 bg-white rounded-lg border border-slate-200 shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onExportPdf();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
            Export as PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onExportXlsx();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            Export as Excel
          </button>
        </div>
      )}
    </div>
  );
};
