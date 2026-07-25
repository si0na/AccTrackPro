/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card } from '@/components/ui';
import { RadialGaugeChart } from '@/components/ui/charts';

export interface ForecastVsTargetCardProps {
  totalForecastValue: number;
  targetValue: number;
  targetMetPct: number;
  formatCurrency: (n: number) => string;
}

// Single threshold drives both the badge label and its color, and the
// gauge/footer tint — previously the label (85%) and color (80%) disagreed
// in the 80-84% band, showing a green ring next to an "IN PLAY" badge.
const ON_TARGET_THRESHOLD = 85;

export const ForecastVsTargetCard: React.FC<ForecastVsTargetCardProps> = ({
  totalForecastValue,
  targetValue,
  targetMetPct,
  formatCurrency,
}) => {
  const onTarget = targetMetPct >= ON_TARGET_THRESHOLD;
  const tone = onTarget ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50';
  const gaugeColor = onTarget ? '#10b981' : '#f59e0b';

  const gapValue = Math.max(0, targetValue - totalForecastValue);
  const gapPct = Math.max(0, 100 - targetMetPct);

  const legend = [
    { label: 'Forecast', value: formatCurrency(totalForecastValue), pct: `${targetMetPct}%`, dot: gaugeColor, ring: false },
    { label: 'Gap to Target', value: formatCurrency(gapValue), pct: `${gapPct}%`, dot: '#e2e8f0', ring: false },
    { label: 'Target Goal', value: formatCurrency(targetValue), pct: null as string | null, dot: '#94a3b8', ring: true },
  ];

  return (
    <Card
      title="Forecast vs Target"
      subtitle="Weighted forecast revenue against the target goal"
      actions={
        <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${tone}`}>
          {onTarget ? 'ON TARGET' : 'IN PLAY'}
        </span>
      }
      className="lg:col-span-2"
      bodyClassName="h-full flex flex-col justify-between"
    >
      <div className="flex flex-col items-center gap-4 py-1 sm:flex-row sm:items-center sm:gap-2">
        <div className="w-40 shrink-0">
          <RadialGaugeChart
            pct={targetMetPct}
            color={gaugeColor}
            centerValue={formatCurrency(totalForecastValue)}
            centerLabel="Forecast Revenue"
            height={168}
          />
        </div>
        <ul className="w-full flex-1 space-y-2.5">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={item.ring
                  ? { border: `2px solid ${item.dot}`, backgroundColor: 'transparent' }
                  : { backgroundColor: item.dot }}
              />
              <span className="flex-1 truncate text-xs font-medium text-slate-500">{item.label}</span>
              <span className="font-mono text-xs font-bold text-slate-800">{item.value}</span>
              {item.pct && <span className="w-9 text-right font-mono text-[11px] text-slate-400">{item.pct}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className={`text-xs font-semibold ${onTarget ? 'text-emerald-600' : 'text-blue-600'}`}>
            {targetMetPct}% of target goal achieved
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${targetMetPct}%`, backgroundColor: gaugeColor }}
          />
        </div>
      </div>
    </Card>
  );
};
