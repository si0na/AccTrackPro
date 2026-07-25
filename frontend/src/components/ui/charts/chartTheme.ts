/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared recharts styling constants — plain config objects fed directly into
 * recharts' native props (Tooltip/Legend/CartesianGrid/Axis), so every chart
 * on the Reports page shares one look without a dedicated wrapper component
 * for what is just a style object in recharts' own API.
 */

import type { CSSProperties } from 'react';

export const CHART_MARGIN = { top: 8, right: 16, left: 4, bottom: 8 };

export const AXIS_TICK_STYLE = { fontSize: 11, fill: '#64748b' }; // slate-500

export const GRID_STROKE = '#f1f5f9'; // slate-100

export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0', // slate-200
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  padding: '8px 12px',
};

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: '#1e293b', // slate-800
  fontWeight: 600,
  marginBottom: 4,
};

export const LEGEND_STYLE: CSSProperties = {
  fontSize: 11,
  color: '#64748b',
};

/**
 * Fixed-order categorical palette for charts with an open-ended category set
 * (e.g. Service Line). Kept to 7 distinguishable Tailwind -500 hues plus a
 * slate "Other" — the same tone family already used across the app's
 * CardTone/badge system — rather than generating one hue per category, which
 * stops reading as distinct identity past ~7-8 slots.
 */
export const CATEGORICAL_CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
] as const;

export const OTHER_CATEGORY_COLOR = '#94a3b8'; // slate-400

/** Single flat hue for nominal, single-series bar charts (e.g. one bar per
 *  location) where color carries no identity — only bar length does. */
export const SEQUENTIAL_CHART_COLOR = '#3b82f6'; // blue-500
