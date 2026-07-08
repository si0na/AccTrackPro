/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Calendar } from 'lucide-react';

/**
 * Financial Year / Quarter selector for reporting pages (Forecast, Reports,
 * and any future analytics views). Operational pages (Accounts,
 * Opportunities, Action Items, Stakeholders, Documents) never filter by
 * fiscal period and must not render this component.
 *
 * The selected period lives in CRMContext (persisted to localStorage), so
 * every reporting page shares the same selection.
 */
export const PeriodSelector: React.FC = () => {
  const {
    selectedYear, setSelectedYear,
    selectedQuarter, setSelectedQuarter,
    financialYears,
    financialCalendar,
    adminSettings,
  } = useCRM();

  // Only active FYs appear in the selector, limited by the admin setting.
  // selectedYear holds the fyLabel (e.g. "2026-27") or "All".
  const selectorFYs = useMemo(() => {
    const count = parseInt(adminSettings?.fySelectorCount ?? '5', 10);
    const activeFYs = financialYears.filter((f) => f.isActive);
    const sorted = [...activeFYs].sort((a, b) => b.startYear - a.startYear);
    const top = sorted.slice(0, count);
    // Always include the currently selected FY if it is active but outside the top-N window.
    if (selectedYear !== 'All' && !top.some((f) => f.fyLabel === selectedYear)) {
      const selected = activeFYs.find((f) => f.fyLabel === selectedYear);
      if (selected) top.push(selected);
    }
    return top.sort((a, b) => a.startYear - b.startYear);
  }, [financialYears, adminSettings, selectedYear]);

  // Auto-select the most recent active FY from the database on first visit.
  // Also falls back if the stored selection becomes inactive or no longer exists.
  useEffect(() => {
    if (!financialYears.length) return;
    const activeFYs = financialYears.filter((f) => f.isActive);
    const mostRecent = [...activeFYs].sort((a, b) => b.startYear - a.startYear)[0];

    if (selectedYear === 'All') {
      // First visit (nothing stored): auto-select the most recent active FY from DB.
      if (localStorage.getItem('crm_selected_year') === null && mostRecent) {
        setSelectedYear(mostRecent.fyLabel);
      }
      return;
    }

    // If the selected FY no longer exists or became inactive, fall back.
    const fy = financialYears.find((f) => f.fyLabel === selectedYear);
    if (!fy || !fy.isActive) {
      setSelectedYear(mostRecent ? mostRecent.fyLabel : 'All');
    }
  }, [financialYears, selectedYear, setSelectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quarter options come from the selected FY's stored calendar snapshot (database-driven).
  // Falls back to the global financial calendar template; no hardcoded values.
  const selectedFYForQuarters = financialYears.find((f) => f.fyLabel === selectedYear);
  const activeQuarterDefs = selectedFYForQuarters?.calendarQuarters ?? financialCalendar?.quarters ?? [];

  return (
    <div
      className="flex items-center space-x-2 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-xs max-w-xs"
      title="Reporting period — applies to this report only; operational lists are never filtered."
    >
      <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
      <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
        <span className="hidden sm:inline text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1">Reporting Period:</span>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="bg-transparent font-semibold text-slate-700 hover:text-indigo-600 transition-colors focus:outline-none cursor-pointer border-none p-0 pr-1 text-xs"
        >
          {selectorFYs.map((fy) => (
            <option key={fy.id} value={fy.fyLabel}>
              FY {fy.fyLabel}
            </option>
          ))}
          <option value="All">All Years</option>
        </select>
        <span className="text-slate-300">•</span>
        <select
          value={selectedQuarter}
          onChange={(e) => setSelectedQuarter(e.target.value)}
          className="bg-transparent font-semibold text-slate-700 hover:text-indigo-600 transition-colors focus:outline-none cursor-pointer border-none p-0 text-xs"
        >
          <option value="All">Full Year</option>
          {activeQuarterDefs.map((q) => (
            <option key={q.label} value={q.label}>{q.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
