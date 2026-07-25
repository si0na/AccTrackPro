/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Portfolio Forecast — aggregated forecasting across every opportunity in scope
 * (respecting the shared FY / Quarter / Account filters and the panel filters).
 * Reuses the Reports page's chart language. All figures build on the same
 * canonical forecast calculation as the single-opportunity view.
 */

import React, { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Briefcase, Coins, Crosshair, Gauge, Hourglass, Layers, LineChart as LineChartIcon,
  Scale, Sparkles, TrendingUp, Trophy, Wallet, Building2,
} from 'lucide-react';
import type { Opportunity } from '@/types';
import {
  Card, EmptyState, Table, TableCell, TableHead, TableHeadCell, TableRow,
} from '@/components/ui';
import {
  ChartContainer, DonutChart, HorizontalBarChart, RadialGaugeChart,
  AXIS_TICK_STYLE, CHART_MARGIN, GRID_STROKE, LEGEND_STYLE, TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE, CATEGORICAL_CHART_COLORS, OTHER_CATEGORY_COLOR, SEQUENTIAL_CHART_COLOR,
} from '@/components/ui/charts';
import type { HorizontalBarDatum } from '@/components/ui/charts';
import { KpiCard, StatusPill, ComparisonRow, InsightCard, ForecastSectionHeading } from './forecastUi';
import {
  derivePortfolioMetrics, buildPortfolioInsights,
  formatCurrency, formatCurrencyShort, formatSignedCurrency, formatSignedPct,
  type Granularity,
} from './forecastMath';

const granularityLabel = (g: Granularity) => (g === 'month' ? 'Month' : g === 'quarter' ? 'Quarter' : 'Financial Year');

export interface PortfolioForecastPanelProps {
  opportunities: Opportunity[];
  granularity: Granularity;
}

