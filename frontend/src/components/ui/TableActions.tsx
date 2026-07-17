import React from 'react';
import { Eye, Pencil, Trash2, RotateCcw } from 'lucide-react';

export type RowActionIntent = 'view' | 'edit' | 'delete' | 'download' | 'neutral';

const INTENT_CLS: Record<RowActionIntent, string> = {
  view: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
  edit: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
  delete: 'bg-red-50 text-red-500 hover:bg-red-100',
  download: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
  neutral: 'bg-slate-100 text-slate-500 hover:bg-slate-200',
};

export interface RowActionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  intent: RowActionIntent;
  /** Tooltip + accessible name, e.g. "Edit account". */
  label: string;
  icon: React.ReactNode;
}

/**
 * Small colored icon button for table rows and list items.
 * Always carries a title + aria-label and stops row-click propagation.
 */
export const RowActionButton: React.FC<RowActionButtonProps> = ({
  intent,
  label,
  icon,
  onClick,
  className = '',
  ...rest
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${INTENT_CLS[intent]} ${className}`}
    {...rest}
  >
    {icon}
  </button>
);

export interface TableActionsProps {
  /** Entity name for accessible labels, e.g. "account" → "Edit account". */
  entityLabel: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

/** The standard View / Edit / Delete trio rendered in table action cells. */
export const TableActions: React.FC<TableActionsProps> = ({
  entityLabel,
  onView,
  onEdit,
  onDelete,
  className = '',
}) => (
  <div className={`flex items-center justify-center gap-1.5 whitespace-nowrap ${className}`}>
    {onView && (
      <RowActionButton
        intent="view"
        label={`View ${entityLabel}`}
        icon={<Eye className="w-3.5 h-3.5" />}
        onClick={onView}
      />
    )}
    {onEdit && (
      <RowActionButton
        intent="edit"
        label={`Edit ${entityLabel}`}
        icon={<Pencil className="w-3.5 h-3.5" />}
        onClick={onEdit}
      />
    )}
    {onDelete && (
      <RowActionButton
        intent="delete"
        label={`Delete ${entityLabel}`}
        icon={<Trash2 className="w-3.5 h-3.5" />}
        onClick={onDelete}
      />
    )}
  </div>
);

export interface RestoreButtonProps {
  /** Accessible label, e.g. "Restore account". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** Emerald "Restore" pill used in deactivated-records tables. */
export const RestoreButton: React.FC<RestoreButtonProps> = ({ label, onClick, disabled }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
  >
    <RotateCcw className="w-3 h-3" aria-hidden="true" />
    <span>Restore</span>
  </button>
);
