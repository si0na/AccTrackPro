/**
 * Pure fiscal-calendar math shared by FilterContextService and
 * FinancialYearsService. Financial Year and Quarter are never stored on
 * business entities — they are always derived from dates using these helpers
 * and the configured Financial Calendar.
 */

/** Quarter definition as stored in the financial calendar (months, 1-12). */
export interface FYQuarterDef {
  label: string;
  startMonth: number;
  endMonth: number;
}

/** A quarter resolved to concrete calendar dates (YYYY-MM-DD, inclusive). */
export interface QuarterRange {
  label: string;
  startDate: string;
  endDate: string;
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

/**
 * FY label for a start year: "YYYY" when the FY matches the calendar year
 * (startMonth=1), otherwise the two-year form "YYYY-YY".
 */
export function fyLabelFor(startYear: number, startMonth: number): string {
  return startMonth === 1
    ? `${startYear}`
    : `${startYear}-${String(startYear + 1).slice(2)}`;
}

/** Inclusive date range of a financial year starting at startYear/startMonth. */
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

/**
 * Resolve quarter definitions into concrete date ranges for one financial year.
 * Each quarter's calendar year is determined by whether its months fall before
 * or after the FY start month.
 */
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

/**
 * Compute financial year label and quarter for a date and FY start month.
 *
 * startMonth: 1=Jan … 12=Dec. Default 4 = April.
 * Quarter labels Q1–Q4 are equal 3-month windows starting at startMonth.
 * Returns empty labels for missing/invalid dates — a record without a valid
 * business date belongs to no fiscal period.
 */
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