export const PortfolioForecastPanel: React.FC<PortfolioForecastPanelProps> = ({ opportunities, granularity }) => {
  const m = useMemo(() => derivePortfolioMetrics(opportunities), [opportunities]);
  const insights = useMemo(() => buildPortfolioInsights(m, granularity), [m, granularity]);

  const periodSeries = granularity === 'month' ? m.byMonth : granularity === 'quarter' ? m.byQuarter : m.byFy;
  const periodRows = useMemo(
    () => periodSeries.map((d) => ({ period: d.label, Forecast: d.forecast, Actual: d.actual })),
    [periodSeries],
  );

  // ── Chart datasets (Reports chart language) ──────────────────────────────────
  const stageBars = useMemo(
    () => m.byStage.filter((s) => s.forecast > 0).map((s) => ({ label: s.label, value: s.forecast, color: s.color })),
    [m.byStage],
  );

  const serviceBars = useMemo<HorizontalBarDatum[]>(() => {
    const rows = m.byServiceLine.filter((s) => s.forecast > 0);
    const top: HorizontalBarDatum[] = rows.slice(0, 8).map((s, i) => ({ label: s.label, value: s.forecast, color: CATEGORICAL_CHART_COLORS[i % CATEGORICAL_CHART_COLORS.length] }));
    const rest = rows.slice(8);
    if (rest.length) top.push({ label: `Other (${rest.length})`, value: rest.reduce((a, b) => a + b.forecast, 0), color: OTHER_CATEGORY_COLOR });
    return top;
  }, [m.byServiceLine]);

  const accountBars = useMemo<HorizontalBarDatum[]>(() => {
    const rows = m.byAccount.filter((a) => a.forecast > 0);
    const top: HorizontalBarDatum[] = rows.slice(0, 8).map((a) => ({ label: a.label, value: a.forecast, color: SEQUENTIAL_CHART_COLOR }));
    const rest = rows.slice(8);
    if (rest.length) top.push({ label: `Other (${rest.length})`, value: rest.reduce((s, b) => s + b.forecast, 0), color: OTHER_CATEGORY_COLOR });
    return top;
  }, [m.byAccount]);

  const distributionDonut = useMemo(
    () => m.byStage.filter((s) => s.forecast > 0).map((s) => ({ name: s.label, value: s.forecast, color: s.color })),
    [m.byStage],
  );

  if (m.count === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-6 h-6 text-slate-400" aria-hidden="true" />}
        title="No opportunities in scope"
        hint="Adjust the Reporting Period, Status or filters above to see the portfolio forecast."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Portfolio KPIs ───────────────────────────────────────────────────── */}
      <ForecastSectionHeading
        title="Portfolio Metrics"
        subtitle={`Aggregated across ${m.count} opportunit${m.count === 1 ? 'y' : 'ies'} in scope`}
        icon={<Gauge className="w-4 h-4" />}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total Forecast Revenue" value={formatCurrency(m.totalForecast)} icon={<TrendingUp className="w-5 h-5" />} tone="blue" hint={`${m.count} opportunities`} />
        <KpiCard label="Total Actual Revenue" value={formatCurrency(m.totalActual)} icon={<Wallet className="w-5 h-5" />} tone="emerald" hint={`${m.realizedCount} with recorded actuals`} />
        <KpiCard label="Remaining Forecast" value={formatCurrency(m.totalRemaining)} icon={<Hourglass className="w-5 h-5" />} tone="amber" hint="Revenue yet to be realised" />
        <KpiCard
          label="Overall Realization" value={`${m.realizationPct.toFixed(0)}%`}
          icon={<Gauge className="w-5 h-5" />} tone="indigo" progress={m.realizationPct} progressTone="indigo"
          hint={`${formatCurrency(m.totalActual)} realised`}
        />
        <KpiCard
          label="Overall Accuracy" value={m.accuracyPct !== null ? `${m.accuracyPct.toFixed(0)}%` : '—'}
          icon={<Crosshair className="w-5 h-5" />} tone="cyan" progress={m.accuracyPct ?? undefined} progressTone="cyan"
          hint={m.accuracyPct !== null ? 'Forecast vs realised accuracy' : 'Awaiting actuals'}
        />
        <KpiCard
          label="Forecast Variance" value={formatSignedCurrency(m.variance)}
          icon={<Scale className="w-5 h-5" />} tone={m.variance < 0 ? 'amber' : 'violet'}
          trend={m.variance === 0 ? 'flat' : m.variance > 0 ? 'up' : 'down'} trendLabel={formatSignedPct(m.variancePct)}
          hint="Actual vs Forecast"
        />
        <KpiCard label="Avg Deal Forecast" value={formatCurrency(m.avgDealForecast)} icon={<Coins className="w-5 h-5" />} tone="rose" hint="Per opportunity" />
        <KpiCard
          label="Opportunities" value={m.count}
          icon={<Briefcase className="w-5 h-5" />} tone="slate"
          hint={`${m.openCount} open · ${m.wonCount} won · ${m.lostCount} lost`}
        />
      </div>

      {/* ── Portfolio Forecast vs Actual ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Portfolio Forecast vs Actual" subtitle="Realised revenue against total forecast" className="lg:col-span-2">
          <div className="space-y-5">
            <ComparisonRow label="Total Forecast" value={formatCurrency(m.totalForecast)} pct={m.totalForecast > 0 ? 100 : 0} barClass="bg-blue-500" valueClass="text-blue-600" />
            <ComparisonRow
              label="Total Actual" value={formatCurrency(m.totalActual)} pct={m.realizationPct}
              barClass="bg-emerald-500" valueClass="text-emerald-600"
              caption={`${m.realizationPct.toFixed(0)}% of forecast realised`}
            />
            <ComparisonRow
              label="Remaining Revenue" value={formatCurrency(m.totalRemaining)}
              pct={m.totalForecast > 0 ? (m.totalRemaining / m.totalForecast) * 100 : 0}
              barClass="bg-slate-300" valueClass="text-slate-600"
            />
          </div>
        </Card>
        <Card title="Revenue Realized" subtitle="Portfolio realisation" bodyClassName="flex flex-col items-center justify-center">
          <RadialGaugeChart pct={m.realizationPct} color="#10b981" centerValue={`${m.realizationPct.toFixed(0)}%`} centerLabel="Realised" height={190} />
        </Card>
      </div>

      {/* ── Revenue over time + distribution ─────────────────────────────────── */}
      <ForecastSectionHeading
        title="Forecast Analytics"
        subtitle={`Revenue by ${granularityLabel(granularity).toLowerCase()} and distribution across the portfolio`}
        icon={<LineChartIcon className="w-4 h-4" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Revenue by ${granularityLabel(granularity)}`} subtitle="Forecast vs actual across periods">
          {periodRows.length ? (
            <ChartContainer height={300}>
              <BarChart data={periodRows} margin={CHART_MARGIN} barGap={6}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="period" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCurrencyShort} axisLine={false} tickLine={false} width={56} />
                <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(value, name) => [formatCurrency(Number(value)), name]}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar dataKey="Forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={44} />
                <Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ChartContainer>
          ) : <EmptyChart />}
        </Card>

        <Card title="Revenue Distribution" subtitle="Forecast share by stage" bodyClassName="flex items-center justify-center">
          {distributionDonut.length ? (
            <DonutChart data={distributionDonut} height={300} valueFormatter={formatCurrency} />
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* ── Breakdown bars ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Forecast by Stage" subtitle="Weighted forecast per pipeline stage" padding="none" clip>
          <div className="p-5">
            {stageBars.length ? <HorizontalBarChart data={stageBars} valueFormatter={formatCurrency} valueLabel="Forecast" /> : <EmptyChart />}
          </div>
        </Card>
        <Card title="Forecast by Service Line" subtitle="Weighted forecast per service line" padding="none" clip>
          <div className="p-5">
            {serviceBars.length ? <HorizontalBarChart data={serviceBars} valueFormatter={formatCurrency} valueLabel="Forecast" /> : <EmptyChart />}
          </div>
        </Card>
      </div>

      <Card title="Forecast by Account" subtitle="Top accounts by weighted forecast revenue" padding="none" clip>
        <div className="p-5">
          {accountBars.length ? <HorizontalBarChart data={accountBars} valueFormatter={formatCurrency} valueLabel="Forecast" labelWidth={160} /> : <EmptyChart />}
        </div>
      </Card>

      {/* ── Top tables ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Top Forecasted Opportunities" subtitle="Highest weighted forecast revenue" padding="none" clip
          actions={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"><Trophy className="w-3.5 h-3.5" />Top {m.topOpportunities.length}</span>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell>Opportunity</TableHeadCell>
                <TableHeadCell align="right">Forecast</TableHeadCell>
                <TableHeadCell align="right">Actual</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </TableHead>
              <tbody>
                {m.topOpportunities.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800 truncate max-w-[16rem]">{o.name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[16rem]">{o.accountName} · {o.stage}</div>
                    </TableCell>
                    <TableCell className="font-mono" align="right">{formatCurrency(o.forecast)}</TableCell>
                    <TableCell className="font-mono" align="right">{o.actual > 0 ? formatCurrency(o.actual) : '—'}</TableCell>
                    <TableCell><StatusPill status={o.status} size="sm" /></TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card
          title="Top Revenue Accounts" subtitle="Highest realised revenue" padding="none" clip
          actions={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"><Building2 className="w-3.5 h-3.5" />Top {m.topAccounts.length}</span>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell>Account</TableHeadCell>
                <TableHeadCell align="right">Opps</TableHeadCell>
                <TableHeadCell align="right">Forecast</TableHeadCell>
                <TableHeadCell align="right">Actual</TableHeadCell>
              </TableHead>
              <tbody>
                {m.topAccounts.map((a) => (
                  <TableRow key={a.accountId}>
                    <TableCell className="font-semibold text-slate-800"><span className="truncate block max-w-[14rem]">{a.label}</span></TableCell>
                    <TableCell className="font-mono" align="right">{a.count}</TableCell>
                    <TableCell className="font-mono" align="right">{formatCurrency(a.forecast)}</TableCell>
                    <TableCell className="font-mono" align="right">{a.actual > 0 ? formatCurrency(a.actual) : '—'}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      {/* ── Portfolio Insights ───────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <>
          <ForecastSectionHeading title="Portfolio Insights" subtitle="Automatically generated from the portfolio forecast" icon={<Sparkles className="w-4 h-4" />} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
          </div>
        </>
      )}
    </div>
  );
};

const EmptyChart: React.FC = () => (
  <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">No data for the current selection.</div>
);
