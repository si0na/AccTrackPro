/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Forecast Analytics Dashboard.
 *
 * A premium, executive-style forecasting workspace rendered in one of two
 * locked modes, selected by where it is entered from:
 *   • Portfolio Forecast   — aggregated forecasting across all opportunities in
 *                            scope. Reached from the left navigation.
 *   • Opportunity Forecast — deep analytics for a single opportunity. Reached
 *                            from each Opportunity (details / list row action).
 *
 * The `mode` prop fixes the view; the in-page Opportunity ⇄ Portfolio toggle is
 * therefore not shown. Forecast revenue is always DERIVED (Deal Value ×
 * Probability) and read-only; only Actual Revenue is editable. FY / Quarter /
 * Account scoping and the panel filters mirror the Reports page; the Month /
 * Quarter / Year Forecast View drives every KPI, chart, table and insight.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { opportunityForecastApi } from '@/api/crm.api';
import type { OpportunityForecastResult } from '@/types';
import { matchesGlobalAccount, deriveOppStatus } from '@/utils';
import { LoadingState } from '@/components/common/LoadingState';
import { BackButton, EmptyState, ErrorBanner, PageHeader } from '@/components/ui';
import type { Granularity } from './forecast/forecastMath';
import {
  ForecastFilterBar, FORECAST_FILTERS_DEFAULT,
  type ForecastFilterState, type ForecastViewMode,
} from './forecast/ForecastFilterBar';
import { OpportunityForecastPanel } from './forecast/OpportunityForecastPanel';
import { PortfolioForecastPanel } from './forecast/PortfolioForecastPanel';

export interface OpportunityForecastViewProps {
  /**
   * Locks the dashboard to a single mode based on the entry point:
   *   • 'portfolio'   — left-navigation Portfolio Forecast.
   *   • 'opportunity' — per-opportunity Opportunity Forecast.
   */
  mode: ForecastViewMode;
}

export const OpportunityForecastView: React.FC<OpportunityForecastViewProps> = ({ mode }) => {
  const {
    selectedOpportunityId, setView, opportunities, currentUser, refreshData,
    selectedYear, selectedQuarter, globalAccountId,
    financialYears, financialCalendar,
  } = useCRM();

  // The view is locked to `mode`; the in-page toggle is hidden.
  const viewMode = mode;
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [filters, setFilters] = useState<ForecastFilterState>(FORECAST_FILTERS_DEFAULT);
  const [activeOppId, setActiveOppId] = useState<string | null>(selectedOpportunityId);

  const [data, setData] = useState<OpportunityForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const setFilter = (key: keyof ForecastFilterState, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const resetFilters = () => setFilters(FORECAST_FILTERS_DEFAULT);

  // ── Load the single-opportunity forecast payload ────────────────────────────
  const load = useCallback(async () => {
    if (!activeOppId) { setData(null); return; }
    setLoading(true);
    setLoadError(null);
    try {
      setData(await opportunityForecastApi.get(activeOppId));
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      setLoadError(typeof raw === 'string' ? raw : 'Failed to load the forecast for this opportunity.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeOppId]);

  useEffect(() => {
    if (viewMode === 'opportunity') void load();
  }, [viewMode, load]);

  // Quarter labels for the selected opportunity's FY (falls back to the calendar).
  const quarterLabels = useMemo(() => {
    const activeOpp = opportunities.find((o) => o.id === activeOppId);
    const fyLabel = activeOpp?.financialYear ?? (selectedYear !== 'All' ? selectedYear : undefined);
    const fy = financialYears.find((f) => f.fyLabel === fyLabel);
    const defs = fy?.calendarQuarters ?? financialCalendar?.quarters ?? [];
    return defs.map((q) => q.label);
  }, [opportunities, activeOppId, selectedYear, financialYears, financialCalendar]);

  // ── Portfolio scope (FY / Quarter / Account + panel filters) ────────────────
  const fyLabel = selectedYear !== 'All' ? selectedYear : null;
  const portfolioOpps = useMemo(() => opportunities.filter((o) => {
    if (!matchesGlobalAccount(o.accountId, globalAccountId)) return false;
    if (fyLabel && o.financialYear !== fyLabel) return false;
    if (selectedQuarter !== 'All' && o.quarter !== selectedQuarter) return false;
    if (filters.status !== 'All' && deriveOppStatus(o.stage) !== filters.status) return false;
    if (filters.stage !== 'All' && o.stage !== filters.stage) return false;
    if (filters.health !== 'All' && o.opportunityHealth !== filters.health) return false;
    if (filters.serviceLine !== 'All' && o.serviceLine !== filters.serviceLine) return false;
    return true;
  }), [opportunities, globalAccountId, fyLabel, selectedQuarter, filters]);

  return (
    <div className="space-y-6">
      {viewMode === 'opportunity' && selectedOpportunityId && (
        <BackButton label="Back to Opportunity" onClick={() => setView('opportunity-details')} />
      )}

      <PageHeader
        title={viewMode === 'opportunity' ? 'Opportunity Forecast' : 'Portfolio Forecast'}
        subtitle={viewMode === 'opportunity'
          ? 'Automatically calculated forecast, realisation and business insights for a single opportunity'
          : 'Aggregated revenue forecasting across your opportunity portfolio'}
        accent="blue"
        icon={<LineChart className="w-5 h-5" aria-hidden="true" />}
      />

      <ForecastFilterBar
        viewMode={viewMode}
        showViewToggle={false}
        granularity={granularity}
        onGranularityChange={setGranularity}
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        opportunities={opportunities}
        activeOpportunityId={activeOppId}
        onOpportunityChange={setActiveOppId}
      />

      {viewMode === 'portfolio' ? (
        <PortfolioForecastPanel opportunities={portfolioOpps} granularity={granularity} />
      ) : !activeOppId ? (
        <EmptyState
          icon={<LineChart className="w-6 h-6 text-slate-400" aria-hidden="true" />}
          title="No opportunity selected"
          hint="Pick an opportunity from the filter above, or switch to the Portfolio Forecast view."
        />
      ) : loading && !data ? (
        <LoadingState label="Loading forecast…" />
      ) : loadError && !data ? (
        <ErrorBanner message={loadError} />
      ) : data ? (
        <OpportunityForecastPanel
          data={data}
          granularity={granularity}
          quarterLabels={quarterLabels}
          currentUser={currentUser}
          onRefetch={load}
          onSaved={() => { void refreshData(); }}
        />
      ) : (
        <LoadingState label="Loading forecast…" />
      )}
    </div>
  );
};
