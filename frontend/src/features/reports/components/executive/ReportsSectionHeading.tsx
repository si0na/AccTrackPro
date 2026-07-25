/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface ReportsSectionHeadingProps {
  title: string;
  subtitle?: string;
}

/** Group-label heading separating sections of the Reports page (Executive Summary, Revenue Reports). */
export const ReportsSectionHeading: React.FC<ReportsSectionHeadingProps> = ({ title, subtitle }) => (
  <div className="flex items-center gap-3 pt-2">
    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{title}</h3>
    <div className="h-px flex-1 bg-slate-200" />
    {subtitle && <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{subtitle}</span>}
  </div>
);
