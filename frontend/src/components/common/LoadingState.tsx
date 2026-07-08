import { Loader2 } from 'lucide-react';

/** Small inline spinner for buttons and compact rows. */
export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-indigo-500`} aria-label="Loading" />;
}

/**
 * Reusable block-level loading state for lists, panels, and pages.
 * Replaces the ad-hoc "Loading…" paragraphs scattered across views.
 */
export function LoadingState({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 py-12 text-slate-400 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Spinner className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/** Full-screen variant used while the app bootstraps. */
export function FullPageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <Spinner className="w-8 h-8" />
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}
