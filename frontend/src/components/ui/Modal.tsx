import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  /** Header title text (also wired as the dialog's accessible name). */
  title: React.ReactNode;
  /** Optional leading header icon, e.g. <Users className="w-5 h-5 text-blue-600" />. */
  icon?: React.ReactNode;
  onClose: () => void;
  /** Tailwind max-width class for the panel. */
  maxWidth?: string;
  /** Header tint: neutral slate (default) or red for destructive dialogs. */
  tone?: 'neutral' | 'danger';
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell shared by every dialog in the app: dimmed overlay,
 * white rounded panel, tinted header with icon + title + close button.
 * Handles Escape-to-close, focus trapping, focus restoration, and ARIA wiring
 * so individual features don't re-implement (or forget) any of it.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  icon,
  onClose,
  maxWidth = 'max-w-lg',
  tone = 'neutral',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Keep a stable ref to the latest onClose so the focus/keyboard effect
  // does not need onClose in its dependency array. Without this, every render
  // that passes a new arrow-function for onClose (the common pattern) would
  // re-run the effect and call panel.focus(), stealing focus from any input
  // the user was typing in.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first focusable element, else the panel).
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      // Keep Tab / Shift+Tab cycling inside the dialog.
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const headerCls =
    tone === 'danger'
      ? 'bg-red-50 border-b border-red-100'
      : 'bg-slate-50 border-b border-slate-200';

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
      onMouseDown={(e) => {
        // Close on overlay click, but not on clicks that start inside the panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-2xl border border-slate-200 ${maxWidth} w-full overflow-hidden focus:outline-none max-h-[90vh] flex flex-col`}
      >
        <div className={`px-6 py-4 flex items-center justify-between shrink-0 ${headerCls}`}>
          <div className="flex items-center space-x-2.5 min-w-0">
            {icon}
            <h3 id={titleId} className="font-bold text-slate-800 tracking-tight truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 cursor-pointer transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

/** Standard right-aligned modal footer (Cancel / primary action row). */
export const ModalFooter: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = '',
  children,
}) => (
  <div
    className={`flex items-center justify-end space-x-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200 ${className}`}
  >
    {children}
  </div>
);
