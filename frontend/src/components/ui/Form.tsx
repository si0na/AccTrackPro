import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';

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
  <label className={`block space-y-1 ${wide ? 'sm:col-span-full' : ''} ${className}`}>
    <span className="block text-label font-semibold text-slate-500 uppercase tracking-wide">
      {label}
      {required && (
        <span className="text-red-500 ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </span>
    {children}
    {hint && <span className="block text-micro text-slate-400 font-medium">{hint}</span>}
  </label>
);

/**
 * Responsive grid for form fields — single column on mobile, 2 columns from
 * `sm` up, and (via `columns={3}`) 3 columns from `lg` up once a modal is
 * wide enough to hold a third column without cramping. `FormField`'s `wide`
 * always spans the full row (`col-span-full`) regardless of column count.
 */
export const FormGrid: React.FC<{ className?: string; columns?: 2 | 3; children: React.ReactNode }> = ({
  className = '',
  columns = 2,
  children,
}) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''} gap-4 ${className}`}>
    {children}
  </div>
);

/**
 * Labeled group within a form body — groups related fields under a heading
 * instead of one long undifferentiated field list. Wrap a `FormGrid` (or any
 * content) in it; sections stack with consistent spacing inside `FormModal`.
 *
 * Every section heading carries the same accent treatment (indigo marker bar +
 * emphasised title over a divider) so a new section is immediately
 * recognisable — the hierarchy lives in the heading, not in the field content.
 */
export const FormSection: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    <h4 className="flex items-center gap-2 border-b border-slate-200 pb-2">
      <span className="w-1 h-3.5 rounded-full bg-indigo-500 shrink-0" aria-hidden="true" />
      <span className="text-label font-bold text-slate-700 uppercase tracking-wider">{title}</span>
    </h4>
    {children}
  </div>
);

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
 *
 * Every close path that abandons the form — Escape, the header X, an overlay
 * click, and the footer Cancel — routes through {@link requestClose}. When the
 * user has edited any field, a "Discard changes?" confirmation is shown first
 * so accidental key/click presses can't silently lose unsaved work; an
 * untouched form still closes immediately. Submitting (which calls the parent's
 * onClose directly) is unaffected. Because this lives in the shared FormModal,
 * every current and future form dialog inherits the behaviour automatically.
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
  maxWidth = 'max-w-lg',
  children,
}) => {
  // A real user edit (typing, toggling, selecting) bubbles a native input/
  // change event up to the <form>; a programmatic reseed of the draft on open
  // does not. So this ref flips to true only on genuine user modification —
  // added, edited, or cleared values alike — never from the form being
  // populated. Kept in a ref (not state) so marking dirty never re-renders.
  const dirtyRef = useRef(false);
  const [showDiscard, setShowDiscard] = useState(false);

  // Reset per open/close so a reused instance never carries dirty state or a
  // stale confirmation across separate open sessions.
  useEffect(() => {
    dirtyRef.current = false;
    setShowDiscard(false);
  }, [isOpen]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  // Escape, the X button, overlay clicks, and footer Cancel all funnel here so
  // every abandon-the-form action behaves identically: confirm when dirty,
  // close immediately when clean.
  const requestClose = () => {
    if (dirtyRef.current) setShowDiscard(true);
    else onClose();
  };

  const discardAndClose = () => {
    setShowDiscard(false);
    onClose();
  };

  // A FormModal can be nested inside another form's React tree — e.g. the inline
  // "Create Stakeholder" dialog opened from within the Opportunity form. That
  // child dialog is portaled out of the parent's DOM, but React still bubbles
  // its synthetic `submit` (and input/change) events up the *component* tree to
  // the ancestor <form>. Without stopping propagation here, submitting the child
  // would also fire the parent form's onSubmit — silently creating the parent
  // record. Stop these events at the form boundary so each FormModal owns its
  // own submit/dirty state. Harmless (a no-op) for top-level, non-nested modals.
  const handleSubmit = (e: React.FormEvent) => {
    e.stopPropagation();
    onSubmit(e);
  };
  const handleDirty = (e: React.FormEvent) => {
    e.stopPropagation();
    markDirty();
  };

  return (
    <>
      <Modal isOpen={isOpen} title={title} icon={icon} onClose={requestClose} maxWidth={maxWidth}>
        <form
          onSubmit={handleSubmit}
          onInput={handleDirty}
          onChange={handleDirty}
          className="flex flex-col h-full min-h-0"
        >
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-7 space-y-5 text-xs">{children}</div>
          <ModalFooter className="shrink-0">
            <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant={submitVariant} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Discard-changes guard — reuses the app-wide confirmation dialog.
          Cancel (focused by default) returns to the form with all data intact;
          Discard Changes (destructive) closes the underlying form. */}
      <ConfirmDialog
        isOpen={showDiscard}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to close this window? Any unsaved changes will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={discardAndClose}
        onCancel={() => setShowDiscard(false)}
      />
    </>
  );
};
