import React from 'react';

/**
 * White card that hosts a view's search + filter controls. Pass grid classes
 * via `className` when the bar needs a specific column layout.
 */
export const FilterBar: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = 'flex flex-wrap items-center gap-4',
  children,
}) => (
  <div className={`bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm ${className}`}>
    {children}
  </div>
);

export interface FilterSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** Visible above the control on stacked layouts; always used as aria-label. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  /** Hide the visual label (keeps the aria-label). */
  hideLabel?: boolean;
}

/** Standard labeled select used inside FilterBar. */
export const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  value,
  onChange,
  options,
  hideLabel = false,
  className = '',
  ...rest
}) => (
  <label className={`block ${className}`}>
    {!hideLabel && (
      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </span>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

export interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/** Toggle chip for quick filters (e.g. audit-log activity types). */
export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
      active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}
  >
    {label}
  </button>
);
