/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { AXIS_TICK_STYLE, CHART_MARGIN, GRID_STROKE, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from './chartTheme';

export interface HorizontalBarDatum {
  label: string;
  value: number;
  color: string;
}

export interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
  barSize?: number;
  /** Width reserved for the category-axis labels. */
  labelWidth?: number;
  /** Prints the formatted value at the end of each bar, so the figure reads
   *  without needing to hover — the tooltip remains available as a backup. */
  showValueLabels?: boolean;
  /** Second element of the tooltip row, e.g. "Pipeline Value" — gives the
   *  number context without repeating the category (already the tooltip title). */
  valueLabel?: string;
}

/** Ranked horizontal bar chart — one bar per category, each independently colored via `data[].color`. */
export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  height,
  valueFormatter = (v) => v.toLocaleString('en-US'),
  barSize = 22,
  labelWidth = 130,
  showValueLabels = true,
  valueLabel = 'Value',
}) => (
  <ChartContainer height={height ?? Math.max(200, data.length * 48)}>
    <BarChart
      data={data}
      layout="vertical"
      margin={{ ...CHART_MARGIN, right: showValueLabels ? 72 : CHART_MARGIN.right }}
      barCategoryGap="32%"
    >
      <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
      <XAxis type="number" tick={AXIS_TICK_STYLE} tickFormatter={valueFormatter} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="label" tick={AXIS_TICK_STYLE} width={labelWidth} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={TOOLTIP_CONTENT_STYLE}
        labelStyle={TOOLTIP_LABEL_STYLE}
        formatter={(value) => [valueFormatter(Number(value)), valueLabel]}
        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
      />
      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={barSize}>
        {data.map((entry) => (
          <Cell key={entry.label} fill={entry.color} />
        ))}
        {showValueLabels && (
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => valueFormatter(Number(v))}
            style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }}
          />
        )}
      </Bar>
    </BarChart>
  </ChartContainer>
);
