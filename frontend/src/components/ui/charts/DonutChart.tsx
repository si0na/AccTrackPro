/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { LEGEND_STYLE, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from './chartTheme';

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
  valueFormatter?: (value: number) => string;
  innerRadiusPct?: number;
  /** Set false when the caller renders its own legend (e.g. with a share %). */
  showLegend?: boolean;
}

/** Part-to-whole donut with a legend and per-slice tooltip. */
export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  height = 240,
  valueFormatter = (v) => v.toLocaleString('en-US'),
  innerRadiusPct = 60,
  showLegend = true,
}) => (
  <ChartContainer height={height}>
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius={`${innerRadiusPct}%`}
        outerRadius="85%"
        paddingAngle={2}
        strokeWidth={0}
      >
        {data.map((entry) => (
          <Cell key={entry.name} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={TOOLTIP_CONTENT_STYLE}
        labelStyle={TOOLTIP_LABEL_STYLE}
        formatter={(value) => [valueFormatter(Number(value)), '']}
      />
      {showLegend && <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />}
    </PieChart>
  </ChartContainer>
);
