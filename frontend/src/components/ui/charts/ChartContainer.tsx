/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ResponsiveContainer } from 'recharts';

export interface ChartContainerProps {
  /**
   * Explicit pixel height — required. recharts' ResponsiveContainer renders
   * at 0 height inside a flex/grid parent unless given an explicit height,
   * so every chart on this page fixes one rather than relying on h-full.
   */
  height?: number;
  children: React.ReactElement;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ height = 260, children }) => (
  <ResponsiveContainer width="100%" height={height}>
    {children}
  </ResponsiveContainer>
);
