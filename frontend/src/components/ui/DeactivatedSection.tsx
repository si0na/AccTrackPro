import React, { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface DeactivatedSectionProps {
  /** Section heading, e.g. "Deactivated Accounts". */
  title: string;
  count: number;
  /** Collapsible body (usually a table of soft-deleted rows). */
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

/**
 * Collapsible card listing soft-deleted records with a count chip — shared by
 * the Accounts, Opportunities, Action Items, and Stakeholders views.
 */
export const DeactivatedSection: React.FC<DeactivatedSectionProps> = ({
  title,
  count,
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-2.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
          )}
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      </button>
      {expanded && (
        <div id={bodyId} className="border-t border-slate-100 overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
};
