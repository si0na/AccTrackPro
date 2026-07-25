/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Opportunity, OpportunityStage } from '@/types';
import { OPPORTUNITY_STAGE_OPTIONS } from '@/constants';
import { exportCurrency, ReportSection } from '@/utils/exportReport';

const UNSPECIFIED = 'Unspecified';

/** "Revenue" = realized/booked value — there is no separate booked-revenue
 *  field on Opportunity, so Won-stage `value` is the closest existing concept. */
const wonValue = (opps: Opportunity[]): number =>
  opps.filter((o) => o.stage === 'Won').reduce((sum, o) => sum + o.value, 0);

const forecastValue = (opps: Opportunity[]): number =>
  opps.reduce((sum, o) => sum + o.value * (o.probability / 100), 0);

const pipelineValue = (opps: Opportunity[]): number =>
  opps.reduce((sum, o) => sum + o.value, 0);

// ---------------------------------------------------------------------------
// Location-wise Revenue Report
// ---------------------------------------------------------------------------

export interface LocationRevenueRow {
  location: string;
  totalOpportunities: number;
  wonOpportunities: number;
  pipelineValue: number;
  revenue: number;
  forecastRevenue: number;
}

export function buildLocationRevenueRows(opps: Opportunity[]): LocationRevenueRow[] {
  const byLocation = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const key = (o.location ?? '').trim() || UNSPECIFIED;
    const bucket = byLocation.get(key);
    if (bucket) bucket.push(o);
    else byLocation.set(key, [o]);
  }
  return Array.from(byLocation.entries())
    .map(([location, group]) => ({
      location,
      totalOpportunities: group.length,
      wonOpportunities: group.filter((o) => o.stage === 'Won').length,
      pipelineValue: pipelineValue(group),
      revenue: wonValue(group),
      forecastRevenue: forecastValue(group),
    }))
    .sort((a, b) => b.pipelineValue - a.pipelineValue);
}

export function toLocationRevenueSection(rows: LocationRevenueRow[]): ReportSection {
  return {
    title: 'Location-wise Revenue',
    headers: ['Location', 'Total Opportunities', 'Won Opportunities', 'Pipeline Value', 'Revenue', 'Forecast Revenue'],
    rows: rows.map((r) => [
      r.location,
      r.totalOpportunities,
      r.wonOpportunities,
      exportCurrency(r.pipelineValue),
      exportCurrency(r.revenue),
      exportCurrency(r.forecastRevenue),
    ]),
  };
}

// ---------------------------------------------------------------------------
// Service-wise Revenue Report
// ---------------------------------------------------------------------------

export interface ServiceRevenueRow {
  serviceLine: string;
  opportunityCount: number;
  pipelineValue: number;
  revenue: number;
  averageDealSize: number;
}

export function buildServiceRevenueRows(opps: Opportunity[]): ServiceRevenueRow[] {
  const byService = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const key = (o.serviceLine ?? '').trim() || UNSPECIFIED;
    const bucket = byService.get(key);
    if (bucket) bucket.push(o);
    else byService.set(key, [o]);
  }
  return Array.from(byService.entries())
    .map(([serviceLine, group]) => {
      const pv = pipelineValue(group);
      return {
        serviceLine,
        opportunityCount: group.length,
        pipelineValue: pv,
        revenue: wonValue(group),
        averageDealSize: group.length > 0 ? pv / group.length : 0,
      };
    })
    .sort((a, b) => b.pipelineValue - a.pipelineValue);
}

export function toServiceRevenueSection(rows: ServiceRevenueRow[]): ReportSection {
  return {
    title: 'Service-wise Revenue',
    headers: ['Service', 'Opportunity Count', 'Pipeline Value', 'Revenue', 'Average Deal Size'],
    rows: rows.map((r) => [
      r.serviceLine,
      r.opportunityCount,
      exportCurrency(r.pipelineValue),
      exportCurrency(r.revenue),
      exportCurrency(r.averageDealSize),
    ]),
  };
}

// ---------------------------------------------------------------------------
// Stage-wise Revenue Report
// ---------------------------------------------------------------------------

export interface StageRevenueRow {
  stage: OpportunityStage;
  opportunityCount: number;
  pipelineValue: number;
  /** Nonzero only for the Won stage by definition — spec-accurate, not a bug. */
  revenue: number;
  averageProbability: number;
  forecastRevenue: number;
}

/** Iterates every canonical stage (including Blocked/Delayed) so an
 *  opportunity sitting in any stage is never silently absent from this report. */
export function buildStageRevenueRows(opps: Opportunity[]): StageRevenueRow[] {
  return OPPORTUNITY_STAGE_OPTIONS.map((stage) => {
    const group = opps.filter((o) => o.stage === stage);
    return {
      stage,
      opportunityCount: group.length,
      pipelineValue: pipelineValue(group),
      revenue: wonValue(group),
      averageProbability:
        group.length > 0 ? group.reduce((sum, o) => sum + o.probability, 0) / group.length : 0,
      forecastRevenue: forecastValue(group),
    };
  });
}

export function toStageRevenueSection(rows: StageRevenueRow[]): ReportSection {
  return {
    title: 'Stage-wise Revenue',
    headers: ['Stage', 'Opportunity Count', 'Pipeline Value', 'Revenue', 'Average Probability', 'Forecast Revenue'],
    rows: rows.map((r) => [
      r.stage,
      r.opportunityCount,
      exportCurrency(r.pipelineValue),
      exportCurrency(r.revenue),
      `${Math.round(r.averageProbability)}%`,
      exportCurrency(r.forecastRevenue),
    ]),
  };
}
