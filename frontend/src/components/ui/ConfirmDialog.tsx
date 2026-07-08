import React, { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Optional body copy describing what is about to happen. */
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger → red destructive dialog (default); default → blue primary confirm. */
  tone?: 'danger' | 'default';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Standard confirmation dialog (delete and other irreversible actions).
 * Built on the accessible Modal shell — Escape, focus trap, and ARIA come
 * for free. The confirm button shows a busy state while an async
 * onConfirm is in flight.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      icon={
        <AlertTriangle
          className={`w-5 h-5 shrink-0 ${tone === 'danger' ? 'text-red-500' : 'text-blue-500'}`}
          aria-hidden="true"
        />
      }
      onClose={onCancel}
      maxWidth="max-w-sm"
      tone={tone === 'danger' ? 'danger' : 'neutral'}
    >
      {message && <div className="px-6 py-4 text-xs text-slate-600 font-medium">{message}</div>}
      <ModalFooter className="border-t-0">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export interface RestoreDialogProps {
  isOpen: boolean;
  title: string;
  message?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Confirmation dialog for restoring soft-deleted records — same shell as
 * ConfirmDialog but with restore iconography and an affirmative primary button.
 */
export const RestoreDialog: React.FC<RestoreDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      icon={<RotateCcw className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />}
      onClose={onCancel}
      maxWidth="max-w-sm"
    >
      {message && <div className="px-6 py-4 text-xs text-slate-600 font-medium">{message}</div>}
      <ModalFooter className="border-t-0">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleConfirm} disabled={busy}>
          {busy ? 'Restoring…' : 'Restore'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
