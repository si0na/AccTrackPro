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
    {icon && <div className="p-3 bg-slate-100 rounded-xl mb-3">{icon}</div>}
    <p className="text-sm font-semibold text-slate-500">{title}</p>
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
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
    <td colSpan={colSpan} className="text-center py-12 text-sm text-slate-400 font-medium">
      {message}
    </td>
  </tr>
);
