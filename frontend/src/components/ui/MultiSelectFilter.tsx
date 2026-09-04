/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface MultiSelectFilterOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterProps {
  /** Visible label above control on stacked layouts; always used for aria-label. */
  label: string;
  /** Currently selected option values. */
  selectedValues: string[];
  /** Callback fired when selection changes. */
  onChange: (selected: string[]) => void;
  /** Available options. Can be string array or objects with value/label. */
  options: readonly string[] | readonly MultiSelectFilterOption[];
  /** Placeholder label shown when no items are selected (defaults to "All {label}s"). */
  allLabel?: string;
  /** Hide the visual label above the trigger (keeps aria-label). */
  hideLabel?: boolean;
  /** Custom wrapper class. */
  className?: string;
  /** Whether to show a search input inside the popover. Defaults to true if options > 5. */
  searchable?: boolean;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  selectedValues,
  onChange,
  options,
  allLabel,
  hideLabel = false,
  className = '',
  searchable,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();

  // Normalize options into standard { value, label } structure
  const normalizedOptions: MultiSelectFilterOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const defaultAllLabel = allLabel || `All ${label}s`;
  const isSearchVisible = searchable !== undefined ? searchable : normalizedOptions.length > 5;

  // Close dropdown on click outside or Escape press
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && isSearchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, isSearchVisible]);

  // Filter options by search query
  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle selection of a single value
  const handleToggle = (value: string) => {
    let next: string[];
    if (selectedValues.includes(value)) {
      next = selectedValues.filter((v) => v !== value);
    } else {
      next = [...selectedValues, value];
    }
    onChange(next);
  };

  // Select all filtered options
  const handleSelectAll = () => {
    const allFilteredValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...selectedValues, ...allFilteredValues]));
    onChange(combined);
  };

  // Clear all selections
  const handleClearAll = () => {
    onChange([]);
  };

  // Format trigger display text
  const renderTriggerText = () => {
    if (!selectedValues || selectedValues.length === 0) {
      return <span className="text-slate-600 truncate">{defaultAllLabel}</span>;
    }

    const selectedLabels = selectedValues
      .map((val) => normalizedOptions.find((o) => o.value === val)?.label || val)
      .filter(Boolean);

    if (selectedLabels.length === 1) {
      return <span className="font-semibold text-slate-800 truncate">{selectedLabels[0]}</span>;
    }
    if (selectedLabels.length === 2) {
      return <span className="font-semibold text-slate-800 truncate">{selectedLabels.join(', ')}</span>;
    }
    return (
      <span className="font-semibold text-slate-800 truncate">
        {selectedLabels[0]}, {selectedLabels[1]}{' '}
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-0.5">
          +{selectedLabels.length - 2}
        </span>
      </span>
    );
  };

  return (
    <div className={`relative block ${className}`} ref={containerRef}>
      {!hideLabel && (
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
          {label}
        </span>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between text-xs border rounded-lg p-2.5 bg-white transition-all cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : selectedValues.length > 0
            ? 'border-blue-300 bg-blue-50/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-1">
          {renderTriggerText()}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selectedValues.length > 0 && (
            <span className="flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 min-w-[14rem] animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header Controls: Search + Select/Clear All */}
          <div className="space-y-2 mb-2 pb-2 border-b border-slate-100">
            {isSearchVisible && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id={searchId}
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}s...`}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500">
              <span>
                {selectedValues.length === 0
                  ? 'All selected'
                  : `${selectedValues.length} of ${normalizedOptions.length} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Option Checkboxes List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching {label.toLowerCase()}s found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isChecked = selectedValues.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-blue-50/70 text-blue-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(option.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        isChecked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
