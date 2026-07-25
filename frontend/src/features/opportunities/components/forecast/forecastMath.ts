/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Forecast analytics — pure, presentation-agnostic logic shared by the
 * Opportunity Forecast and Portfolio Forecast dashboards.
 *
 * IMPORTANT: The canonical forecast figure is *derived*, never entered, and is
 * identical to the app-wide analytics formula (Deal Value × Probability, with a
 * Lost deal forecasting $0). Every metric below builds on {@link computeForecastRevenue}
 * so there is a single source of truth for the forecast number — no business
 * logic is duplicated or changed here; these are read-only analytics layered on
 * top of the existing calculation.
 */

import type { Opportunity } from '@/types';
import { deriveOppStatus } from '@/utils';
import { OPPORTUNITY_STAGE_STYLE } from '@/constants';
import type { CardTone } from '@/components/ui';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type Granularity = 'month' | 'quarter' | 'year';

export const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

export type ForecastStatus =
  | 'Pending' | 'On Track' | 'Ahead of Forecast' | 'Exceeded Forecast' | 'Below Forecast';

export const STATUS_TONE: Record<ForecastStatus, { tone: CardTone; text: string; dot: string }> = {
  'Pending':           { tone: 'slate',   text: 'text-slate-500',   dot: 'bg-slate-400' },
  'On Track':          { tone: 'indigo',  text: 'text-indigo-600',  dot: 'bg-indigo-500' },
  'Ahead of Forecast': { tone: 'blue',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  'Exceeded Forecast': { tone: 'emerald', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  'Below Forecast':    { tone: 'amber',   text: 'text-amber-600',   dot: 'bg-amber-500' },
};

// ── Formatters ───────────────────────────────────────────────────────────────

/** Exact currency (with $ and thousands separators). */
export const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '—';
  const sign = val < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(val)).toLocaleString('en-US')}`;
};

/** Signed currency (always shows +/−) for variance figures. */
export const formatSignedCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '—';
  const sign = val >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(Math.round(val)).toLocaleString('en-US')}`;
};

/** Compact currency for chart axes/labels (e.g. $1.2M, $450K). */
export const formatCurrencyShort = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

/** Whole-number percentage. */
export const formatPct = (val: number | null | undefined, digits = 0): string =>
  val === null || val === undefined ? '—' : `${val.toFixed(digits)}%`;

/** Signed percentage (always shows +/−). */
export const formatSignedPct = (val: number | null | undefined, digits = 1): string =>
  val === null || val === undefined ? '—' : `${val >= 0 ? '+' : ''}${val.toFixed(digits)}%`;

/** 'YYYY-MM-DD' → 'Jul 2027' (parsed without timezone drift). */
export const formatMonthYear = (d?: string | null): string => {
  if (!d) return '—';
  const [y, m] = d.split('-').map(Number);
  if (!y || !m) return d;
  return `${MONTHS[m - 1]} ${y}`;
};

/** 'YYYY-MM-DD' → 'Jul 12, 2027'. */
export const formatFullDate = (d?: string | null): string => {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return `${MONTHS[m - 1]} ${day}, ${y}`;
};

// ── Core forecast calculation (canonical — unchanged) ────────────────────────

/**
 * Forecast Revenue for a single opportunity — the probability-weighted expected
 * value, identical to the canonical analytics formula (value × probability). A
 * lost deal never realises, so it forecasts $0. This is DERIVED, never entered.
 */
export const computeForecastRevenue = (opp: Opportunity): number => {
  if (opp.stage === 'Lost') return 0;
  return (opp.value ?? 0) * (opp.probability ?? 0) / 100;
};

/** Realised revenue recorded against an opportunity (0 when none recorded). */
export const actualRevenueOf = (opp: Opportunity): number =>
  typeof opp.actualValue === 'number' ? opp.actualValue : 0;

export const hasActualOf = (opp: Opportunity): boolean =>
  typeof opp.actualValue === 'number';

/** Maps a forecast/actual pair to a business status. */
export const deriveStatus = (forecast: number, actual: number | null): ForecastStatus => {
  if (actual === null) return 'Pending';
  if (forecast <= 0) return actual > 0 ? 'Exceeded Forecast' : 'On Track';
  const pct = ((actual - forecast) / forecast) * 100;
  if (pct > 10) return 'Exceeded Forecast';
  if (pct > 2) return 'Ahead of Forecast';
  if (pct >= -2) return 'On Track';
  return 'Below Forecast';
};

// ── Single-opportunity metrics ───────────────────────────────────────────────

