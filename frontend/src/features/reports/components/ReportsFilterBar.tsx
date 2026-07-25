/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Calendar, CalendarRange, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { ReportsFilterPanel } from './ReportsFilterPanel';
import type { ReportsFilterState } from '../utils/reportsFilters';

export interface ReportsFilterBarProps {
  filters: ReportsFilterState;
  onChange: (key: keyof ReportsFilterState, value: string) => void;
  onReset: () => void;
  industryOptions: string[];
  locationOptions: string[];
  activeFilterCount: number;
}

interface FilterDropdownProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

/**
 * Compact labeled dropdown rendered as a self-contained card — small uppercase
 * label above, bold current value below, a native <select> made invisible so
 * the whole card is the click target and a single trailing chevron reads as the
 * affordance. Matches the reference report-header controls.
 */
const FilterDropdown: React.FC<FilterDropdownProps> = ({ icon, label, value, onChange, options }) => {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="relative flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm transition-colors hover:border-slate-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15 min-w-0 flex-1 sm:flex-initial sm:min-w-[13rem]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="block truncate text-sm font-semibold text-slate-800 leading-tight">{current}</span>
      </div>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * Report-header filter bar: Reporting Period (FY) and Period Type (quarter)
 * dropdowns on the left, a Filters toggle on the right, and the expandable
 * field grid below. Account scoping is handled globally by the header's
 * GlobalAccountSelector, so this bar no longer carries its own account filter.
 */
export const ReportsFilterBar: React.FC<ReportsFilterBarProps> = ({
  filters,
  onChange,
  onReset,
  industryOptions,
  locationOptions,
  activeFilterCount,
}) => {
  const {
    selectedYear, setSelectedYear,
    selectedQuarter, setSelectedQuarter,
    financialYears, financialCalendar, adminSettings,
  } = useCRM();

  const [expanded, setExpanded] = useState(false);

  // FY options — mirrors PeriodSelector: only active FYs, capped by the admin
  // setting, always keeping the current selection visible.
  const selectorFYs = useMemo(() => {
    const count = parseInt(adminSettings?.fySelectorCount ?? '5', 10);
    const activeFYs = financialYears.filter((f) => f.isActive);
    const sorted = [...activeFYs].sort((a, b) => b.startYear - a.startYear);
    const top = sorted.slice(0, count);
    if (selectedYear !== 'All' && !top.some((f) => f.fyLabel === selectedYear)) {
      const selected = activeFYs.find((f) => f.fyLabel === selectedYear);
      if (selected) top.push(selected);
    }
    return top.sort((a, b) => a.startYear - b.startYear);
  }, [financialYears, adminSettings, selectedYear]);

  // Auto-select the most recent active FY on first visit / fall back if the
  // stored selection became inactive — identical behavior to PeriodSelector.
  useEffect(() => {
    if (!financialYears.length) return;
    const activeFYs = financialYears.filter((f) => f.isActive);
    const mostRecent = [...activeFYs].sort((a, b) => b.startYear - a.startYear)[0];
    if (selectedYear === 'All') {
      if (localStorage.getItem('crm_selected_year') === null && mostRecent) {
        setSelectedYear(mostRecent.fyLabel);
      }
      return;
    }
    const fy = financialYears.find((f) => f.fyLabel === selectedYear);
    if (!fy || !fy.isActive) {
      setSelectedYear(mostRecent ? mostRecent.fyLabel : 'All');
    }
  }, [financialYears, selectedYear, setSelectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedFYForQuarters = financialYears.find((f) => f.fyLabel === selectedYear);
  const activeQuarterDefs = selectedFYForQuarters?.calendarQuarters ?? financialCalendar?.quarters ?? [];

  const fyOptions = useMemo(
    () => [
      ...selectorFYs.map((fy) => ({ value: fy.fyLabel, label: `FY ${fy.fyLabel}` })),
      { value: 'All', label: 'All Years' },
    ],
    [selectorFYs],
  );

  const quarterOptions = useMemo(
    () => [
      { value: 'All', label: 'Full Year' },
      ...activeQuarterDefs.map((q) => ({ value: q.label, label: q.label })),
    ],
    [activeQuarterDefs],
  );

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <FilterDropdown
            icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
            label="Reporting Period"
            value={selectedYear}
            onChange={setSelectedYear}
            options={fyOptions}
          />
          <FilterDropdown
            icon={<CalendarRange className="h-4 w-4" aria-hidden="true" />}
            label="Period Type"
            value={selectedQuarter}
            onChange={setSelectedQuarter}
            options={quarterOptions}
          />
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
              expanded || activeFilterCount > 0
                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <ReportsFilterPanel
            filters={filters}
            onChange={onChange}
            industryOptions={industryOptions}
            locationOptions={locationOptions}
          />
        </div>
      )}
    </div>
  );
};
