/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Opportunity, OpportunityStage } from '@/types';
import { exportCurrency, ReportSection } from '@/utils/exportReport';

export interface StageDatum {
  stage: OpportunityStage;
  val: string;
  pct: number;
}

export function toStageSection(stageData: StageDatum[]): ReportSection {
  return {
    title: 'Pipeline by Stage',
    headers: ['Stage', 'Pipeline Value', 'Share'],
    rows: stageData.map((item) => [item.stage, item.val, `${item.pct}%`]),
  };
}

export function toForecastVsTargetSection(
  totalForecastValue: number,
  targetValue: number,
  targetMetPct: number,
): ReportSection {
  return {
    title: 'Forecast vs Target',
    headers: ['Metric', 'Value'],
    rows: [
      ['Forecast Revenue (weighted)', exportCurrency(totalForecastValue)],
      ['Target Goal', exportCurrency(targetValue)],
      ['Target Met', `${targetMetPct}%`],
    ],
  };
}

export function toTopOppsSection(topOpps: Opportunity[]): ReportSection {
  return {
    title: 'Top Opportunities',
    headers: ['Opportunity', 'Value', 'Probability'],
    rows: topOpps.map((opp) => [opp.name, exportCurrency(opp.value), `${opp.probability}%`]),
  };
}

export interface AccountTypeDatum {
  type: string;
  val: number;
  pct: number;
}

export function toAccountTypeSection(typeBreakdown: AccountTypeDatum[]): ReportSection {
  return {
    title: 'Forecast Revenue by Account Type',
    headers: ['Account Type', 'Weighted Forecast', 'Share'],
    rows: typeBreakdown.map((item) => [item.type, exportCurrency(item.val), `${item.pct}%`]),
  };
}
