/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { PeriodSelector } from './PeriodSelector';
import { exportReportToXlsx, exportCurrency, buildExportFileName } from '@/utils/exportReport';
import { ArrowUpRight, Download, Layers, Target, TrendingUp } from 'lucide-react';
import { Button, Card, EmptyState, FilterBar, FilterSelect, PageHeader, SummaryCard } from '@/components/ui';

export const RevenueForecastView: React.FC = () => {
  const { accounts, opportunities, selectedYear, selectedQuarter } = useCRM();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('All');

  // selectedYear is already the fyLabel (e.g. "2026-27") — no conversion needed.
  const fyLabel = selectedYear !== 'All' ? selectedYear : null;

  // Reporting model: fiscal period comes from the backend-derived labels
  // (computed from each opportunity's Allocation End Date via the configured
  // Financial Calendar). Closed-lost deals never contribute to forecasts.
  const filteredOpps = opportunities.filter(o => {
    if (o.stage === 'Lost') return false;
    if (selectedAccountId !== 'All' && o.accountId !== selectedAccountId) return false;
    if (fyLabel && o.financialYear !== fyLabel) return false;
    if (selectedQuarter !== 'All' && o.quarter !== selectedQuarter) return false;
    return true;
  });

  // Dynamic KPI Cards
  const totalPipelineValue = filteredOpps.reduce((sum, o) => sum + o.value, 0);
  const totalForecastValue = filteredOpps.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);
  const committedForecastValue = filteredOpps
    .filter(o => o.probability >= 70)
    .reduce((sum, o) => sum + o.value * (o.probability / 100), 0);
  const bestCaseForecastValue = filteredOpps.reduce((sum, o) => sum + o.value * Math.max(0.5, o.probability / 100), 0);

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

  // IFY-aware SVG x-axis labels for Q1-Q4 based on selected year
  const fyStart = selectedYear !== 'All' ? parseInt(selectedYear, 10) : new Date().getFullYear();
  const fyEnd = fyStart + 1;
  const qLabels = [
    `Q1 ${fyStart}`,   // Apr-Jun of start year
    `Q2 ${fyStart}`,   // Jul-Sep of start year
    `Q3 ${fyStart}`,   // Oct-Dec of start year
    `Q4 ${fyEnd}`,     // Jan-Mar of end year
  ];

  // Forecast by Quarter — accumulate from filteredOpps (already FY+quarter filtered)
  const qForecasts = [0, 0, 0, 0]; // [Q1, Q2, Q3, Q4]
  filteredOpps.forEach(opp => {
    const val = opp.value * (opp.probability / 100);
    if      (opp.quarter === 'Q1') qForecasts[0] += val;
    else if (opp.quarter === 'Q2') qForecasts[1] += val;
    else if (opp.quarter === 'Q3') qForecasts[2] += val;
    else if (opp.quarter === 'Q4') qForecasts[3] += val;
  });

  const maxQValue = Math.max(...qForecasts, 100000);

  // Period display label
  const periodLabel = fyLabel
    ? `FY ${fyLabel}${selectedQuarter !== 'All' ? ` — ${selectedQuarter}` : ' — All Quarters'}`
    : `All Financial Years${selectedQuarter !== 'All' ? ` — ${selectedQuarter}` : ''}`;

  // ── Chart helpers ─────────────────────────────────────────────────────────────

  // Full spline chart (Quarter = All)
  const getSvgYCoord = (val: number) => 170 - (val / maxQValue) * 140;
  const q1Y = getSvgYCoord(qForecasts[0]);
  const q2Y = getSvgYCoord(qForecasts[1]);
  const q3Y = getSvgYCoord(qForecasts[2]);
  const q4Y = getSvgYCoord(qForecasts[3]);
  const bezierPathD = `M 80 ${q1Y} Q 130 ${(q1Y + q2Y) / 2}, 180 ${q2Y} Q 230 ${(q2Y + q3Y) / 2}, 280 ${q3Y} Q 330 ${(q3Y + q4Y) / 2}, 380 ${q4Y}`;
  const areaPathD = `M 80 ${q1Y} Q 130 ${(q1Y + q2Y) / 2}, 180 ${q2Y} Q 230 ${(q2Y + q3Y) / 2}, 280 ${q3Y} Q 330 ${(q3Y + q4Y) / 2}, 380 ${q4Y} L 380 170 L 80 170 Z`;

  // Single-quarter bar chart
  const singleQIdx = ['Q1', 'Q2', 'Q3', 'Q4'].indexOf(selectedQuarter);
  const singleQValue = singleQIdx >= 0 ? qForecasts[singleQIdx] : 0;
  const singleQLabel = singleQIdx >= 0 ? qLabels[singleQIdx] : '';
  const barHeight = singleQValue > 0 ? Math.max(4, (singleQValue / maxQValue) * 150) : 4;
  const barTop = 170 - barHeight;

  // 2. Forecast list: by Account (if 'All') or by Opportunity (if single account)
  const breakdownList = selectedAccountId === 'All'
    ? accounts.map(acc => {
        const accOpps = filteredOpps.filter(o => o.accountId === acc.id);
        const val = accOpps.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);
        return { name: acc.name, value: val };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    : filteredOpps.map(opp => {
        const val = opp.value * (opp.probability / 100);
        return { name: opp.name, value: val };
      })
      .sort((a, b) => b.value - a.value);

  const breakdownSum = breakdownList.reduce((sum, item) => sum + item.value, 0);

  // Export exactly what the page currently displays (same filters, same figures).
  const handleExport = () => {
    const accountName = selectedAccountId === 'All'
      ? 'All Accounts'
      : accounts.find(a => a.id === selectedAccountId)?.name || 'Account';

    // Committed ratio: committed forecast as % of total forecast
    const committedRatio = totalForecastValue > 0
      ? `${Math.round((committedForecastValue / totalForecastValue) * 100)}%`
      : '0%';

    // Pipeline by stage — weighted forecast and raw pipeline per stage
    const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Lost'];
    const stageRows = stages.map(stage => {
      const stageOpps = filteredOpps.filter(o => o.stage === stage);
      const rawPipeline = stageOpps.reduce((s, o) => s + o.value, 0);
      const weighted = stageOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0);
      const share = totalPipelineValue > 0 ? `${Math.round((rawPipeline / totalPipelineValue) * 100)}%` : '0%';
      return [stage, stageOpps.length, exportCurrency(rawPipeline), exportCurrency(weighted), share];
    });

    // Quarterly raw pipeline alongside weighted forecast
    const qRawPipelines = [0, 0, 0, 0];
    filteredOpps.forEach(opp => {
      if      (opp.quarter === 'Q1') qRawPipelines[0] += opp.value;
      else if (opp.quarter === 'Q2') qRawPipelines[1] += opp.value;
      else if (opp.quarter === 'Q3') qRawPipelines[2] += opp.value;
      else if (opp.quarter === 'Q4') qRawPipelines[3] += opp.value;
    });

    exportReportToXlsx({
      title: 'Revenue Forecast Model',
      subtitle: `${periodLabel} · ${accountName}`,
      fileName: buildExportFileName('forecast-model', periodLabel, accountName),
      sections: [
        {
          title: 'Summary',
          headers: ['Metric', 'Value'],
          rows: [
            ['Period', periodLabel],
            ['Account Scope', accountName],
            ['Opportunities in Model', filteredOpps.length],
            ['Total Raw Pipeline (unweighted)', exportCurrency(totalPipelineValue)],
            ['Total Weighted Forecast', exportCurrency(totalForecastValue)],
            ['Committed Forecast (probability ≥ 70%)', exportCurrency(committedForecastValue)],
            ['Committed as % of Total Forecast', committedRatio],
            ['Best Case Forecast (50% floor)', exportCurrency(bestCaseForecastValue)],
          ],
        },
        {
          title: 'Forecast by Quarter',
          headers: ['Quarter', 'Opportunities', 'Raw Pipeline', 'Weighted Forecast', 'Share of Total'],
          rows: qLabels.map((label, i) => [
            label,
            filteredOpps.filter(o => o.quarter === `Q${i + 1}`).length,
            exportCurrency(qRawPipelines[i]),
            exportCurrency(qForecasts[i]),
            totalForecastValue > 0 ? `${Math.round((qForecasts[i] / totalForecastValue) * 100)}%` : '0%',
          ]),
        },
        {
          title: 'Pipeline by Stage',
          headers: ['Stage', 'Opportunities', 'Raw Pipeline', 'Weighted Forecast', 'Share of Pipeline'],
          rows: stageRows,
        },
        {
          title: selectedAccountId === 'All' ? 'Forecast by Account' : 'Forecast by Opportunity',
          headers: ['Name', 'Weighted Forecast', 'Share of Total'],
          rows: breakdownList.map(item => [
            item.name,
            exportCurrency(item.value),
            breakdownSum > 0 ? `${Math.round((item.value / breakdownSum) * 100)}%` : '0%',
          ]),
        },
        {
          title: 'Opportunity Detail',
          headers: ['Opportunity', 'Account', 'Stage', 'Allocation End Date', 'Raw Value', 'Probability', 'Weighted Forecast', 'Financial Year', 'Quarter'],
          rows: filteredOpps
            .slice()
            .sort((a, b) => (b.value * b.probability) - (a.value * a.probability))
            .map(o => [
              o.name,
              accounts.find(a => a.id === o.accountId)?.name || '—',
              o.stage,
              o.allocationEndDate || '—',
              exportCurrency(o.value),
              `${o.probability}%`,
              exportCurrency(o.value * (o.probability / 100)),
              o.financialYear || '—',
              o.quarter || '—',
            ]),
        },
      ],
    }).catch((err) => console.error('[Forecast] Export failed:', err));
  };

  return (
    <div className="space-y-6">
      {/* Title Header & Controls */}
      <PageHeader
        title="Revenue Forecast Modeling"
        subtitle="Weighted opportunity pipelines, achievement tracking, and predictive quarter analysis."
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={<Download className="w-4 h-4 text-slate-400" aria-hidden="true" />}
            onClick={handleExport}
          >
            Export Model
          </Button>
        }
      />

      <FilterBar>
        {/* Reporting-period selector — fiscal period derived from Allocation End Dates */}
        <PeriodSelector />

        <FilterSelect
          label="Filter Model"
          hideLabel
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          options={[
            { value: 'All', label: 'All Portfolio Accounts' },
            ...accounts.map(acc => ({ value: acc.id, label: acc.name })),
          ]}
          className="w-56"
        />
      </FilterBar>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Forecast by Quarter */}
        <Card
          title="Forecast by Quarter"
          actions={
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/50">
              Weighted Sum
            </span>
          }
        >
          <div className="relative py-2">
            {selectedQuarter === 'All' ? (
              /* ── All quarters: spline chart ─────────────────────────────── */
              <svg viewBox="0 0 450 200" className="w-full h-auto">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="430" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="60" x2="430" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="100" x2="430" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="140" x2="430" y2="140" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="170" x2="430" y2="170" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Y Axis Labels */}
                <text x="30" y="24" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">{formatCurrency(maxQValue)}</text>
                <text x="30" y="74" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">{formatCurrency(maxQValue * 0.66)}</text>
                <text x="30" y="124" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">{formatCurrency(maxQValue * 0.33)}</text>
                <text x="30" y="174" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">$0</text>

                {/* X Axis Labels */}
                <text x="80" y="190" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="middle">{qLabels[0]}</text>
                <text x="180" y="190" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="middle">{qLabels[1]}</text>
                <text x="280" y="190" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="middle">{qLabels[2]}</text>
                <text x="380" y="190" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="middle">{qLabels[3]}</text>

                {/* Smooth Bezier Spline */}
                <path d={bezierPathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
                <path d={areaPathD} fill="url(#gradient-area)" opacity="0.1" />

                <defs>
                  <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <circle cx="80" cy={q1Y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                <text x="80" y={q1Y - 10} fontSize="9" fontFamily="monospace" fontWeight="700" fill="#1e293b" textAnchor="middle">{formatCurrency(qForecasts[0])}</text>

                <circle cx="180" cy={q2Y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                <text x="180" y={q2Y - 10} fontSize="9" fontFamily="monospace" fontWeight="700" fill="#1e293b" textAnchor="middle">{formatCurrency(qForecasts[1])}</text>

                <circle cx="280" cy={q3Y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                <text x="280" y={q3Y - 10} fontSize="9" fontFamily="monospace" fontWeight="700" fill="#1e293b" textAnchor="middle">{formatCurrency(qForecasts[2])}</text>

                <circle cx="380" cy={q4Y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                <text x="380" y={q4Y - 10} fontSize="9" fontFamily="monospace" fontWeight="700" fill="#1d4ed8" textAnchor="middle">{formatCurrency(qForecasts[3])}</text>
              </svg>
            ) : (
              /* ── Single quarter: bar chart ───────────────────────────────── */
              <svg viewBox="0 0 450 200" className="w-full h-auto">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="430" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="60" x2="430" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="100" x2="430" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="140" x2="430" y2="140" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="170" x2="430" y2="170" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Y Axis Labels */}
                <text x="30" y="24" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">{formatCurrency(maxQValue)}</text>
                <text x="30" y="74" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">{formatCurrency(maxQValue * 0.66)}</text>
                <text x="30" y="124" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">{formatCurrency(maxQValue * 0.33)}</text>
                <text x="30" y="174" fontSize="9" fontFamily="monospace" fontWeight="600" fill="#94a3b8" textAnchor="end">$0</text>

                <defs>
                  <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                {/* Single centered bar */}
                <rect x="185" y={barTop} width="80" height={barHeight} fill="url(#bar-gradient)" rx="4" opacity="0.9" />

                {/* Value label above bar */}
                <text x="225" y={barTop - 8} fontSize="10" fontFamily="monospace" fontWeight="700" fill="#1e293b" textAnchor="middle">
                  {formatCurrency(singleQValue)}
                </text>

                {/* X axis label */}
                <text x="225" y="190" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="middle">{singleQLabel}</text>
              </svg>
            )}
          </div>
        </Card>

        {/* Forecast Breakdown: by Account or Opportunity */}
        <Card
          title={selectedAccountId === 'All' ? 'Forecast by Account' : 'Forecast by Opportunity'}
          actions={
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
              TOTAL: {formatCurrency(breakdownSum)}
            </span>
          }
        >
          <div className="space-y-4 py-1.5">
            {breakdownList.length === 0 ? (
              <EmptyState
                icon={<Layers className="w-6 h-6 text-slate-400" aria-hidden="true" />}
                title="No weighted pipeline to model"
                hint="Adjust the account or period filters to see a forecast breakdown."
              />
            ) : (
              breakdownList.map(item => {
                const pct = breakdownSum > 0 ? Math.round((item.value / breakdownSum) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-700 truncate max-w-[70%]">{item.name}</span>
                      <span className="text-slate-900 font-mono font-bold">{formatCurrency(item.value)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <SummaryCard
          label="Total Forecast"
          value={formatCurrency(totalForecastValue)}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="emerald"
        />

        <SummaryCard
          label="Committed Pipeline"
          value={formatCurrency(committedForecastValue)}
          icon={<Target className="w-5 h-5" />}
          tone="purple"
        />

        <SummaryCard
          label="Best Case Forecast"
          value={formatCurrency(bestCaseForecastValue)}
          icon={<ArrowUpRight className="w-5 h-5" />}
          tone="blue"
        />

        <SummaryCard
          label="Total Raw Pipeline"
          value={formatCurrency(totalPipelineValue)}
          icon={<Layers className="w-5 h-5" />}
          tone="indigo"
        />
      </div>
    </div>
  );
};
