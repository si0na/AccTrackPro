import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface ErrorBannerProps {
  message: string;
  /** When provided, renders a dismiss (X) button. */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline dismissible error banner used for recoverable failures
 * (restore errors, upload errors, load failures…).
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss, className = '' }) => (
  <div
    role="alert"
    className={`flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs font-medium ${className}`}
  >
    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
    <span className="flex-1">{message}</span>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="shrink-0 text-red-400 hover:text-red-600 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

export interface ErrorStateProps {
  title?: string;
  message: string;
  /** Optional retry callback — renders a "Try again" button. */
  onRetry?: () => void;
  className?: string;
}

/** Block-level error state for panels/pages that failed to load. */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => (
  <div
    role="alert"
    className={`flex flex-col items-center justify-center py-10 text-center ${className}`}
  >
    <div className="p-3 bg-red-50 rounded-xl mb-3">
      <AlertCircle className="w-6 h-6 text-red-500" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="text-xs text-slate-400 mt-1 max-w-sm">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
      >
        Try again
      </button>
    )}
  </div>
);
