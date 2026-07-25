/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface RadialGaugeChartProps {
  /** 0-100 */
  pct: number;
  color: string;
  centerValue: string;
  centerLabel: string;
  height?: number;
}

/** Single-ring radial progress gauge with a centered value/label overlay. */
export const RadialGaugeChart: React.FC<RadialGaugeChartProps> = ({ pct, color, centerValue, centerLabel, height = 200 }) => {
  const safePct = Math.max(0, Math.min(100, pct));
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePct / 100) * circumference;
  
  // Base SVG size 160x160, scaling via CSS
  return (
    <div className="relative flex flex-col items-center justify-center w-full" style={{ minHeight: height }}>
      <svg 
        viewBox="0 0 160 160" 
        className="overflow-visible"
        style={{ width: '100%', height: '100%', maxHeight: height }}
      >
        {/* Background track */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="#f1f5f9"
          strokeWidth="12"
          fill="none"
        />
        {/* Progress arc */}
        {safePct > 0 && (
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={color}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 80 80)"
            className="transition-all duration-1000 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
        <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">{centerValue}</span>
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{centerLabel}</span>
      </div>
    </div>
  );
};