export interface OppForecastMetrics {
  forecastRevenue: number;
  hasActual: boolean;
  actualRevenue: number;
  /** actual − forecast (null until actuals recorded). */
  variance: number | null;
  variancePct: number | null;
  /** Forecast still to be realised (never negative). */
  remainingForecast: number;
  /** actual / forecast, capped at 100 for the progress bar. */
  realizationPct: number;
  /** 100 − |error|% (null until actuals recorded / when forecast is 0). */
  accuracyPct: number | null;
  status: ForecastStatus;
  /** When revenue is expected (actual date if realised, else expected close). */
  expectedCollectionDate: string | null;
}

export const deriveOppMetrics = (
  opp: Opportunity,
  actual: number | null,
  actualDate: string | null,
): OppForecastMetrics => {
  const forecastRevenue = computeForecastRevenue(opp);
  const hasActual = actual !== null;
  const actualRevenue = hasActual ? (actual as number) : 0;
  const variance = hasActual ? actualRevenue - forecastRevenue : null;
  const variancePct = variance !== null && forecastRevenue > 0
    ? (variance / forecastRevenue) * 100
    : null;
  const remainingForecast = Math.max(forecastRevenue - actualRevenue, 0);
  const realizationPct = forecastRevenue > 0
    ? Math.min((actualRevenue / forecastRevenue) * 100, 100)
    : (actualRevenue > 0 ? 100 : 0);
  const accuracyPct = hasActual && forecastRevenue > 0
    ? Math.max(0, 100 - (Math.abs(actualRevenue - forecastRevenue) / forecastRevenue) * 100)
    : null;
  const status = deriveStatus(forecastRevenue, hasActual ? actualRevenue : null);
  const expectedCollectionDate = (hasActual ? actualDate : null) ?? opp.allocationEndDate ?? null;

  return {
    forecastRevenue, hasActual, actualRevenue, variance, variancePct,
    remainingForecast, realizationPct, accuracyPct, status, expectedCollectionDate,
  };
};

// ── Period bucketing (drives the Month / Quarter / Year "Forecast View") ─────

export interface PeriodDatum {
  key: string;
  label: string;
  forecast: number;
  actual: number;
  /** True once at least one opportunity in this bucket has recorded actuals. */
  hasActual: boolean;
  count: number;
}

const monthKey = (d?: string | null) => (d ? d.slice(0, 7) : null); // "YYYY-MM"

const monthLabelFromKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
};

/**
 * Buckets a set of opportunities into periods by the selected granularity,
 * aligned on each deal's expected close (allocationEndDate). Forecast is the
 * derived weighted value; actual is realised revenue for deals closing in that
 * period — so per-row variance stays meaningful.
 */
