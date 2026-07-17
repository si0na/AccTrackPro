import React from 'react';

export interface EmptyStateProps {
  /** Lucide icon element, e.g. <FileText className="w-6 h-6 text-slate-400" />. */
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  className?: string;
}

/**
 * Block-level empty state (panels, card lists): icon chip + title + hint.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, hint, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
    {icon && (
      <div className="p-3.5 bg-slate-50 rounded-2xl ring-1 ring-slate-200/70 mb-3.5">{icon}</div>
    )}
    <p className="text-sm font-semibold text-slate-600">{title}</p>
    {hint && <p className="text-xs text-slate-400 mt-1 max-w-sm">{hint}</p>}
  </div>
);

export interface EmptyRowProps {
  /** Number of columns the message must span. */
  colSpan: number;
  message: string;
}

/** Standard "no results" row for tables. */
export const EmptyRow: React.FC<EmptyRowProps> = ({ colSpan, message }) => (
  <tr>
    <td colSpan={colSpan} className="text-center py-14 text-sm text-slate-400 font-medium italic">
      {message}
    </td>
  </tr>
);
