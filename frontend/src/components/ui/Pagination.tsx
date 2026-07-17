import React from 'react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** When provided, renders the "Show N per page" selector. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Noun for the count copy, e.g. "accounts" → "Showing 1 to 10 of 42 accounts". */
  itemLabel?: string;
  className?: string;
}

const NAV_BTN =
  'px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold text-slate-500 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-150';

/**
 * Standard pagination footer: item-range summary, optional page-size
 * selector, and Previous / Page X of Y / Next controls.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = 'items',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border-t border-slate-200 px-5 py-4 text-xs ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 text-slate-400 font-medium">
        <span>
          Showing <span className="font-bold text-slate-600">{from}</span> to{' '}
          <span className="font-bold text-slate-600">{to}</span> of{' '}
          <span className="font-bold text-slate-600">{totalItems}</span> {itemLabel}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>per page</span>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={NAV_BTN}
        >
          Previous
        </button>
        <span
          className="px-2.5 py-1 rounded-lg bg-slate-100/80 font-bold text-slate-700"
          aria-live="polite"
        >
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className={NAV_BTN}
        >
          Next
        </button>
      </div>
    </nav>
  );
};
