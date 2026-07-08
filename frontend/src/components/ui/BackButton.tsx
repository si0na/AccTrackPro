import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface BackButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * Standard "Back to …" navigation button used at the top of views that are
 * reached from another screen (dashboard drill-downs, notifications, details).
 */
export const BackButton: React.FC<BackButtonProps> = ({ label, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold transition-all cursor-pointer bg-slate-100 hover:bg-slate-200/70 px-3 py-1.5 rounded-lg border border-slate-200 ${className}`}
  >
    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
    <span>{label}</span>
  </button>
);