export const bucketByPeriod = (opps: Opportunity[], granularity: Granularity): PeriodDatum[] => {
  const map = new Map<string, PeriodDatum>();
  const ensure = (key: string, label: string, sortKey: string) => {
    if (!map.has(key)) map.set(key, { key: sortKey, label, forecast: 0, actual: 0, hasActual: false, count: 0 });
    return map.get(key)!;
  };

  for (const opp of opps) {
    let key: string; let label: string; let sortKey: string;
    if (granularity === 'month') {
      const mk = monthKey(opp.allocationEndDate);
      if (!mk) continue;
      key = mk; label = monthLabelFromKey(mk); sortKey = mk;
    } else if (granularity === 'quarter') {
      const fy = opp.financialYear ?? '';
      const q = opp.quarter ?? '';
      if (!fy && !q) continue;
      key = `${fy}|${q}`;
      label = q && fy ? `${q} · FY${fy}` : (q || `FY${fy}`);
      sortKey = `${fy}|${q}`;
    } else {
      const fy = opp.financialYear ?? '';
      if (!fy) continue;
      key = fy; label = `FY${fy}`; sortKey = fy;
    }
    const bucket = ensure(key, label, sortKey);
    bucket.forecast += computeForecastRevenue(opp);
    if (hasActualOf(opp)) { bucket.actual += actualRevenueOf(opp); bucket.hasActual = true; }
    bucket.count += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
};

/**
 * A single opportunity has no natural multi-period series, so we scaffold one so
 * the distribution charts read as a real timeline: the deal's forecast/actual is
 * placed in its close period and every other period in the scaffold shows $0.
 */
export const scaffoldSingleOpp = (
  opp: Opportunity,
  actual: number | null,
  actualDate: string | null,
  granularity: Granularity,
  quarterLabels: string[],
): PeriodDatum[] => {
  const forecast = computeForecastRevenue(opp);
  const actualVal = actual ?? 0;
  const closeMonth = monthKey(opp.allocationEndDate);

  if (granularity === 'month') {
    const year = opp.allocationEndDate ? Number(opp.allocationEndDate.slice(0, 4)) : new Date().getFullYear();
    const actualMonth = monthKey(actualDate);
    return MONTHS.map((m, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const isClose = key === closeMonth;
      const isActual = key === actualMonth;
      return {
        key, label: `${m} ${year}`,
        forecast: isClose ? forecast : 0,
        actual: isActual ? actualVal : 0,
        hasActual: isActual && actual !== null,
        count: isClose ? 1 : 0,
      };
    });
  }

  if (granularity === 'quarter') {
    const labels = quarterLabels.length ? quarterLabels : ['Q1', 'Q2', 'Q3', 'Q4'];
    return labels.map((q) => {
      const isClose = q === opp.quarter;
      return {
        key: q, label: opp.financialYear ? `${q} · FY${opp.financialYear}` : q,
        forecast: isClose ? forecast : 0,
        actual: isClose ? actualVal : 0,
        hasActual: isClose && actual !== null,
        count: isClose ? 1 : 0,
      };
    });
  }

  const fy = opp.financialYear ?? (opp.allocationEndDate ? opp.allocationEndDate.slice(0, 4) : '');
  return [{
    key: fy, label: fy ? `FY${fy}` : '—',
    forecast, actual: actualVal, hasActual: actual !== null, count: 1,
  }];
};

/** Adds a running cumulative-actual field for realization-trend charts. */
export const withCumulative = (rows: PeriodDatum[]): (PeriodDatum & { cumulativeActual: number; cumulativeForecast: number })[] => {
  let ca = 0; let cf = 0;
  return rows.map((r) => { ca += r.actual; cf += r.forecast; return { ...r, cumulativeActual: ca, cumulativeForecast: cf }; });
};

// ── Portfolio aggregation ────────────────────────────────────────────────────

export interface CategoryDatum { label: string; forecast: number; actual: number; count: number; color: string; }
export interface AccountForecastDatum { accountId: string; label: string; forecast: number; actual: number; count: number; }
export interface OppForecastDatum { id: string; name: string; accountName: string; forecast: number; actual: number; stage: string; status: ForecastStatus; }

export interface PortfolioMetrics {
  totalForecast: number;
  totalActual: number;
  totalRemaining: number;
  realizationPct: number;
  /** Portfolio-weighted accuracy over deals that have recorded actuals. */
  accuracyPct: number | null;
  variance: number;
  variancePct: number | null;
  count: number;
  openCount: number;
  wonCount: number;
  lostCount: number;
  realizedCount: number;
  avgDealForecast: number;
  byMonth: PeriodDatum[];
  byQuarter: PeriodDatum[];
  byFy: PeriodDatum[];
  byStage: CategoryDatum[];
  byServiceLine: CategoryDatum[];
  byAccount: AccountForecastDatum[];
  topOpportunities: OppForecastDatum[];
  topAccounts: AccountForecastDatum[];
}

export const derivePortfolioMetrics = (opps: Opportunity[]): PortfolioMetrics => {
  let totalForecast = 0; let totalActual = 0;
  let openCount = 0; let wonCount = 0; let lostCount = 0; let realizedCount = 0;
  let absError = 0; let forecastOfRealized = 0;

  const stageMap = new Map<string, CategoryDatum>();
  const serviceMap = new Map<string, CategoryDatum>();
  const accountMap = new Map<string, AccountForecastDatum>();
  const oppRows: OppForecastDatum[] = [];

  for (const opp of opps) {
    const forecast = computeForecastRevenue(opp);
    const actual = actualRevenueOf(opp);
    const has = hasActualOf(opp);
    totalForecast += forecast;
    totalActual += actual;

    const outcome = deriveOppStatus(opp.stage);
    if (outcome === 'Won') wonCount++; else if (outcome === 'Lost') lostCount++; else openCount++;
    if (has) { realizedCount++; absError += Math.abs(actual - forecast); forecastOfRealized += forecast; }

    // By stage
    const st = stageMap.get(opp.stage) ?? {
      label: opp.stage, forecast: 0, actual: 0, count: 0,
      color: OPPORTUNITY_STAGE_STYLE[opp.stage]?.hex ?? '#94a3b8',
    };
    st.forecast += forecast; st.actual += actual; st.count += 1; stageMap.set(opp.stage, st);

    // By service line
    const sl = opp.serviceLine ?? 'Unspecified';
    const slDatum = serviceMap.get(sl) ?? { label: sl, forecast: 0, actual: 0, count: 0, color: '#3b82f6' };
    slDatum.forecast += forecast; slDatum.actual += actual; slDatum.count += 1; serviceMap.set(sl, slDatum);

    // By account
    const accLabel = opp.accountName ?? 'Unknown Account';
    const acc = accountMap.get(opp.accountId) ?? { accountId: opp.accountId, label: accLabel, forecast: 0, actual: 0, count: 0 };
    acc.forecast += forecast; acc.actual += actual; acc.count += 1; accountMap.set(opp.accountId, acc);

    oppRows.push({
      id: opp.id, name: opp.name, accountName: accLabel,
      forecast, actual, stage: opp.stage,
      status: deriveStatus(forecast, has ? actual : null),
    });
  }

  const count = opps.length;
  const totalRemaining = Math.max(totalForecast - totalActual, 0);
  const realizationPct = totalForecast > 0 ? Math.min((totalActual / totalForecast) * 100, 100)
    : (totalActual > 0 ? 100 : 0);
  const variance = totalActual - totalForecast;
  const variancePct = totalForecast > 0 ? (variance / totalForecast) * 100 : null;
  const accuracyPct = realizedCount > 0 && forecastOfRealized > 0
    ? Math.max(0, 100 - (absError / forecastOfRealized) * 100)
    : null;

  const byStage = Array.from(stageMap.values()).sort((a, b) => b.forecast - a.forecast);
  const byServiceLine = Array.from(serviceMap.values()).sort((a, b) => b.forecast - a.forecast);
  const byAccount = Array.from(accountMap.values()).sort((a, b) => b.forecast - a.forecast);

  return {
    totalForecast, totalActual, totalRemaining, realizationPct, accuracyPct,
    variance, variancePct, count, openCount, wonCount, lostCount, realizedCount,
    avgDealForecast: count > 0 ? totalForecast / count : 0,
    byMonth: bucketByPeriod(opps, 'month'),
    byQuarter: bucketByPeriod(opps, 'quarter'),
    byFy: bucketByPeriod(opps, 'year'),
    byStage, byServiceLine, byAccount,
    topOpportunities: [...oppRows].sort((a, b) => b.forecast - a.forecast).slice(0, 6),
    topAccounts: [...byAccount].sort((a, b) => b.actual - a.actual || b.forecast - a.forecast).slice(0, 6),
  };
};

// ── Business insights ────────────────────────────────────────────────────────

export type InsightTone = 'blue' | 'emerald' | 'amber' | 'indigo' | 'violet' | 'slate';
export type InsightKind =
  | 'realization' | 'pending' | 'variance' | 'timing' | 'concentration'
  | 'accuracy' | 'status' | 'ahead' | 'mix' | 'coverage';

export interface Insight {
  id: string;
  kind: InsightKind;
  tone: InsightTone;
  title: string;
  detail: string;
}

/** Generates business insights for a single opportunity. */
export const buildOppInsights = (
  opp: Opportunity,
  m: OppForecastMetrics,
  distribution: PeriodDatum[],
  granularity: Granularity,
): Insight[] => {
  const out: Insight[] = [];

  if (m.hasActual) {
    out.push({
      id: 'realization', kind: 'realization',
      tone: m.realizationPct >= 100 ? 'emerald' : m.realizationPct >= 50 ? 'blue' : 'amber',
      title: `Forecast realization is ${m.realizationPct.toFixed(0)}%`,
      detail: `${formatCurrency(m.actualRevenue)} realised of a ${formatCurrency(m.forecastRevenue)} forecast.`,
    });
    if (m.remainingForecast > 0) {
      const pendingPct = m.forecastRevenue > 0 ? (m.remainingForecast / m.forecastRevenue) * 100 : 0;
      out.push({
        id: 'pending', kind: 'pending', tone: 'amber',
        title: `${pendingPct.toFixed(0)}% of revenue is still pending`,
        detail: `${formatCurrency(m.remainingForecast)} of forecast revenue is yet to be realised.`,
      });
    }
    if (m.variance !== null) {
      const behind = m.variance < 0;
      out.push({
        id: 'variance', kind: 'variance', tone: behind ? 'amber' : 'emerald',
        title: behind
          ? `Actual revenue is behind forecast by ${formatCurrency(Math.abs(m.variance))}`
          : `Actual revenue is ahead of forecast by ${formatCurrency(m.variance)}`,
        detail: `Variance of ${formatSignedPct(m.variancePct)} against the forecast.`,
      });
    }
    if (m.accuracyPct !== null) {
      out.push({
        id: 'accuracy', kind: 'accuracy',
        tone: m.accuracyPct >= 90 ? 'emerald' : m.accuracyPct >= 70 ? 'blue' : 'amber',
        title: `Forecast accuracy is ${m.accuracyPct.toFixed(0)}%`,
        detail: m.accuracyPct >= 90 ? 'The forecast closely tracked realised revenue.'
          : 'There is a meaningful gap between forecast and realised revenue.',
      });
    }
  } else {
    out.push({
      id: 'status', kind: 'status', tone: 'indigo',
      title: 'Revenue is still to be realised',
      detail: `A forecast of ${formatCurrency(m.forecastRevenue)} is pending realisation. Record actuals as revenue lands.`,
    });
  }

  // Timing / concentration
  const populated = distribution.filter((d) => d.forecast > 0);
  if (populated.length) {
    const peak = populated.reduce((a, b) => (b.forecast > a.forecast ? b : a));
    const unit = granularity === 'month' ? 'month' : granularity === 'quarter' ? 'quarter' : 'financial year';
    out.push({
      id: 'timing', kind: 'timing', tone: 'blue',
      title: `Revenue is expected in ${peak.label}`,
      detail: `The largest forecast contribution falls in this ${unit}.`,
    });
  }

  return out;
};

/** Generates business insights for the portfolio. */
export const buildPortfolioInsights = (m: PortfolioMetrics, granularity: Granularity): Insight[] => {
  const out: Insight[] = [];
  if (m.count === 0) return out;

  out.push({
    id: 'realization', kind: 'realization',
    tone: m.realizationPct >= 75 ? 'emerald' : m.realizationPct >= 40 ? 'blue' : 'amber',
    title: `Portfolio realization is ${m.realizationPct.toFixed(0)}%`,
    detail: `${formatCurrency(m.totalActual)} realised across ${m.count} opportunit${m.count === 1 ? 'y' : 'ies'}.`,
  });

  if (m.totalRemaining > 0) {
    const pendingPct = m.totalForecast > 0 ? (m.totalRemaining / m.totalForecast) * 100 : 0;
    out.push({
      id: 'pending', kind: 'pending', tone: 'amber',
      title: `${pendingPct.toFixed(0)}% of revenue is still pending`,
      detail: `${formatCurrency(m.totalRemaining)} of forecast revenue is yet to be realised.`,
    });
  }

  if (m.accuracyPct !== null) {
    out.push({
      id: 'accuracy', kind: 'accuracy',
      tone: m.accuracyPct >= 85 ? 'emerald' : m.accuracyPct >= 65 ? 'blue' : 'amber',
      title: `Overall forecast accuracy is ${m.accuracyPct.toFixed(0)}%`,
      detail: `Measured across ${m.realizedCount} opportunit${m.realizedCount === 1 ? 'y' : 'ies'} with recorded actuals.`,
    });
  }

  // Peak period
  const series = granularity === 'month' ? m.byMonth : granularity === 'quarter' ? m.byQuarter : m.byFy;
  const populated = series.filter((d) => d.forecast > 0);
  if (populated.length) {
    const peak = populated.reduce((a, b) => (b.forecast > a.forecast ? b : a));
    const share = m.totalForecast > 0 ? (peak.forecast / m.totalForecast) * 100 : 0;
    out.push({
      id: 'concentration', kind: 'concentration', tone: 'blue',
      title: `Revenue is concentrated in ${peak.label}`,
      detail: `${formatCurrency(peak.forecast)} (${share.toFixed(0)}%) of forecast revenue is expected in this period.`,
    });
  }

  // Top account concentration
  if (m.byAccount.length) {
    const top = m.byAccount[0];
    const share = m.totalForecast > 0 ? (top.forecast / m.totalForecast) * 100 : 0;
    if (share >= 25) {
      out.push({
        id: 'coverage', kind: 'concentration', tone: 'indigo',
        title: `${top.label} drives ${share.toFixed(0)}% of the forecast`,
        detail: `Largest single-account contribution at ${formatCurrency(top.forecast)}.`,
      });
    }
  }

  // Top service line
  if (m.byServiceLine.length) {
    const top = m.byServiceLine[0];
    out.push({
      id: 'mix', kind: 'mix', tone: 'violet',
      title: `${top.label} leads the service-line mix`,
      detail: `${formatCurrency(top.forecast)} forecast across ${top.count} opportunit${top.count === 1 ? 'y' : 'ies'}.`,
    });
  }

  return out;
};
