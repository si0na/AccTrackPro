/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Opportunity Forecast — the single-opportunity analytics dashboard. Forecast
 * revenue is DERIVED (Deal Value × Probability) and read-only; only the Actual
 * Revenue (date / amount / remarks) is editable, via the same upsert contract as
 * before. Everything else — KPIs, charts, insights, timeline, table — is
 * computed presentation that re-reads the selected Forecast View.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, Briefcase, Calendar, CalendarClock, Check, Coins, Crosshair, DollarSign,
  Edit2, Gauge, HeartPulse, Hourglass, Percent, Scale, Sparkles, Target, TrendingUp,
  User, Wallet, X, LineChart as LineChartIcon, ListChecks,
} from 'lucide-react';
import type { Opportunity, OpportunityForecastResult } from '@/types';
import { opportunityForecastApi } from '@/api/crm.api';
import { showToast } from '@/components/common/ToastHost';
import {
  Button, Card, DetailHeaderCard, ErrorBanner, FormField, FormGrid, INPUT_CLS,
  INPUT_CLS_AMBER, StatusBadge, STAGE_COLORS, HEALTH_COLORS, Table, TableCell, TableHead,
  TableHeadCell, TableRow,
} from '@/components/ui';
import {
  ChartContainer, RadialGaugeChart, AXIS_TICK_STYLE, CHART_MARGIN, GRID_STROKE, LEGEND_STYLE,
  TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE,
} from '@/components/ui/charts';
import { NumberInput } from '@/components/NumberInput';
import {
  KpiCard, StatusPill, ComparisonRow, InsightCard, ForecastSectionHeading, IconStat,
} from './forecastUi';
import {
  deriveOppMetrics, scaffoldSingleOpp, withCumulative, buildOppInsights,
  formatCurrency, formatCurrencyShort, formatSignedCurrency, formatSignedPct, formatMonthYear,
  formatFullDate, STATUS_TONE, type Granularity,
} from './forecastMath';

interface ActualForm {
  actualDate: string;
  actualValue: number;
  remarks: string;
}

const granularityLabel = (g: Granularity) => (g === 'month' ? 'Month' : g === 'quarter' ? 'Quarter' : 'Financial Year');

export interface OpportunityForecastPanelProps {
  data: OpportunityForecastResult;
  granularity: Granularity;
  quarterLabels: string[];
  currentUser: string;
  onRefetch: () => Promise<void> | void;
  onSaved: () => void;
}

