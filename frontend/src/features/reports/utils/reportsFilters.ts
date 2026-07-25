/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Account, Opportunity } from '@/types';
import { deriveOppStatus } from '@/utils';

/**
 * Reports-page-local filter fields, layered on top of the existing global
 * Financial Year / Quarter / Account scoping. All fields default to 'All'
 * (no-op). "Customer" from the product spec maps onto the existing global
 * Account selector (no separate field here); "Date Range" maps onto the
 * existing FY/Quarter selector — the app's date-filtering paradigm is FY+
 * Quarter, not raw calendar ranges, so no additional date picker is added.
 *
 * Practice Lead / Project Manager / Service Provider PM are intentionally
 * omitted: those fields exist only on the `Project` entity (created once an
 * opportunity goes Won), and this page's reports are opportunity/pipeline
 * based, not project based.
 */
export interface ReportsFilterState {
  stage: string;
  health: string;
  oppType: string;
  revenueModel: string;
  serviceLine: string;
  industry: string;
  location: string;
  status: string;
}

export const REPORTS_FILTERS_DEFAULT: ReportsFilterState = {
  stage: 'All',
  health: 'All',
  oppType: 'All',
  revenueModel: 'All',
  serviceLine: 'All',
  industry: 'All',
  location: 'All',
  status: 'All',
};

/**
 * True when `o` (with its parent `account`, needed for the Industry filter)
 * satisfies every active filter field. Fields left at 'All' always match, so
 * with every field at its default this reduces to "true" for every
 * opportunity — the basis for existing-report figures staying unchanged.
 */
export function matchesReportsFilters(
  o: Opportunity,
  account: Account | undefined,
  filters: ReportsFilterState,
): boolean {
  if (filters.stage !== 'All' && o.stage !== filters.stage) return false;
  if (filters.health !== 'All' && o.opportunityHealth !== filters.health) return false;
  if (filters.oppType !== 'All' && o.opportunityType !== filters.oppType) return false;
  if (filters.revenueModel !== 'All' && o.revenueModel !== filters.revenueModel) return false;
  if (filters.serviceLine !== 'All' && o.serviceLine !== filters.serviceLine) return false;
  if (filters.industry !== 'All' && (account?.industry ?? '').trim() !== filters.industry) return false;
  if (filters.location !== 'All' && (o.location ?? '').trim() !== filters.location) return false;
  if (filters.status !== 'All' && deriveOppStatus(o.stage) !== filters.status) return false;
  return true;
}
