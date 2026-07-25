/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Target, ArrowRight } from 'lucide-react';
import { Card, Table, TableHead, TableHeadCell, TableCell, TableRow, EmptyState } from '@/components/ui';
import { OPPORTUNITY_STAGE_STYLE } from '@/constants';
import type { Opportunity } from '@/types';

export interface TopOpportunitiesCardProps {
  topOpps: Opportunity[];
  formatCurrency: (n: number) => string;
  /** Navigates to the full Opportunities list; renders the footer link when provided. */
  onViewAll?: () => void;
}

const RANK_CLS = [
  'bg-amber-100 text-amber-700',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-700',
];

const probabilityTone = (pct: number) =>
  pct >= 70 ? 'text-emerald-600 bg-emerald-50' : pct >= 40 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100';

const formatShortDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const TopOpportunitiesCard: React.FC<TopOpportunitiesCardProps> = ({ topOpps, formatCurrency, onViewAll }) => (
  <Card
    title="Top Opportunities"
    subtitle="Highest-value open deals for the current filters"
    actions={<span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-600">PRIORITY PIPELINE</span>}
    className="lg:col-span-3"
    padding="none"
    clip
    footer={
      onViewAll && topOpps.length > 0 ? (
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          View all opportunities
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : undefined
    }
  >
    {topOpps.length === 0 ? (
      <EmptyState
        icon={<Target className="h-6 w-6 text-slate-400" aria-hidden="true" />}
        title="No active opportunities for this selection"
        hint="Adjust the report filters above to see top opportunities."
        className="p-6"
      />
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableHeadCell className="w-10">#</TableHeadCell>
            <TableHeadCell>Opportunity Name</TableHeadCell>
            <TableHeadCell>Account</TableHeadCell>
            <TableHeadCell align="center">Stage</TableHeadCell>
            <TableHeadCell align="right">Value</TableHeadCell>
            <TableHeadCell align="center">Prob.</TableHeadCell>
            <TableHeadCell align="right">Close Date</TableHeadCell>
          </TableHead>
          <tbody>
            {topOpps.map((opp, i) => {
              const stageStyle = OPPORTUNITY_STAGE_STYLE[opp.stage];
              return (
                <TableRow key={opp.id}>
                  <TableCell>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${RANK_CLS[i] ?? 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-700">{opp.name}</TableCell>
                  <TableCell className="text-slate-500">{opp.accountName ?? '—'}</TableCell>
                  <TableCell align="center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageStyle.iconBg} ${stageStyle.iconText}`}>
                      {opp.stage}
                    </span>
                  </TableCell>
                  <TableCell align="right" className="font-mono font-bold text-slate-900">{formatCurrency(opp.value)}</TableCell>
                  <TableCell align="center">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${probabilityTone(opp.probability)}`}>
                      {opp.probability}%
                    </span>
                  </TableCell>
                  <TableCell align="right" className="font-mono text-slate-500 whitespace-nowrap">{formatShortDate(opp.allocationEndDate)}</TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      </div>
    )}
  </Card>
);
