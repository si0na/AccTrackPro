/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ReportsFilterBar } from './ReportsFilterBar';
import { ReportExportMenu } from './ReportExportMenu';
import { useReportsFilters } from '../hooks/useReportsFilters';
import { matchesReportsFilters } from '../utils/reportsFilters';
import { exportReportToPdf, exportReportToXlsx, buildExportFileName } from '@/utils/exportReport';
import {
  toStageSection,
  toTopOppsSection,
  toAccountTypeSection,
} from '../utils/executiveSummarySections';
import {
  buildLocationRevenueRows,
  buildServiceRevenueRows,
  buildStageRevenueRows,
  toLocationRevenueSection,
  toServiceRevenueSection,
  toStageRevenueSection,
} from '../utils/revenueReportCalculations';
import { matchesGlobalAccount } from '@/utils';
import { OPPORTUNITY_STAGE_STYLE } from '@/constants';
import type { OpportunityStage } from '@/types';
import { PageHeader, CardSkeleton } from '@/components/ui';
import {
  PipelineByStageCard,
  TopOpportunitiesCard,
  RevenueByAccountTypeCard,
  ReportsSectionHeading,
} from './executive';
import { LocationRevenueReport, ServiceRevenueReport, StageRevenueReport } from './revenue';

export const ExecutiveDashboardView: React.FC = () => {
  const {
    accounts, opportunities, selectedYear, selectedQuarter,
    globalAccountId: selectedAccountId, loading, setView,
  } = useCRM();

  const { filters, setFilter, resetFilters, activeFilterCount, industryOptions, locationOptions } =
    useReportsFilters(opportunities, accounts);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Reporting view: the FY/Quarter selector applies here, using the
  // backend-derived fiscal labels (from close/due dates via the configured
  // Financial Calendar). Closed-lost deals are excluded from all figures.
  const fyLabel = selectedYear !== 'All' ? selectedYear : null;

  // Base set for the Revenue Reports: FY + Quarter + global Account +
  // every filter-panel field. Deliberately does NOT exclude Lost — the
  // Stage-wise/Location-wise reports need Lost opportunities visible.
  const filteredOppsAll = useMemo(() => opportunities.filter((o) => {
    if (!matchesGlobalAccount(o.accountId, selectedAccountId)) return false;
    if (fyLabel && o.financialYear !== fyLabel) return false;
    if (selectedQuarter !== 'All' && o.quarter !== selectedQuarter) return false;
    return matchesReportsFilters(o, accountsById.get(o.accountId), filters);
  }), [opportunities, selectedAccountId, fyLabel, selectedQuarter, filters, accountsById]);

  // Pipeline/Forecast cards: same base set, PLUS the original hardcoded Lost
  // exclusion — unchanged behavior from before this feature.
  const filteredOpps = useMemo(
    () => filteredOppsAll.filter((o) => o.stage !== 'Lost'),
    [filteredOppsAll],
  );

  // Revenue Reports data — computed once here so the bundled "Export All"
  // reads from the exact same rows as each Revenue Report card.
  const locationRevenueRows = useMemo(() => buildLocationRevenueRows(filteredOppsAll), [filteredOppsAll]);
  const serviceRevenueRows = useMemo(() => buildServiceRevenueRows(filteredOppsAll), [filteredOppsAll]);
  const stageRevenueRows = useMemo(() => buildStageRevenueRows(filteredOppsAll), [filteredOppsAll]);

  // Core Aggregations
  const totalPipelineValue = filteredOpps.reduce((sum, o) => sum + o.value, 0);
  const totalForecastValue = filteredOpps.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);

  // Format Helper
  const formatCurrency = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    } else if (val >= 1000) {
      return `$${(val / 1000).toFixed(1)}K`;
    } else {
      return `$${Math.round(val).toLocaleString('en-US')}`;
    }
  };

  // 1. Pipeline by Stage — colours come from the shared OPPORTUNITY_STAGE_STYLE
  // token so this pipeline stays identical to the Dashboard pipeline. The full
  // 9-stage list still feeds the PDF/Excel export; the chart itself only
  // renders stages that actually hold value, so it never shows empty bars.
  const stages: OpportunityStage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Lost'];
  const stageData = stages.map((stage) => {
    const stageOpps = filteredOpps.filter(o => o.stage === stage);
    const value = stageOpps.reduce((sum, o) => sum + o.value, 0);
    const pct = totalPipelineValue > 0 ? Math.round((value / totalPipelineValue) * 100) : 0;
    return {
      stage,
      val: formatCurrency(value),
      value,
      pct,
      count: stageOpps.length,
      color: OPPORTUNITY_STAGE_STYLE[stage].hex
    };
  });
  const stageChartData = stageData.filter((s) => s.value > 0);

  // Display-only ratio for the pipeline footer: share of all opportunities in
  // scope (incl. Lost) that reached Won. Derived from the already-filtered rows
  // — no new query, no change to any existing figure.
  const conversionRate = filteredOppsAll.length > 0
    ? Math.round((filteredOppsAll.filter((o) => o.stage === 'Won').length / filteredOppsAll.length) * 100)
    : 0;

  // 2. Top Opportunities
  const topOpps = [...filteredOpps]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  // 3. Forecast Revenue by Account Type Breakdown (Strategic, Non Strategic, New)
  const accountTypes = ['Strategic', 'Non Strategic', 'New'];
  const accountTypeColors = ['#3b82f6', '#10b981', '#8b5cf6'];
  const typeBreakdown = accountTypes.map((type, idx) => {
    const oppsInType = filteredOpps.filter(o => {
      const acc = accounts.find(a => a.id === o.accountId);
      return acc?.type === type;
    });
    const val = oppsInType.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);
    const pct = totalForecastValue > 0 ? Math.round((val / totalForecastValue) * 100) : 0;
    return {
      type,
      val,
      pct,
      color: accountTypeColors[idx]
    };
  });

  const accountName = selectedAccountId === 'All'
    ? 'All Accounts'
    : accounts.find(a => a.id === selectedAccountId)?.name || 'Account';
  const periodLabel = fyLabel
    ? `FY ${fyLabel}${selectedQuarter !== 'All' ? ` — ${selectedQuarter}` : ' — All Quarters'}`
    : `All Financial Years${selectedQuarter !== 'All' ? ` — ${selectedQuarter}` : ''}`;

  // Bundles every report on the page into a single export, reusing the exact
  // same calculation functions each report component calls internally —
  // on-screen and bundled export can never disagree.
  const buildFullReportDefinition = () => ({
    title: 'AccTrack Pro — Reports',
    subtitle: `${periodLabel} · ${accountName}`,
    fileName: buildExportFileName('reports-full', periodLabel, accountName),
    sections: [
      toStageSection(stageData),
      toTopOppsSection(topOpps),
      toAccountTypeSection(typeBreakdown),
      toLocationRevenueSection(locationRevenueRows),
      toServiceRevenueSection(serviceRevenueRows),
      toStageRevenueSection(stageRevenueRows),
    ],
  });
  const handleExportAllPdf = () => {
    exportReportToPdf(buildFullReportDefinition()).catch((err) => console.error('[Reports] Export All (PDF) failed:', err));
  };
  const handleExportAllXlsx = () => {
    exportReportToXlsx(buildFullReportDefinition()).catch((err) => console.error('[Reports] Export All (Excel) failed:', err));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Corporate Executive Dashboard"
        subtitle="Dynamic client portfolio operations metrics, forecasts, and status breakdowns."
        actions={
          <ReportExportMenu label="Export All" onExportPdf={handleExportAllPdf} onExportXlsx={handleExportAllXlsx} />
        }
      />

      <ReportsFilterBar
        filters={filters}
        onChange={setFilter}
        onReset={resetFilters}
        industryOptions={industryOptions}
        locationOptions={locationOptions}
        activeFilterCount={activeFilterCount}
      />

      {loading ? (
        <CardSkeleton cards={2} className="grid grid-cols-1 lg:grid-cols-5 gap-6" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <PipelineByStageCard
            stageData={stageChartData}
            totalPipelineValue={totalPipelineValue}
            conversionRate={conversionRate}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {loading ? (
        <CardSkeleton cards={2} className="grid grid-cols-1 lg:grid-cols-5 gap-6" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <TopOpportunitiesCard topOpps={topOpps} formatCurrency={formatCurrency} onViewAll={() => setView('opportunities')} />
          <RevenueByAccountTypeCard
            typeBreakdown={typeBreakdown}
            formatCurrency={formatCurrency}
            periodLabel={selectedYear === 'All' ? 'All FYs' : `FY ${selectedYear}`}
          />
        </div>
      )}

      <ReportsSectionHeading title="Revenue Reports" subtitle="Respects the filters above" />

      <div className="space-y-6">
        <LocationRevenueReport
          opportunities={filteredOppsAll}
          periodLabel={periodLabel}
          accountLabel={accountName}
          loading={loading}
          formatCurrency={formatCurrency}
        />
        <ServiceRevenueReport
          opportunities={filteredOppsAll}
          periodLabel={periodLabel}
          accountLabel={accountName}
          loading={loading}
          formatCurrency={formatCurrency}
        />
        <StageRevenueReport
          opportunities={filteredOppsAll}
          periodLabel={periodLabel}
          accountLabel={accountName}
          loading={loading}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
};
