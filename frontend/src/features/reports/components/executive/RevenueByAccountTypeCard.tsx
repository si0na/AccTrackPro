/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PieChart } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { DonutChart } from '@/components/ui/charts';

export interface AccountTypeDatum {
  type: string;
  val: number;
  pct: number;
  color: string;
}

export interface RevenueByAccountTypeCardProps {
  typeBreakdown: AccountTypeDatum[];
  formatCurrency: (n: number) => string;
  periodLabel: string;
}

/**
 * Weighted forecast revenue split by account classification. The donut carries
 * the part-to-whole shape while a vertical legend on the side reads every label
 * in full — long classification names can never overflow the chart or crowd the
 * slices the way on-slice labels did.
 */
export const RevenueByAccountTypeCard: React.FC<RevenueByAccountTypeCardProps> = ({
  typeBreakdown,
  formatCurrency,
  periodLabel,
}) => {
  const hasData = typeBreakdown.some((item) => item.val > 0);
  const donutData = typeBreakdown
    .filter((item) => item.val > 0)
    .map((item) => ({ name: item.type, value: item.val, color: item.color }));

  return (
    <Card
      title="Revenue by Account Type"
      subtitle="Weighted forecast revenue by account classification"
      actions={
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{periodLabel}</span>
      }
      className="lg:col-span-2"
      bodyClassName="h-full flex flex-col justify-center"
    >
      {!hasData ? (
        <EmptyState
          icon={<PieChart className="h-6 w-6 text-slate-400" aria-hidden="true" />}
          title="No forecast revenue for the current filters"
          hint="Adjust the report filters above to see revenue by account type."
        />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-4">
          <div className="w-36 shrink-0 sm:w-40">
            <DonutChart data={donutData} height={160} showLegend={false} valueFormatter={formatCurrency} />
          </div>
          <ul className="w-full flex-1 space-y-3">
            {typeBreakdown.map((item) => (
              <li key={item.type} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">{item.type}</span>
                <span className="font-mono text-xs font-bold text-slate-800">{formatCurrency(item.val)}</span>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold text-slate-400">{item.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
