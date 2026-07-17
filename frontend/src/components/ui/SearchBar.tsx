import React from 'react';
import { Search } from 'lucide-react';

export interface SearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Wrapper classes — control width here (e.g. "max-w-md w-full"). */
  className?: string;
}

/**
 * Standard search input with a leading magnifier icon. All list views share
 * this so search fields look and focus identically everywhere.
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  className = 'max-w-md w-full',
  'aria-label': ariaLabel,
  ...rest
}) => (
  <div className={`relative ${className}`}>
    <Search
      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
      aria-hidden="true"
    />
    <input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel ?? placeholder}
      className="w-full text-xs pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors duration-150"
      {...rest}
    />
  </div>
);
