/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { PeriodSelector } from './PeriodSelector';
import { exportReportToPdf, exportCurrency, buildExportFileName } from '@/utils/exportReport';
import { deriveOppStatus, isOpenActionItemStatus } from '@/utils';
import {
  Download,
  ArrowUpRight,
  Building2,
  Target,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  SummaryCard,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
  FilterBar,
  FilterSelect,
  EmptyRow,
} from '@/components/ui';
import type { CardTone } from '@/components/ui';

// Icon + tone per KPI tile, in the same order as the `kpis` array below.
const KPI_ICONS = [
  <Building2 className="w-5 h-5" />,
  <Target className="w-5 h-5" />,
  <DollarSign className="w-5 h-5" />,
  <TrendingUp className="w-5 h-5" />,
  <AlertTriangle className="w-5 h-5" />,
  <ListChecks className="w-5 h-5" />,
];
const KPI_TONES: CardTone[] = ['blue', 'indigo', 'emerald', 'purple', 'amber', 'slate'];

export const ExecutiveDashboardView: React.FC = () => {
  const { accounts, opportunities, actionItems, selectedYear, selectedQuarter } = useCRM();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('All');

  // Reporting view: the FY/Quarter selector applies here, using the
  // backend-derived fiscal labels (from close/due dates via the configured
  // Financial Calendar). Closed-lost deals are excluded from all figures.
  const fyLabel = selectedYear !== 'All' ? selectedYear : null;

  const filteredOpps = opportunities.filter(o => {
    if (o.stage === 'Lost') return false;
    if (selectedAccountId !== 'All' && o.accountId !== selectedAccountId) return false;
    if (fyLabel && o.financialYear !== fyLabel) return false;
    if (selectedQuarter !== 'All' && o.quarter !== selectedQuarter) return false;
    return true;
  });

  // Accounts have no fiscal dimension — only the report's account filter applies.
  const filteredAccounts = selectedAccountId === 'All'
    ? accounts
    : accounts.filter(a => a.id === selectedAccountId);

  const filteredActionItems = actionItems.filter(ai => {
    if (selectedAccountId !== 'All' && ai.accountId !== selectedAccountId) return false;
    if (fyLabel && ai.financialYear !== fyLabel) return false;
    if (selectedQuarter !== 'All' && ai.quarter !== selectedQuarter) return false;
    return true;
  });

  // Core Aggregations
  const totalPipelineValue = filteredOpps.reduce((sum, o) => sum + o.value, 0);
  const totalForecastValue = filteredOpps.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);
  const openOppsCount = filteredOpps.filter(o => deriveOppStatus(o.stage) === 'Open').length;
  const pendingActionsCount = filteredActionItems.filter(ai => isOpenActionItemStatus(ai.status)).length;

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

  // 1. Dynamic KPIs
  const kpis = [
    {
      label: selectedAccountId === 'All' ? 'Total Accounts' : 'Account Type',
      val: selectedAccountId === 'All' ? filteredAccounts.length.toString() : (accounts.find(a => a.id === selectedAccountId)?.type || 'New'),
    },
    {
      label: 'Open Opportunities',
      val: openOppsCount.toString(),
    },
    {
      label: 'Pipeline Value',
      val: formatCurrency(totalPipelineValue),
    },
    {
      label: 'Forecast Revenue',
      val: formatCurrency(totalForecastValue),
    },
    {
      label: selectedAccountId === 'All' ? 'At-Risk Accounts' : 'Account Health',
      val: selectedAccountId === 'All'
        ? filteredAccounts.filter(a => a.health !== 'Green').length.toString()
        : (accounts.find(a => a.id === selectedAccountId)?.health || 'Green'),
    },
    {
      label: 'Pending Tasks',
      val: pendingActionsCount.toString(),
    }
  ];

  // 2. Pipeline by Stage
  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Blocked', 'Delayed', 'Lost'];
  const colors = [
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-emerald-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-red-500',
  ];
  const stageData = stages.map((stage, i) => {
    const value = filteredOpps.filter(o => o.stage === stage).reduce((sum, o) => sum + o.value, 0);
    const pct = totalPipelineValue > 0 ? Math.round((value / totalPipelineValue) * 100) : 0;
    return {
      stage,
      val: formatCurrency(value),
      pct,
      color: colors[i]
    };
  });

  // 3. Forecast vs Target
  // If 'All', target is $5.0M. Otherwise, target is dynamically sized (1.3x forecast or min $500K)
  const targetValue = selectedAccountId === 'All'
    ? 5000000
    : Math.max(500000, Math.round(totalForecastValue * 1.3 / 100000) * 100000);

  const targetMetPct = targetValue > 0 ? Math.min(100, Math.round((totalForecastValue / targetValue) * 100)) : 0;

  // 4. Top Opportunities
  const topOpps = [...filteredOpps]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  // 5. Forecast Revenue by Account Type Breakdown (Strategic, Non Strategic, New)
  const accountTypes = ['Strategic', 'Non Strategic', 'New'];
  const donutColors = ['#3b82f6', '#10b981', '#8b5cf6'];
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
      color: donutColors[idx]
    };
  });

  // Export exactly what the page currently displays (same filters, same figures).
  const handleExport = () => {
    const accountName = selectedAccountId === 'All'
      ? 'All Accounts'
      : accounts.find(a => a.id === selectedAccountId)?.name || 'Account';
    const periodLabel = fyLabel
      ? `FY ${fyLabel}${selectedQuarter !== 'All' ? ` — ${selectedQuarter}` : ' — All Quarters'}`
      : `All Financial Years${selectedQuarter !== 'All' ? ` — ${selectedQuarter}` : ''}`;

    exportReportToPdf({
      title: 'Executive Summary',
      subtitle: `${periodLabel} · ${accountName}`,
      fileName: buildExportFileName('executive-summary', periodLabel, accountName),
      sections: [
        {
          title: 'Key Performance Indicators',
          headers: ['Metric', 'Value'],
          rows: kpis.map(kpi => [kpi.label, kpi.val]),
        },
        {
          title: 'Pipeline by Stage',
          headers: ['Stage', 'Pipeline Value', 'Share'],
          rows: stageData.map(item => [item.stage, item.val, `${item.pct}%`]),
        },
        {
          title: 'Forecast vs Target',
          headers: ['Metric', 'Value'],
          rows: [
            ['Forecast Revenue (weighted)', exportCurrency(totalForecastValue)],
            ['Target Goal', exportCurrency(targetValue)],
            ['Target Met', `${targetMetPct}%`],
          ],
        },
        {
          title: 'Top Opportunities',
          headers: ['Opportunity', 'Value', 'Probability'],
          rows: topOpps.map(opp => [opp.name, exportCurrency(opp.value), `${opp.probability}%`]),
        },
        {
          title: 'Forecast Revenue by Account Type',
          headers: ['Account Type', 'Weighted Forecast', 'Share'],
          rows: typeBreakdown.map(item => [item.type, exportCurrency(item.val), `${item.pct}%`]),
        },
      ],
    }).catch((err) => console.error('[Reports] Export failed:', err));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corporate Executive Dashboard"
        subtitle="Dynamic client portfolio operations metrics, forecasts, and status breakdowns."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />}
            onClick={handleExport}
          >
            Export Summary
          </Button>
        }
      />

      <FilterBar>
        <PeriodSelector />
        <FilterSelect
          label="Filter Report"
          hideLabel
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          options={[
            { value: 'All', label: 'All Portfolio Accounts' },
            ...accounts.map(acc => ({ value: acc.id, label: `${acc.name} (${acc.type})` })),
          ]}
          className="w-64"
        />
      </FilterBar>

      {/* KPI Metrics Row - 6 items */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <SummaryCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.val}
            icon={KPI_ICONS[i]}
            tone={KPI_TONES[i]}
          />
        ))}
      </div>

      {/* Second Row: Pipeline by Stage & Forecast vs Target */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-7">
        {/* Pipeline by Stage Card */}
        <Card
          title="Pipeline by Stage"
          actions={
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold font-mono">
              TOTAL: {formatCurrency(totalPipelineValue)}
            </span>
          }
          className="lg:col-span-3"
        >
          {/* Horizontal Bar Chart */}
          <div className="space-y-4 py-2">
            {stageData.map(item => (
              <div key={item.stage} className="space-y-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600">{item.stage}</span>
                  <span className="text-slate-900 font-mono">{item.val} ({item.pct}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Forecast vs Target Gauge Card */}
        <Card
          title="Forecast vs Target"
          actions={
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${targetMetPct >= 80 ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-orange-50'}`}>
              {targetMetPct >= 85 ? 'ON TARGET' : 'IN PLAY'}
            </span>
          }
          className="lg:col-span-2"
          bodyClassName="h-full flex flex-col justify-between"
        >
          <div>
            {/* Circle radial progress */}
            <div className="flex items-center justify-center relative py-2">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle cx="72" cy="72" r="56" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                <circle
                  cx="72"
                  cy="72"
                  r="56"
                  stroke={targetMetPct >= 80 ? '#10b981' : '#f59e0b'}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={351.8}
                  strokeDashoffset={351.8 - (351.8 * targetMetPct) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute text-center flex flex-col justify-center items-center">
                <span className="text-2xl font-black text-slate-800 font-mono">{formatCurrency(totalForecastValue)}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Forecast</span>
              </div>
            </div>
          </div>

          <div className="text-center border-t border-slate-100 pt-3 mt-4 text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Target Goal: {formatCurrency(targetValue)}</span>
            <span className={`${targetMetPct >= 80 ? 'text-green-600' : 'text-orange-500'} font-bold`}>{targetMetPct}% Met</span>
          </div>
        </Card>
      </div>

      {/* Third Row: Top Opportunities & Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-7">
        {/* Top Opportunities list */}
        <Card
          title="Top Opportunities"
          actions={<span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold font-mono">PRIORITY PIPELINE</span>}
          className="lg:col-span-3"
        >
          <div className="overflow-x-auto text-xs font-medium">
            <Table>
              <TableHead>
                <TableHeadCell>Opportunity Name</TableHeadCell>
                <TableHeadCell align="right">Value</TableHeadCell>
                <TableHeadCell align="center">Probability</TableHeadCell>
              </TableHead>
              <tbody>
                {topOpps.length === 0 ? (
                  <EmptyRow colSpan={3} message="No active opportunities for this account filter selection." />
                ) : (
                  topOpps.map(opp => (
                    <TableRow key={opp.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                          <span>{opp.name}</span>
                        </div>
                      </TableCell>
                      <TableCell align="right" className="font-bold text-slate-900 font-mono">{formatCurrency(opp.value)}</TableCell>
                      <TableCell align="center" className="font-bold text-emerald-600 font-mono">{opp.probability}%</TableCell>
                    </TableRow>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>

        {/* Forecast Revenue by Account Type Breakdown */}
        <Card
          title="Revenue by Account Type"
          actions={
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold font-mono">
              {selectedYear === 'All' ? 'All FYs' : `FY ${selectedYear}`}
            </span>
          }
          className="lg:col-span-2"
          bodyClassName="h-full flex flex-col justify-between"
        >
          <div>
            {/* Pie diagram */}
            <div className="flex items-center justify-center relative py-2">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="38" stroke="#3b82f6" strokeWidth="12" fill="none" strokeDasharray={238.7} strokeDashoffset={238.7 - (238.7 * (typeBreakdown[0]?.pct || 0)) / 100} />
                <circle cx="48" cy="48" r="38" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray={238.7} strokeDashoffset={238.7 - (238.7 * (typeBreakdown[1]?.pct || 0)) / 100} transform={`rotate(${(typeBreakdown[0]?.pct || 0) * 3.6} 48 48)`} />
                <circle cx="48" cy="48" r="38" stroke="#8b5cf6" strokeWidth="12" fill="none" strokeDasharray={238.7} strokeDashoffset={238.7 - (238.7 * (typeBreakdown[2]?.pct || 0)) / 100} transform={`rotate(${((typeBreakdown[0]?.pct || 0) + (typeBreakdown[1]?.pct || 0)) * 3.6} 48 48)`} />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-[10px] mt-4 border-t border-slate-100 pt-3">
            {typeBreakdown.map((item) => (
              <div key={item.type} className="flex items-center justify-between font-semibold text-slate-600">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} />
                  <span>{item.type}</span>
                </div>
                <span className="font-mono text-slate-900">{formatCurrency(item.val)} ({item.pct}%)</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
