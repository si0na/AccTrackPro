/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, FolderKanban } from 'lucide-react';
import type { ColumnConfig, Opportunity } from '@/types';
import { ExpandableTextCell, STAGE_COLORS, StatusBadge, HEALTH_COLORS } from '@/components/ui';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

/**
 * Renders a single `<td>` for a given opportunity column — the one place
 * that decides cell formatting/badges for opportunity tables, so the
 * Opportunities page table and the Account Detail embedded table can never
 * drift from each other again.
 */
export const renderOpportunityCell = (
  col: ColumnConfig,
  opp: Opportunity,
  accountName: string,
): React.ReactNode => {
  if (col.key === 'name') {
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0">
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
        </div>
        <p className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors min-w-0">
          {opp.name}
        </p>
      </div>
    );
  }

  if (col.key === 'accountId') {
    return <span className="text-slate-600 font-semibold">{accountName}</span>;
  }

  if (col.key === 'stage') {
    // Won opportunities that have already transitioned into a Project are kept
    // in the list but flagged with a compact indigo pill (mirroring the
    // "Project Created" badge on the opportunity detail header) so users can
    // tell at a glance which Won deals are still pending project setup.
    const hasProject = opp.stage === 'Won' && !!opp.projectId;
    return (
      <div className="flex items-center gap-1.5">
        <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />
        {hasProject && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap"
            title="This opportunity has an associated project"
          >
            <FolderKanban className="w-3 h-3" aria-hidden="true" />
            Project
          </span>
        )}
      </div>
    );
  }

  if (col.key === 'value') {
    return <span className="text-slate-900 font-bold font-mono text-sm">{formatCurrency(opp.value)}</span>;
  }

  if (col.key === 'probability') {
    return (
      <div className="flex items-center justify-center space-x-2">
        <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full ${
              opp.probability >= 80 ? 'bg-green-500' :
              opp.probability >= 50 ? 'bg-blue-500' :
              'bg-yellow-500'
            }`}
            style={{ width: `${opp.probability}%` }}
            aria-label={`${opp.probability}%`}
          />
        </div>
        <span className="font-bold text-slate-700 font-mono text-[11px]">{opp.probability}%</span>
      </div>
    );
  }

  if (col.key === 'allocationStartDate') {
    return <span className="text-slate-500 font-mono font-medium whitespace-nowrap">{opp.allocationStartDate || 'N/A'}</span>;
  }

  if (col.key === 'allocationEndDate') {
    return <span className="text-slate-500 font-mono font-medium whitespace-nowrap">{opp.allocationEndDate || 'N/A'}</span>;
  }

  if (col.key === 'dealStartDate') {
    return <span className="text-slate-500 font-mono font-medium whitespace-nowrap">{opp.dealStartDate || 'N/A'}</span>;
  }

  if (col.key === 'dealCloseDate') {
    return <span className="text-slate-500 font-mono font-medium whitespace-nowrap">{opp.dealCloseDate || 'N/A'}</span>;
  }

  if (col.key === 'opportunityType') {
    return <span className="text-slate-600 font-medium">{opp.opportunityType}</span>;
  }

  if (col.key === 'opportunityHealth') {
    return opp.opportunityHealth
      ? <StatusBadge value={opp.opportunityHealth} colorMap={HEALTH_COLORS} />
      : <span className="text-slate-400 italic">—</span>;
  }

  if (col.key === 'revenueModel') {
    return <span className="text-slate-600 font-medium">{opp.revenueModel || '—'}</span>;
  }

  if (col.key === 'location') {
    return <span className="text-slate-600 font-medium">{opp.location || '—'}</span>;
  }

  if (col.key === 'cost') {
    return opp.cost != null
      ? <span className="text-slate-900 font-bold font-mono text-sm">{formatCurrency(opp.cost)}</span>
      : <span className="text-slate-400 font-mono text-sm">—</span>;
  }

  if (col.key === 'grossMargin') {
    return opp.grossMargin != null
      ? <span className="font-bold text-slate-700 font-mono text-[11px]">{opp.grossMargin}%</span>
      : <span className="text-slate-400 font-mono text-[11px]">—</span>;
  }

  if (col.key === 'risksAndDependencies') {
    return (
      <ExpandableTextCell
        text={opp.risksAndDependencies}
        label="Risks & Dependencies"
        emptyLabel="No Risks"
      />
    );
  }

  // Customizable dynamic custom columns
  const rawVal = (opp as any)[col.key] ?? (col.type === 'boolean' ? false : '');
  if (col.type === 'boolean') {
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rawVal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
        {rawVal ? 'Yes' : 'No'}
      </span>
    );
  }
  if (col.type === 'number') {
    return <span className="font-mono font-semibold text-slate-700">{rawVal}</span>;
  }
  if (col.type === 'date') {
    return <span className="font-mono text-slate-500">{rawVal}</span>;
  }
  return <span className="text-slate-600">{String(rawVal)}</span>;
};
