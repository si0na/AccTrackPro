/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export interface SortableHeaderProps<TField extends string = string> {
  label: string;
  field: TField;
  sortField: TField | null;
  sortDirection: 'asc' | 'desc';
  onSort: (field: TField) => void;
  className?: string;
}

/** Clickable `<th>` content that toggles asc/desc sort on a column, with an icon reflecting the active sort state. */
export function SortableHeader<TField extends string = string>({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className = '',
}: SortableHeaderProps<TField>) {
  const isActive = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`flex items-center space-x-1 text-left leading-snug transition-colors focus:outline-none cursor-pointer ${
        isActive ? 'text-blue-600' : 'hover:text-slate-900'
      } ${className}`}
    >
      <span>{label}</span>
      {isActive ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" />
        ) : (
          <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
      )}
    </button>
  );
}