export const OpportunityForecastPanel: React.FC<OpportunityForecastPanelProps> = ({
  data, granularity, quarterLabels, currentUser, onRefetch, onSaved,
}) => {
  const opp: Opportunity = data.opportunity;
  const forecast = data.forecast;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<ActualForm>({
    actualDate: forecast?.actualDate ?? '',
    actualValue: forecast?.actualValue ?? 0,
    remarks: forecast?.remarks ?? '',
  });

  const seedForm = useCallback((f: OpportunityForecastResult['forecast']) => {
    setForm({ actualDate: f?.actualDate ?? '', actualValue: f?.actualValue ?? 0, remarks: f?.remarks ?? '' });
  }, []);

  // ── Derived metrics (forecast is DERIVED; actuals come from the record) ─────
  const actual = forecast?.actualValue ?? null;
  const actualDate = forecast?.actualDate ?? null;
  const m = useMemo(() => deriveOppMetrics(opp, actual, actualDate), [opp, actual, actualDate]);
  const owner = (opp as Opportunity & { ownerName?: string }).ownerName ?? currentUser;

  // ── Period distribution driven by the Forecast View ─────────────────────────
  const distribution = useMemo(
    () => scaffoldSingleOpp(opp, actual, actualDate, granularity, quarterLabels),
    [opp, actual, actualDate, granularity, quarterLabels],
  );
  const trendData = useMemo(() => withCumulative(distribution), [distribution]);
  const chartRows = useMemo(
    () => distribution.map((d) => ({
      period: d.label,
      Forecast: d.forecast,
      Actual: d.hasActual ? d.actual : (d.forecast > 0 ? d.actual : 0),
    })),
    [distribution],
  );

  const insights = useMemo(() => buildOppInsights(opp, m, distribution, granularity), [opp, m, distribution, granularity]);

  // ── Table rows (populated periods only, with per-period variance) ───────────
  const tableRows = useMemo(
    () => distribution.filter((d) => d.forecast > 0 || d.actual > 0).map((d) => {
      const variance = d.hasActual ? d.actual - d.forecast : null;
      const variancePct = variance !== null && d.forecast > 0 ? (variance / d.forecast) * 100 : null;
      const remaining = Math.max(d.forecast - d.actual, 0);
      const status = d.hasActual
        ? (d.actual - d.forecast) / (d.forecast || 1) > 0.02 ? 'Ahead of Forecast'
          : (d.actual - d.forecast) / (d.forecast || 1) >= -0.02 ? 'On Track' : 'Below Forecast'
        : 'Pending';
      return { ...d, variance, variancePct, remaining, status: status as ReturnType<typeof deriveOppMetrics>['status'] };
    }),
    [distribution],
  );

  // ── Save (ONLY Actual Revenue is editable — unchanged upsert contract) ──────
  const handleSave = async () => {
    if (form.actualValue > 0 && !form.actualDate) { setFormError('Please provide the Actual Revenue Date.'); return; }
    if (form.actualDate && form.actualValue <= 0) { setFormError('Please provide the Actual Revenue Amount.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      await opportunityForecastApi.upsert(opp.id, {
        // Preserve any stored forecast date/value unchanged — the forecast is
        // derived and never edited here; we only mutate the actuals.
        forecastDate: forecast?.forecastDate ?? undefined,
        forecastValue: forecast?.forecastValue ?? undefined,
        actualDate: form.actualDate || undefined,
        actualValue: form.actualValue > 0 ? form.actualValue : undefined,
        remarks: form.remarks.trim() || undefined,
      });
      setEditing(false);
      showToast({ kind: 'success', message: 'Actual revenue saved.' });
      await onRefetch();
      onSaved();
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      setFormError(typeof raw === 'string' ? raw : (Array.isArray(raw) ? String(raw[0]) : 'Failed to save the actual revenue.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { seedForm(forecast); setEditing(false); setFormError(null); };
  const inputCls = editing ? INPUT_CLS_AMBER : INPUT_CLS;

  const varianceTrend = m.variance === null ? 'flat' : m.variance >= 0 ? 'up' : 'down';

  return (
    <div className="space-y-6">
      {/* ── Opportunity summary (read-only) ──────────────────────────────────── */}
      <DetailHeaderCard
        avatarContent={<TrendingUp className="w-6 h-6" aria-hidden="true" />}
        avatarColorClass="bg-indigo-50 text-indigo-600"
        title={opp.name}
        badges={
          <div className="flex items-center gap-2">
            <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />
            {opp.opportunityHealth && <StatusBadge value={opp.opportunityHealth} colorMap={HEALTH_COLORS} />}
            <StatusPill status={m.status} size="sm" />
          </div>
        }
        description="Automatically calculated forecast for this opportunity. Record actual revenue as it is realised."
        attributes={[
          { icon: <Briefcase className="w-4 h-4" />, label: 'Account', value: opp.accountName ?? '—' },
          { icon: <User className="w-4 h-4" />, label: 'Owner', value: owner },
          { icon: <Activity className="w-4 h-4" />, label: 'Stage', value: opp.stage },
          { icon: <Percent className="w-4 h-4" />, label: 'Probability', mono: true, value: `${opp.probability ?? 0}%` },
          { icon: <Calendar className="w-4 h-4" />, label: 'Expected Close Date', mono: true, value: opp.allocationEndDate || 'N/A' },
          { icon: <DollarSign className="w-4 h-4" />, label: 'Deal Value', mono: true, value: formatCurrency(opp.value) },
          { icon: <TrendingUp className="w-4 h-4" />, label: 'Forecast Revenue', mono: true, accent: true, value: formatCurrency(m.forecastRevenue) },
          { icon: <HeartPulse className="w-4 h-4" />, label: 'Health', value: opp.opportunityHealth ?? '—' },
        ]}
        attributesClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      />

      {formError && <ErrorBanner message={formError} />}

      {/* ── Forecast KPIs ────────────────────────────────────────────────────── */}
      <ForecastSectionHeading
        title="Forecast Metrics"
        subtitle="Key figures for this opportunity, reading the selected Forecast View"
        icon={<Gauge className="w-4 h-4" />}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Forecast Revenue" value={formatCurrency(m.forecastRevenue)} icon={<TrendingUp className="w-5 h-5" />} tone="blue" hint="Deal Value × Probability" />
        <KpiCard
          label="Actual Revenue"
          value={m.hasActual ? formatCurrency(m.actualRevenue) : '—'}
          icon={<Wallet className="w-5 h-5" />} tone="emerald"
          hint={m.hasActual ? `Recorded ${formatMonthYear(actualDate)}` : 'No actuals recorded yet'}
        />
        <KpiCard label="Remaining Forecast" value={formatCurrency(m.remainingForecast)} icon={<Hourglass className="w-5 h-5" />} tone="amber" hint="Forecast not yet realised" />
        <KpiCard
          label="Forecast Realization" value={`${m.realizationPct.toFixed(0)}%`}
          icon={<Gauge className="w-5 h-5" />} tone="indigo"
          progress={m.realizationPct} progressTone="indigo"
          hint={`${formatCurrency(m.actualRevenue)} of ${formatCurrency(m.forecastRevenue)}`}
        />
        <KpiCard
          label="Forecast Variance" value={m.variance !== null ? formatSignedCurrency(m.variance) : '—'}
          icon={<Scale className="w-5 h-5" />} tone={m.variance !== null && m.variance < 0 ? 'amber' : 'violet'}
          trend={m.hasActual ? varianceTrend : undefined} trendLabel={formatSignedPct(m.variancePct)}
          hint="Actual vs Forecast"
        />
        <KpiCard
          label="Forecast Accuracy" value={m.accuracyPct !== null ? `${m.accuracyPct.toFixed(0)}%` : '—'}
          icon={<Crosshair className="w-5 h-5" />} tone="cyan"
          progress={m.accuracyPct ?? undefined} progressTone="cyan"
          hint={m.accuracyPct !== null ? 'How close the forecast tracked actuals' : 'Awaiting actuals'}
        />
        <KpiCard
          label="Revenue Yet To Realize" value={formatCurrency(m.remainingForecast)}
          icon={<Coins className="w-5 h-5" />} tone="rose"
          hint={m.forecastRevenue > 0 ? `${((m.remainingForecast / m.forecastRevenue) * 100).toFixed(0)}% still pending` : '—'}
        />
        <KpiCard
          label="Expected Collection" value={formatMonthYear(m.expectedCollectionDate)}
          icon={<CalendarClock className="w-5 h-5" />} tone="slate"
          hint={m.hasActual ? 'Actual revenue date' : 'Expected close date'}
        />
      </div>

      {/* ── Forecast vs Actual + Revenue Progress ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Forecast vs Actual"
          subtitle="How realised revenue compares to the forecast"
          className="lg:col-span-2"
          actions={<StatusPill status={m.status} />}
        >
          <div className="space-y-5">
            <ComparisonRow
              label="Forecast Revenue" value={formatCurrency(m.forecastRevenue)}
              pct={m.forecastRevenue > 0 ? 100 : 0} barClass="bg-blue-500" valueClass="text-blue-600"
            />
            <ComparisonRow
              label="Actual Revenue" value={m.hasActual ? formatCurrency(m.actualRevenue) : 'Not recorded'}
              pct={m.realizationPct}
              barClass={m.status === 'Below Forecast' ? 'bg-amber-500' : 'bg-emerald-500'}
              valueClass="text-emerald-600"
              caption={m.hasActual ? `${m.realizationPct.toFixed(0)}% of forecast realised` : undefined}
            />
            <ComparisonRow
              label="Remaining Revenue" value={formatCurrency(m.remainingForecast)}
              pct={m.forecastRevenue > 0 ? (m.remainingForecast / m.forecastRevenue) * 100 : 0}
              barClass="bg-slate-300" valueClass="text-slate-600"
            />
            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
              <MiniMetric label="Variance" value={m.variance !== null ? formatSignedCurrency(m.variance) : '—'} tone={m.variance !== null && m.variance < 0 ? 'amber' : 'emerald'} />
              <MiniMetric label="Variance %" value={formatSignedPct(m.variancePct)} tone={m.variancePct !== null && m.variancePct < 0 ? 'amber' : 'emerald'} />
              <MiniMetric label="Progress" value={`${m.realizationPct.toFixed(0)}%`} tone="indigo" />
            </div>
          </div>
        </Card>

        <Card title="Revenue Progress" subtitle="Realised vs remaining forecast" bodyClassName="flex flex-col items-center justify-center">
          <RadialGaugeChart
            pct={m.realizationPct}
            color={m.status === 'Below Forecast' ? '#f59e0b' : '#10b981'}
            centerValue={`${m.realizationPct.toFixed(0)}%`}
            centerLabel="Realised"
            height={190}
          />
          <div className="mt-2 grid w-full grid-cols-2 gap-3">
            <MiniMetric label="Realised" value={formatCurrency(m.actualRevenue)} tone="emerald" />
            <MiniMetric label="Remaining" value={formatCurrency(m.remainingForecast)} tone="amber" />
          </div>
        </Card>
      </div>

      {/* ── Forecast Analytics ───────────────────────────────────────────────── */}
      <ForecastSectionHeading
        title="Forecast Analytics"
        subtitle={`Revenue distribution and realisation by ${granularityLabel(granularity).toLowerCase()}`}
        icon={<LineChartIcon className="w-4 h-4" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Forecast by ${granularityLabel(granularity)}`} subtitle="Expected revenue timeline vs realised">
          <ChartContainer height={280}>
            <BarChart data={chartRows} margin={CHART_MARGIN} barGap={6}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="period" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCurrencyShort} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value, name) => [formatCurrency(Number(value)), name]}
                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Bar dataKey="Forecast" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
              <Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ChartContainer>
        </Card>

        <Card title="Revenue Realization Trend" subtitle="Cumulative forecast vs realised revenue">
          <ChartContainer height={280}>
            <AreaChart data={trendData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="acArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCurrencyShort} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(value, name) => [formatCurrency(Number(value)), name]}
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Area type="monotone" dataKey="cumulativeForecast" name="Cumulative Forecast" stroke="#3b82f6" strokeWidth={2} fill="url(#fcArea)" />
              <Area type="monotone" dataKey="cumulativeActual" name="Cumulative Actual" stroke="#10b981" strokeWidth={2} fill="url(#acArea)" />
            </AreaChart>
          </ChartContainer>
        </Card>
      </div>

      {/* ── Business Insights ────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <>
          <ForecastSectionHeading title="Business Insights" subtitle="Automatically generated from this opportunity's forecast" icon={<Sparkles className="w-4 h-4" />} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
          </div>
        </>
      )}

      {/* ── Actual Revenue (editable) + Forecast Timeline ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Actual Revenue"
          subtitle="Realised revenue recorded against this opportunity"
          actions={
            !editing ? (
              <Button variant="secondary" icon={<Edit2 className="w-3.5 h-3.5" aria-hidden="true" />} onClick={() => setEditing(true)}>
                {m.hasActual ? 'Update' : 'Record'}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="secondary" icon={<X className="w-3.5 h-3.5" />} onClick={handleCancel} disabled={saving}>Cancel</Button>
                <Button variant="success" icon={<Check className="w-3.5 h-3.5" />} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )
          }
        >
          <FormGrid>
            <FormField label="Actual Revenue Date">
              <input type="date" className={inputCls} disabled={!editing} value={form.actualDate}
                onChange={(e) => setForm((f) => ({ ...f, actualDate: e.target.value }))} />
            </FormField>
            <FormField label="Actual Revenue Amount">
              <NumberInput className={inputCls} disabled={!editing} value={form.actualValue} min={0}
                onValueChange={(v) => setForm((f) => ({ ...f, actualValue: v }))} />
            </FormField>
            <FormField label="Remarks" wide>
              <textarea className={`${inputCls} resize-y min-h-[64px]`} disabled={!editing} rows={2} maxLength={2000}
                placeholder={editing ? 'Optional notes about the realised revenue…' : ''}
                value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </FormField>
          </FormGrid>
          {forecast?.updatedAt && (
            <p className="mt-3 text-[11px] text-slate-400">
              Last updated {new Date(forecast.updatedAt).toLocaleString('en-US')}
              {forecast.updatedByName ? ` by ${forecast.updatedByName}` : ''}
            </p>
          )}
        </Card>

        <Card title="Forecast Timeline" subtitle="When revenue is expected for this opportunity">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <IconStat icon={<CalendarClock className="w-4 h-4" />} label="Forecast Created" value={forecast?.updatedAt ? formatFullDate(forecast.updatedAt.slice(0, 10)) : '—'} />
            <IconStat icon={<Calendar className="w-4 h-4" />} label="Expected Close" value={formatMonthYear(opp.allocationEndDate)} />
            <IconStat icon={<TrendingUp className="w-4 h-4" />} label="Revenue Expected" value={<span className="font-mono">{formatCurrency(m.forecastRevenue)}</span>} />
            <IconStat icon={<Wallet className="w-4 h-4" />} label="Revenue Realized" value={<span className="font-mono">{m.hasActual ? formatCurrency(m.actualRevenue) : 'Pending'}</span>} />
            <IconStat icon={<Calendar className="w-4 h-4" />} label="Actual Revenue Date" value={<span className="font-mono">{m.hasActual && actualDate ? formatMonthYear(actualDate) : 'Pending'}</span>} />
            <IconStat icon={<Hourglass className="w-4 h-4" />} label="Remaining Revenue" value={<span className="font-mono">{formatCurrency(m.remainingForecast)}</span>} />
            <IconStat icon={<Target className="w-4 h-4" />} label="Current Forecast Status" value={<span className={STATUS_TONE[m.status].text}>{m.status}</span>} />
            <IconStat icon={<Gauge className="w-4 h-4" />} label="Realization" value={<span className="font-mono">{m.realizationPct.toFixed(0)}%</span>} />
          </div>
        </Card>
      </div>

      {/* ── Period breakdown table ───────────────────────────────────────────── */}
      <Card
        title={`Forecast Breakdown by ${granularityLabel(granularity)}`}
        subtitle="Forecast, actual and variance for each period"
        padding="none" clip
        actions={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400"><ListChecks className="w-3.5 h-3.5" />{tableRows.length} period{tableRows.length === 1 ? '' : 's'}</span>}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>{granularityLabel(granularity)}</TableHeadCell>
              <TableHeadCell align="right">Forecast</TableHeadCell>
              <TableHeadCell align="right">Actual</TableHeadCell>
              <TableHeadCell align="right">Variance</TableHeadCell>
              <TableHeadCell align="right">Variance %</TableHeadCell>
              <TableHeadCell align="right">Remaining</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
            </TableHead>
            <tbody>
              {tableRows.length === 0 ? (
                <TableRow><TableCell className="text-slate-400" colSpan={7}>No forecast in this period.</TableCell></TableRow>
              ) : tableRows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="font-mono" align="right">{formatCurrency(r.forecast)}</TableCell>
                  <TableCell className="font-mono" align="right">{r.hasActual ? formatCurrency(r.actual) : '—'}</TableCell>
                  <TableCell className="font-mono" align="right">{r.variance !== null ? formatSignedCurrency(r.variance) : '—'}</TableCell>
                  <TableCell className="font-mono" align="right">{formatSignedPct(r.variancePct)}</TableCell>
                  <TableCell className="font-mono" align="right">{formatCurrency(r.remaining)}</TableCell>
                  <TableCell><span className={STATUS_TONE[r.status].text}>{r.status}</span></TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

// ── Small metric block used inside cards ───────────────────────────────────────
const MINI_TONE: Record<string, string> = {
  emerald: 'text-emerald-600', amber: 'text-amber-600', indigo: 'text-indigo-600',
  blue: 'text-blue-600', slate: 'text-slate-700', rose: 'text-rose-600',
};

const MiniMetric: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'slate' }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-0.5 text-sm font-bold font-mono ${MINI_TONE[tone] ?? 'text-slate-700'}`}>{value}</p>
  </div>
);
