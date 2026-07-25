/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Forecast dashboard filter bar — reuses the Reports page filter language
 * (compact card-style dropdowns + an expandable field panel). It carries the
 * Opportunity ⇄ Portfolio view switch, the shared FY / Period Type scoping (from
 * CRMContext, identical to the Reports bar), the Month / Quarter / Year Forecast
 * View, deal Status, and — in Opportunity mode — an opportunity picker.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CalendarRange, ChevronDown, LayoutGrid, SlidersHorizontal, TrendingUp,
  Target, Activity, X,
} from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { FilterSelect, SearchableSelect } from '@/components/ui';
import {
  OPPORTUNITY_STAGE_OPTIONS, OPPORTUNITY_HEALTH_OPTIONS, SERVICE_LINE_OPTIONS,
} from '@/constants';
import type { Opportunity } from '@/types';
import { GRANULARITY_OPTIONS, type Granularity } from './forecastMath';

export type ForecastViewMode = 'opportunity' | 'portfolio';

export interface ForecastFilterState {
  status: string;
  stage: string;
  health: string;
  serviceLine: string;
}

export const FORECAST_FILTERS_DEFAULT: ForecastFilterState = {
  status: 'All', stage: 'All', health: 'All', serviceLine: 'All',
};

const STATUS_OPTIONS = ['All', 'Open', 'Won', 'Lost'] as const;

const toOpts = (values: readonly string[], allLabel: string) => [
  { value: 'All', label: allLabel },
  ...values.map((v) => ({ value: v, label: v })),
];

// ── Compact card dropdown (identical to the Reports FilterDropdown) ──────────
interface FilterDropdownProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ icon, label, value, onChange, options }) => {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="relative flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm transition-colors hover:border-slate-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15 min-w-0 flex-1 sm:flex-initial sm:min-w-[12rem]">
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
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
};

export interface ForecastFilterBarProps {
  viewMode: ForecastViewMode;
  /** Opportunity ⇄ Portfolio switch handler. Only needed when the toggle shows. */
  onViewModeChange?: (mode: ForecastViewMode) => void;
  /** Show the in-bar Opportunity ⇄ Portfolio toggle (default true). */
  showViewToggle?: boolean;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  filters: ForecastFilterState;
  onFilterChange: (key: keyof ForecastFilterState, value: string) => void;
  onReset: () => void;
  /** Opportunity-mode picker. */
  opportunities: Opportunity[];
  activeOpportunityId: string | null;
  onOpportunityChange: (id: string) => void;
}

export const ForecastFilterBar: React.FC<ForecastFilterBarProps> = ({
  viewMode, onViewModeChange, showViewToggle = true, granularity, onGranularityChange,
  filters, onFilterChange, onReset, opportunities, activeOpportunityId, onOpportunityChange,
}) => {
  const {
    selectedYear, setSelectedYear,
    selectedQuarter, setSelectedQuarter,
    financialYears, financialCalendar, adminSettings,
  } = useCRM();

  const [expanded, setExpanded] = useState(false);

  // FY options — mirrors the Reports bar: active FYs, capped by the admin
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

  useEffect(() => {
    if (!financialYears.length) return;
    const activeFYs = financialYears.filter((f) => f.isActive);
    const mostRecent = [...activeFYs].sort((a, b) => b.startYear - a.startYear)[0];
    if (selectedYear === 'All') {
      if (localStorage.getItem('crm_selected_year') === null && mostRecent) setSelectedYear(mostRecent.fyLabel);
      return;
    }
    const fy = financialYears.find((f) => f.fyLabel === selectedYear);
    if (!fy || !fy.isActive) setSelectedYear(mostRecent ? mostRecent.fyLabel : 'All');
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

  const oppOptions = useMemo(
    () => opportunities
      .map((o) => ({ value: o.id, label: o.accountName ? `${o.name} · ${o.accountName}` : o.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [opportunities],
  );

  const panelActiveCount = [filters.stage, filters.health, filters.serviceLine].filter((v) => v !== 'All').length;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
      {/* View toggle — hidden when the view is locked to a single mode. */}
      {showViewToggle && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label="Forecast view"
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
          >
            {([
              { key: 'opportunity', label: 'Opportunity Forecast', icon: <Target className="w-4 h-4" /> },
              { key: 'portfolio', label: 'Portfolio Forecast', icon: <LayoutGrid className="w-4 h-4" /> },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                role="radio"
                aria-checked={viewMode === opt.key}
                onClick={() => onViewModeChange?.(opt.key)}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  viewMode === opt.key
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.key === 'opportunity' ? 'Opportunity' : 'Portfolio'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
          <FilterDropdown
            icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
            label="Forecast View"
            value={granularity}
            onChange={(v) => onGranularityChange(v as Granularity)}
            options={GRANULARITY_OPTIONS.map((g) => ({ value: g.key, label: g.label }))}
          />
          {viewMode === 'portfolio' ? (
            <FilterDropdown
              icon={<Activity className="h-4 w-4" aria-hidden="true" />}
              label="Status"
              value={filters.status}
              onChange={(v) => onFilterChange('status', v)}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === 'All' ? 'All Statuses' : s }))}
            />
          ) : (
            <div className="min-w-0 flex-1 sm:flex-initial sm:min-w-[16rem]">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Opportunity</span>
              <SearchableSelect
                value={activeOpportunityId ?? ''}
                onChange={onOpportunityChange}
                options={oppOptions}
                placeholder="Select an opportunity"
                aria-label="Opportunity"
              />
            </div>
          )}
        </div>

        {viewMode === 'portfolio' && (
          <div className="flex items-center gap-2 lg:ml-auto">
            {panelActiveCount > 0 && (
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
                expanded || panelActiveCount > 0
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {panelActiveCount > 0 && (
                <span className="inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {panelActiveCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {viewMode === 'portfolio' && expanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FilterSelect
              label="Stage" value={filters.stage}
              onChange={(v) => onFilterChange('stage', v)}
              options={toOpts(OPPORTUNITY_STAGE_OPTIONS, 'All Stages')}
            />
            <FilterSelect
              label="Health" value={filters.health}
              onChange={(v) => onFilterChange('health', v)}
              options={toOpts(OPPORTUNITY_HEALTH_OPTIONS, 'All Health')}
            />
            <FilterSelect
              label="Service Line" value={filters.serviceLine}
              onChange={(v) => onFilterChange('serviceLine', v)}
              options={toOpts(SERVICE_LINE_OPTIONS, 'All Service Lines')}
            />
          </div>
        </div>
      )}
    </div>
  );
};
