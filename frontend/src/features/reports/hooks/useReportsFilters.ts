/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import type { Account, Opportunity } from '@/types';
import { REPORTS_FILTERS_DEFAULT, ReportsFilterState } from '../utils/reportsFilters';

/**
 * Local (non-persisted) filter state for the Reports page's new filter panel.
 * Kept as a plain hook rather than a Context — the orchestrator passes the
 * result one level deep to direct child report components, the same shape as
 * the page's existing `filteredOpps`/`filteredAccounts` props.
 */
export function useReportsFilters(opportunities: Opportunity[], accounts: Account[]) {
  const [filters, setFilters] = useState<ReportsFilterState>(REPORTS_FILTERS_DEFAULT);

  const setFilter = (key: keyof ReportsFilterState, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const resetFilters = () => setFilters(REPORTS_FILTERS_DEFAULT);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== 'All').length,
    [filters],
  );

  // Derived from the full dataset (not the already-narrowed set) so these
  // option lists don't shrink as the user applies other filters.
  const industryOptions = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.industry?.trim()).filter(Boolean))).sort() as string[],
    [accounts],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.location?.trim()).filter(Boolean))).sort() as string[],
    [opportunities],
  );

  return { filters, setFilter, resetFilters, activeFilterCount, industryOptions, locationOptions };
}
