/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FinancialCalendar, FinancialYear, FYQuarterDef, Opportunity } from '@/types';

export interface QuarterRange {
  label: string;
  startDate: string;
  endDate: string;
}

export interface OverlappingPeriodsResult {
  financialYears: string[];
  quarters: string[];
  periods: Array<{
    financialYear: string;
    quarter: string;
  }>;
}

export const DEFAULT_START_MONTH = 4;

export const DEFAULT_QUARTERS: FYQuarterDef[] = [
  { label: 'Q1', startMonth: 4,  endMonth: 6  },
  { label: 'Q2', startMonth: 7,  endMonth: 9  },
  { label: 'Q3', startMonth: 10, endMonth: 12 },
  { label: 'Q4', startMonth: 1,  endMonth: 3  },
];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getLastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function fyLabelFor(startYear: number, startMonth: number): string {
  return startMonth === 1
    ? `${startYear}`
    : `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function fyDateRange(
  startYear: number,
  startMonth: number,
): { startDate: string; endDate: string } {
  const endYear  = startMonth === 1 ? startYear : startYear + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  return {
    startDate: `${startYear}-${pad2(startMonth)}-01`,
    endDate:   `${endYear}-${pad2(endMonth)}-${pad2(getLastDay(endYear, endMonth))}`,
  };
}

export function buildQuarterRanges(
  startYear: number,
  startMonth: number,
  quarters: FYQuarterDef[],
): QuarterRange[] {
  return quarters.map((q) => {
    const qStartYear = q.startMonth >= startMonth ? startYear : startYear + 1;
    const qEndYear   = q.endMonth   >= startMonth ? startYear : startYear + 1;
    return {
      label:     q.label,
      startDate: `${qStartYear}-${pad2(q.startMonth)}-01`,
      endDate:   `${qEndYear}-${pad2(q.endMonth)}-${pad2(getLastDay(qEndYear, q.endMonth))}`,
    };
  });
}

export function computeFY(
  dateStr: string | null | undefined,
  startMonth = DEFAULT_START_MONTH,
): { financialYear: string; quarter: string } {
  const trimmed = (dateStr ?? '').trim();
  if (!trimmed) return { financialYear: '', quarter: '' };

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return { financialYear: '', quarter: '' };

  const month   = d.getMonth() + 1; // 1-12
  const year    = d.getFullYear();
  const fyStart = month >= startMonth ? year : year - 1;

  const monthsSinceStart = (month - startMonth + 12) % 12;
  return {
    financialYear: fyLabelFor(fyStart, startMonth),
    quarter:       `Q${Math.floor(monthsSinceStart / 3) + 1}`,
  };
}

export function isValidDateStr(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(s.trim());
}

/**
 * Pure range-overlap check according to the canonical business rule:
 * - When both dates exist: Start <= PeriodEnd AND End >= PeriodStart
 * - When Start exists, End missing: Start <= PeriodEnd (open-ended forward)
 * - When End exists, Start missing: End >= PeriodStart (open-ended backward)
 * - When neither date exists: false (belongs to no specific date period)
 */
export function isRangeOverlapping(
  rangeA: { startDate?: string | null; endDate?: string | null },
  rangeB: { startDate: string; endDate: string },
): boolean {
  const hasStart = isValidDateStr(rangeA.startDate);
  const hasEnd   = isValidDateStr(rangeA.endDate);

  if (!hasStart && !hasEnd) return false;

  const sA = hasStart ? rangeA.startDate!.trim().slice(0, 10) : null;
  const eA = hasEnd   ? rangeA.endDate!.trim().slice(0, 10)   : null;
  const sB = rangeB.startDate.trim().slice(0, 10);
  const eB = rangeB.endDate.trim().slice(0, 10);

  if (sA && eA) {
    return sA <= eB && eA >= sB;
  }
  if (sA && !eA) {
    return sA <= eB;
  }
  if (!sA && eA) {
    return eA >= sB;
  }
  return false;
}

/**
 * Resolves a selected FY and optional Quarter into an inclusive YYYY-MM-DD date range.
 */
export function resolvePeriodDateRange(
  financialYears: FinancialYear[],
  financialCalendar: FinancialCalendar | null | undefined,
  fyLabel?: string | null,
  quarterLabel?: string | null,
): { start: string; end: string } | null {
  if (!fyLabel || fyLabel === 'All') return null;

  const qLabel = quarterLabel && quarterLabel !== 'All' ? quarterLabel : null;
  const fy = financialYears.find((f) => f.fyLabel === fyLabel);

  if (fy) {
    const startMonth = fy.calendarStartMonth ?? financialCalendar?.startMonth ?? DEFAULT_START_MONTH;
    const quarterDefs = fy.calendarQuarters ?? financialCalendar?.quarters ?? DEFAULT_QUARTERS;

    if (qLabel) {
      const quarters = buildQuarterRanges(fy.startYear, startMonth, quarterDefs);
      const q = quarters.find((qItem) => qItem.label === qLabel);
      return q ? { start: q.startDate, end: q.endDate } : null;
    }
    return { start: fy.startDate, end: fy.endDate };
  }

  const startYear = parseInt(fyLabel, 10);
  if (isNaN(startYear)) return null;

  const startMonth = financialCalendar?.startMonth ?? DEFAULT_START_MONTH;
  const quarterDefs = financialCalendar?.quarters ?? DEFAULT_QUARTERS;

  if (qLabel) {
    const quarters = buildQuarterRanges(startYear, startMonth, quarterDefs);
    const q = quarters.find((qItem) => qItem.label === qLabel);
    return q ? { start: q.startDate, end: q.endDate } : null;
  }

  const { startDate, endDate } = fyDateRange(startYear, startMonth);
  return { start: startDate, end: endDate };
}

/**
 * Derives Financial Year and Quarter for an opportunity based ONLY on Expected Project End Date (allocationEndDate).
 */
export function getOpportunityPeriods(
  opportunity: Partial<Pick<Opportunity, 'allocationEndDate'>>,
  financialYears: FinancialYear[],
  financialCalendar?: FinancialCalendar | null,
): OverlappingPeriodsResult {
  const endDate = opportunity?.allocationEndDate;
  if (!isValidDateStr(endDate)) {
    return { financialYears: [], quarters: [], periods: [] };
  }

  const cleanEnd = endDate!.trim().slice(0, 10);
  const startMonth = financialCalendar?.startMonth ?? DEFAULT_START_MONTH;
  const defaultQuarterDefs = financialCalendar?.quarters ?? DEFAULT_QUARTERS;

  let years = financialYears;
  if (!years.length) {
    const currentYear = new Date().getFullYear();
    years = [-2, -1, 0, 1, 2, 3].map((offset) => {
      const y = currentYear + offset;
      const { startDate: s, endDate: e } = fyDateRange(y, startMonth);
      const qRanges = buildQuarterRanges(y, startMonth, defaultQuarterDefs);
      return {
        id: `synth-${y}`,
        fyLabel: fyLabelFor(y, startMonth),
        startYear: y,
        startDate: s,
        endDate: e,
        isActive: true,
        calendarStartMonth: startMonth,
        calendarQuarters: defaultQuarterDefs,
        quarters: qRanges.map((qr) => ({
          label: qr.label,
          startDate: qr.startDate,
          endDate: qr.endDate,
        })),
      };
    });
  }

  for (const fy of years) {
    if (cleanEnd >= fy.startDate && cleanEnd <= fy.endDate) {
      const fyStartMonth = fy.calendarStartMonth ?? startMonth;
      const fyQuarters = fy.calendarQuarters ?? defaultQuarterDefs;
      const qRanges = buildQuarterRanges(fy.startYear, fyStartMonth, fyQuarters);
      const matchingQ = qRanges.find((q) => cleanEnd >= q.startDate && cleanEnd <= q.endDate);
      const qLabel = matchingQ ? matchingQ.label : '';

      return {
        financialYears: [fy.fyLabel],
        quarters: qLabel ? [qLabel] : [],
        periods: qLabel ? [{ financialYear: fy.fyLabel, quarter: qLabel }] : [],
      };
    }
  }

  const computed = computeFY(cleanEnd, startMonth);
  if (computed.financialYear) {
    return {
      financialYears: [computed.financialYear],
      quarters: computed.quarter ? [computed.quarter] : [],
      periods: computed.quarter ? [{ financialYear: computed.financialYear, quarter: computed.quarter }] : [],
    };
  }

  return { financialYears: [], quarters: [], periods: [] };
}

/**
 * Canonical test for whether an Opportunity belongs to a selected FY + Quarter.
 * Based ONLY on Expected Project End Date (allocationEndDate).
 */
export function isOpportunityInPeriod(
  opportunity: Partial<Pick<Opportunity, 'allocationEndDate' | 'applicablePeriods'>>,
  selectedYear: string | undefined | null,
  selectedQuarter: string | undefined | null,
  financialYears: FinancialYear[],
  financialCalendar?: FinancialCalendar | null,
): boolean {
  const isAllYears = !selectedYear || selectedYear === 'All';
  const isAllQuarters = !selectedQuarter || selectedQuarter === 'All';

  // Case: All Years and All Quarters -> match everything (even deals without dates)
  if (isAllYears && isAllQuarters) {
    return true;
  }

  // Expected Project End Date is authoritative. If missing, exclude from specific period filters.
  const endDate = opportunity?.allocationEndDate;
  if (!isValidDateStr(endDate)) {
    return false;
  }

  const cleanEnd = endDate!.trim().slice(0, 10);

  // Case: specific FY selected
  if (!isAllYears) {
    const range = resolvePeriodDateRange(financialYears, financialCalendar, selectedYear, selectedQuarter);
    if (!range) return false;
    return cleanEnd >= range.start && cleanEnd <= range.end;
  }

  // Case: "All" FY but a specific Quarter selected (e.g. "Q1" across all years)
  const derived = getOpportunityPeriods(opportunity, financialYears, financialCalendar);
  return derived.quarters.includes(selectedQuarter!);
}
