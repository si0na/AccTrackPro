import React from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';

/** Standard text/select/date input classes for form controls. */
export const INPUT_CLS =
  'w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
/** Select variant (adds white background). */
export const SELECT_CLS = `${INPUT_CLS} bg-white cursor-pointer`;
/** Amber-focused variant for edit contexts. */
export const INPUT_CLS_AMBER =
  'w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  /** Span both columns of a 2-col form grid. */
  wide?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Labeled form field: bold uppercase label above the control, matching the
 * app-wide form style. Wrap any input/select/textarea in it.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  wide = false,
  hint,
  className = '',
  children,
}) => (
  <label className={`block space-y-1 ${wide ? 'sm:col-span-2' : ''} ${className}`}>
    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
      {label}
      {required && (
        <span className="text-red-500 ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400 font-medium">{hint}</span>}
  </label>
);

/** Two-column responsive grid for form fields (single column on mobile). */
export const FormGrid: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>{children}</div>;

export interface FormModalProps {
  isOpen: boolean;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  /** Primary button variant — amber for edit dialogs, blue for create, red for destructive. */
  submitVariant?: 'primary' | 'warning' | 'success' | 'danger';
  maxWidth?: string;
  children: React.ReactNode;
}

/**
 * Standard create/edit dialog: accessible Modal + <form> + scrollable body +
 * Cancel/Submit footer. Every module's create and edit dialogs share this
 * layout so forms look and behave identically.
 */
export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  title,
  icon,
  onClose,
  onSubmit,
  submitLabel,
  cancelLabel = 'Cancel',
  isSubmitting = false,
  submitVariant = 'primary',
  maxWidth = 'max-w-md',
  children,
}) => (
  <Modal isOpen={isOpen} title={title} icon={icon} onClose={onClose} maxWidth={maxWidth}>
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="p-6 space-y-4 text-xs">{children}</div>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant={submitVariant} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </ModalFooter>
    </form>
  </Modal>
);
