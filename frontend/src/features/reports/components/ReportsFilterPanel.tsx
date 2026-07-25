/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FilterSelect, SearchableSelect } from '@/components/ui';
import {
  OPPORTUNITY_STAGE_OPTIONS,
  OPPORTUNITY_HEALTH_OPTIONS,
  OPPORTUNITY_TYPE_OPTIONS,
  REVENUE_MODEL_OPTIONS,
  SERVICE_LINE_OPTIONS,
} from '@/constants';
import type { ReportsFilterState } from '../utils/reportsFilters';

const STATUS_OPTIONS = ['All', 'Open', 'Won', 'Lost'];

export interface ReportsFilterPanelProps {
  filters: ReportsFilterState;
  onChange: (key: keyof ReportsFilterState, value: string) => void;
  industryOptions: string[];
  locationOptions: string[];
}

/**
 * Field grid scoping every report on the Reports page by Stage/Health/Type/
 * Revenue Model/Service Line/Industry/Location/Status, layered on top of the
 * FY/Quarter/Account scoping in the filter bar. Rendered by ReportsFilterBar
 * when its "Filters" toggle is open — the toggle and Clear control live there.
 */
export const ReportsFilterPanel: React.FC<ReportsFilterPanelProps> = ({
  filters,
  onChange,
  industryOptions,
  locationOptions,
}) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    <FilterSelect
      label="Stage"
      value={filters.stage}
      onChange={(v) => onChange('stage', v)}
      options={[{ value: 'All', label: 'All Stages' }, ...OPPORTUNITY_STAGE_OPTIONS.map((s) => ({ value: s, label: s }))]}
    />
    <FilterSelect
      label="Health"
      value={filters.health}
      onChange={(v) => onChange('health', v)}
      options={[{ value: 'All', label: 'All Health' }, ...OPPORTUNITY_HEALTH_OPTIONS.map((h) => ({ value: h, label: h }))]}
    />
    <FilterSelect
      label="Type"
      value={filters.oppType}
      onChange={(v) => onChange('oppType', v)}
      options={[{ value: 'All', label: 'All Types' }, ...OPPORTUNITY_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))]}
    />
    <FilterSelect
      label="Revenue Model"
      value={filters.revenueModel}
      onChange={(v) => onChange('revenueModel', v)}
      options={[{ value: 'All', label: 'All Revenue Models' }, ...REVENUE_MODEL_OPTIONS.map((r) => ({ value: r, label: r }))]}
    />
    <FilterSelect
      label="Service Line"
      value={filters.serviceLine}
      onChange={(v) => onChange('serviceLine', v)}
      options={[{ value: 'All', label: 'All Service Lines' }, ...SERVICE_LINE_OPTIONS.map((s) => ({ value: s, label: s }))]}
    />
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Industry</span>
      <SearchableSelect
        value={filters.industry === 'All' ? '' : filters.industry}
        onChange={(v) => onChange('industry', v || 'All')}
        options={industryOptions}
        placeholder="All Industries"
        aria-label="Industry"
      />
    </label>
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Location</span>
      <SearchableSelect
        value={filters.location === 'All' ? '' : filters.location}
        onChange={(v) => onChange('location', v || 'All')}
        options={locationOptions}
        placeholder="All Locations"
        aria-label="Location"
      />
    </label>
    <FilterSelect
      label="Status"
      value={filters.status}
      onChange={(v) => onChange('status', v)}
      options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === 'All' ? 'All Statuses' : s }))}
    />
  </div>
);
