/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, EmptyState, Table, TableHead, TableHeadCell, TableCell, TableRow } from '@/components/ui';
import type { OpportunityStage } from '@/types';

export interface StageDatum {
  stage: OpportunityStage;
  val: string;
  value: number;
  pct: number;
  /** Number of opportunities currently sitting in this stage. */
  count: number;
  color: string;
}

export interface PipelineByStageCardProps {
  /** Stages with a nonzero pipeline value, in stage-flow order — zero-value
   *  stages are already filtered out by the caller so the table never shows
   *  empty rows. */
  stageData: StageDatum[];
  totalPipelineValue: number;
  /** Won ÷ all opportunities, as a whole-number percent — a display-only ratio
   *  derived from the already-filtered rows; no new business logic. */
  conversionRate: number;
  formatCurrency: (n: number) => string;
}

export const PipelineByStageCard: React.FC<PipelineByStageCardProps> = ({
  stageData,
  totalPipelineValue,
  conversionRate,
  formatCurrency,
}) => (
  <Card
    title="Pipeline by Stage"
    subtitle="Open pipeline value grouped by stage"
    actions={
      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
        TOTAL: {formatCurrency(totalPipelineValue)}
      </span>
    }
    className="lg:col-span-5"
    padding="none"
    clip
  >
    {stageData.length === 0 ? (
      <EmptyState
        icon={<TrendingUp className="h-6 w-6 text-slate-400" aria-hidden="true" />}
        title="No pipeline value for the current filters"
        hint="Adjust the report filters above to see pipeline by stage."
        className="p-6"
      />
    ) : (
      <>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Stage</TableHeadCell>
              <TableHeadCell align="right">Pipeline Value</TableHeadCell>
              <TableHeadCell align="right">% of Pipeline</TableHeadCell>
              <TableHeadCell align="right"># Opps</TableHeadCell>
              <TableHeadCell className="w-[30%] min-w-[8rem]">Progress</TableHeadCell>
            </TableHead>
            <tbody>
              {stageData.map((s) => (
                <TableRow key={s.stage}>
                  <TableCell className="font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.stage}
                    </span>
                  </TableCell>
                  <TableCell align="right" className="font-mono font-bold text-slate-900">{s.val}</TableCell>
                  <TableCell align="right" className="font-mono text-slate-500">{s.pct}%</TableCell>
                  <TableCell align="right" className="font-mono text-slate-500">{s.count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max(s.pct, s.value > 0 ? 3 : 0)}%`, backgroundColor: s.color }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold text-slate-500">{s.pct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pipeline Conversion Rate</span>
          <span className="font-mono text-sm font-bold text-blue-600">{conversionRate}%</span>
        </div>
      </>
    )}
  </Card>
);
