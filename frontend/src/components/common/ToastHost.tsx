import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type ToastKind = 'error' | 'success';

export interface ToastPayload {
  kind: ToastKind;
  message: string;
}

interface ToastItem extends ToastPayload {
  id: number;
}

const TOAST_EVENT = 'crm:toast';
const AUTO_DISMISS_MS = 6000;

/**
 * Fire a toast from anywhere (components, hooks, the axios interceptor) —
 * no React context required at the call site.
 */
export function showToast(payload: ToastPayload): void {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

let nextId = 1;

/**
 * Renders toasts dispatched via showToast(). Mounted once at the app root so
 * API errors surface consistently regardless of which view triggered them.
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      const item: ToastItem = { ...detail, id: nextId++ };
      setToasts((prev) => {
        // Collapse identical back-to-back messages (e.g. a burst of failed polls).
        if (prev.some((t) => t.message === item.message && t.kind === item.kind)) return prev;
        return [...prev, item];
      });
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, AUTO_DISMISS_MS);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm" aria-live="assertive">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-lg text-sm ${
            t.kind === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
          role="alert"
        >
          {t.kind === 'error'
            ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
