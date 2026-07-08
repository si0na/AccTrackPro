import React from 'react';

/** Single shimmering placeholder bar. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded bg-slate-200/70 ${className}`} />
);

/**
 * Table-shaped loading skeleton: header band + N shimmering rows, wrapped in
 * the standard white card. Use while a list view's data is loading.
 */
export const TableSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 6,
  className = '',
}) => (
  <div
    role="status"
    aria-label="Loading"
    className={`bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}
  >
    <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
      <Skeleton className="h-3 w-48" />
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <Skeleton className="h-3.5 w-1/4" />
          <Skeleton className="h-3.5 w-1/6" />
          <Skeleton className="h-3.5 w-1/6" />
          <Skeleton className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
    <span className="sr-only">Loading…</span>
  </div>
);

/** Card-grid loading skeleton (dashboards, stat tiles). */
export const CardSkeleton: React.FC<{ cards?: number; className?: string }> = ({
  cards = 4,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
}) => (
  <div role="status" aria-label="Loading" className={className}>
    {Array.from({ length: cards }, (_, i) => (
      <div key={i} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    ))}
    <span className="sr-only">Loading…</span>
  </div>
);
