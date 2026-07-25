/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Presentational atoms shared by the Opportunity and Portfolio forecast
 * dashboards — rich KPI tiles, business-insight cards, comparison rows and
 * status pills. These are pure display components; all figures are computed in
 * {@link ./forecastMath}.
 */

import React from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CalendarClock, Crosshair,
  Gauge, Hourglass, Info, Layers, Minus, Scale, Target, TrendingUp,
} from 'lucide-react';
import type { Insight, InsightKind, InsightTone, ForecastStatus } from './forecastMath';
import { STATUS_TONE } from './forecastMath';

// ── KPI tile ─────────────────────────────────────────────────────────────────

export type KpiTone = 'blue' | 'emerald' | 'violet' | 'amber' | 'indigo' | 'slate' | 'rose' | 'cyan';

const KPI_CHIP: Record<KpiTone, string> = {
  blue:    'bg-blue-50 text-blue-600 ring-blue-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  violet:  'bg-violet-50 text-violet-600 ring-violet-100',
  amber:   'bg-amber-50 text-amber-600 ring-amber-100',
  indigo:  'bg-indigo-50 text-indigo-600 ring-indigo-100',
  slate:   'bg-slate-100 text-slate-600 ring-slate-200',
  rose:    'bg-rose-50 text-rose-600 ring-rose-100',
  cyan:    'bg-cyan-50 text-cyan-600 ring-cyan-100',
};

export type Trend = 'up' | 'down' | 'flat';

const TREND_META: Record<Trend, { icon: React.ReactNode; cls: string }> = {
  up:   { icon: <ArrowUpRight className="w-3.5 h-3.5" />, cls: 'text-emerald-600 bg-emerald-50' },
  down: { icon: <ArrowDownRight className="w-3.5 h-3.5" />, cls: 'text-amber-600 bg-amber-50' },
  flat: { icon: <Minus className="w-3.5 h-3.5" />, cls: 'text-slate-500 bg-slate-100' },
};

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: KpiTone;
  /** Small caption under the value. */
  hint?: React.ReactNode;
  /** Optional trend chip (top-right). */
  trend?: Trend;
  trendLabel?: string;
  /** Optional 0–100 progress bar at the foot of the card. */
  progress?: number;
  progressTone?: KpiTone;
}

const BAR_FILL: Record<KpiTone, string> = {
  blue: 'bg-blue-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500', amber: 'bg-amber-500',
  indigo: 'bg-indigo-500', slate: 'bg-slate-400', rose: 'bg-rose-500', cyan: 'bg-cyan-500',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, icon, tone = 'blue', hint, trend, trendLabel, progress, progressTone,
}) => (
  <div className="relative flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex items-start justify-between gap-2">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${KPI_CHIP[tone]}`}>
        {icon}
      </span>
      {trend && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TREND_META[trend].cls}`}>
          {TREND_META[trend].icon}
          {trendLabel}
        </span>
      )}
    </div>
    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-0.5 text-2xl font-bold text-slate-900 leading-tight tracking-tight tabular-nums">{value}</p>
    {hint && <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p>}
    {progress !== undefined && (
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${BAR_FILL[progressTone ?? tone]}`}
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
    )}
  </div>
);

// ── Status pill ──────────────────────────────────────────────────────────────

export const StatusPill: React.FC<{ status: ForecastStatus; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const tone = STATUS_TONE[status];
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-50 ring-1 ring-slate-200 font-semibold ${pad} ${tone.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {status}
    </span>
  );
};

// ── Comparison row (labelled progress bar) ───────────────────────────────────

export interface ComparisonRowProps {
  label: string;
  value: string;
  /** 0–100 fill width. */
  pct: number;
  barClass?: string;
  valueClass?: string;
  caption?: string;
}

export const ComparisonRow: React.FC<ComparisonRowProps> = ({
  label, value, pct, barClass = 'bg-blue-500', valueClass = 'text-slate-700', caption,
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className={`text-sm font-mono font-semibold ${valueClass}`}>{value}</span>
    </div>
    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
    {caption && <p className="mt-1.5 text-[11px] font-medium text-slate-400">{caption}</p>}
  </div>
);

// ── Business insight card ────────────────────────────────────────────────────

const INSIGHT_ICON: Record<InsightKind, React.ReactNode> = {
  realization:   <Gauge className="w-4 h-4" />,
  pending:       <Hourglass className="w-4 h-4" />,
  variance:      <Scale className="w-4 h-4" />,
  timing:        <CalendarClock className="w-4 h-4" />,
  concentration: <Target className="w-4 h-4" />,
  accuracy:      <Crosshair className="w-4 h-4" />,
  status:        <Info className="w-4 h-4" />,
  ahead:         <TrendingUp className="w-4 h-4" />,
  mix:           <Layers className="w-4 h-4" />,
  coverage:      <Building2 className="w-4 h-4" />,
};

const INSIGHT_TONE_CLS: Record<InsightTone, { card: string; chip: string; title: string }> = {
  blue:    { card: 'border-blue-100 bg-blue-50/40',       chip: 'bg-blue-100 text-blue-600',       title: 'text-blue-900' },
  emerald: { card: 'border-emerald-100 bg-emerald-50/40', chip: 'bg-emerald-100 text-emerald-600', title: 'text-emerald-900' },
  amber:   { card: 'border-amber-100 bg-amber-50/50',     chip: 'bg-amber-100 text-amber-600',     title: 'text-amber-900' },
  indigo:  { card: 'border-indigo-100 bg-indigo-50/40',   chip: 'bg-indigo-100 text-indigo-600',   title: 'text-indigo-900' },
  violet:  { card: 'border-violet-100 bg-violet-50/40',   chip: 'bg-violet-100 text-violet-600',   title: 'text-violet-900' },
  slate:   { card: 'border-slate-200 bg-slate-50',        chip: 'bg-slate-200 text-slate-600',     title: 'text-slate-800' },
};

export const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const t = INSIGHT_TONE_CLS[insight.tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${t.card}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
        {INSIGHT_ICON[insight.kind]}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold leading-snug ${t.title}`}>{insight.title}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500 leading-relaxed">{insight.detail}</p>
      </div>
    </div>
  );
};

// ── Section heading (mirrors the Reports page section headings) ───────────────

export const ForecastSectionHeading: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode }> = ({
  title, subtitle, icon,
}) => (
  <div className="flex items-center gap-2.5">
    {icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>}
    <div>
      <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs font-medium text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

// ── Small labelled stat (timeline / summary blocks) ──────────────────────────

export const IconStat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({
  icon, label, value,
}) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  </div>
);

export { ArrowRight };
