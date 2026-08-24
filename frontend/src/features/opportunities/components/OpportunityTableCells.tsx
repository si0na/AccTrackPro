/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, FolderKanban } from 'lucide-react';
import type { ColumnConfig, Opportunity, OpportunityStage } from '@/types';
import { ExpandableTextCell, STAGE_COLORS, StatusBadge, HEALTH_COLORS } from '@/components/ui';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

interface InlineStageSelectorProps {
  opp: Opportunity;
  onStageChange: (opp: Opportunity, newStage: OpportunityStage) => void;
}

const InlineStageSelector: React.FC<InlineStageSelectorProps> = ({ opp, onStageChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [openUp, setOpenUp] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      const handleScroll = (event: Event) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
        document.removeEventListener('scroll', handleScroll, { capture: true });
      };
    }
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 242;

      let isUp = false;
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        isUp = true;
      }
      setOpenUp(isUp);

      let targetTop = 0;
      if (isUp) {
        targetTop = rect.top - 4 - dropdownHeight;
        if (targetTop < 10) {
          targetTop = 10;
        }
      } else {
        targetTop = rect.bottom + 4;
        if (targetTop + dropdownHeight > window.innerHeight - 10) {
          targetTop = window.innerHeight - 10 - dropdownHeight;
        }
      }

      setCoords({
        top: targetTop,
        left: rect.left,
      });
    }
    setIsOpen(!isOpen);
  };

  const colorClass = STAGE_COLORS[opp.stage] || 'bg-slate-100 text-slate-700';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={handleToggle}
        className={`cursor-pointer px-1 py-0.5 w-[75px] whitespace-normal break-words leading-tight text-center rounded-full text-[10px] font-semibold border border-transparent hover:brightness-95 transition-all outline-none ${colorClass}`}
      >
        {opp.stage}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
          className="w-44 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 focus:outline-none z-[100]"
        >
          <div className="py-1 max-h-[240px] overflow-y-auto">
            {Object.keys(STAGE_COLORS).map((stg) => {
              const stageVal = stg as OpportunityStage;
              const isSelected = opp.stage === stageVal;
              return (
                <button
                  key={stg}
                  type="button"
                  onClick={() => {
                    onStageChange(opp, stageVal);
                    setIsOpen(false);
                  }}
                  className={`flex items-center w-full px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 transition-colors ${
                    isSelected ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${STAGE_COLORS[stageVal]}`} />
                  {stageVal}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

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
  onStageChange?: (opp: Opportunity, newStage: OpportunityStage) => void,
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
    const hasProject = opp.stage === 'Won' && !!opp.projectId;
    if (onStageChange) {
      return (
        <div className="flex items-center gap-1.5">
          <InlineStageSelector opp={opp} onStageChange={onStageChange} />
          {hasProject && (
            <span
              className="inline-flex items-center justify-center p-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0"
              title="This opportunity has an associated project"
            >
              <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />
        {hasProject && (
          <span
            className="inline-flex items-center justify-center p-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0"
            title="This opportunity has an associated project"
          >
            <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
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
    return <span className="text-slate-500 font-mono font-medium whitespace-nowrap">{opp.allocationStartDate || '—'}</span>;
  }

  if (col.key === 'allocationEndDate') {
    return <span className="text-slate-500 font-mono font-medium whitespace-nowrap">{opp.allocationEndDate || '—'}</span>;
  }

  if (col.key === 'description') {
    return (
      <ExpandableTextCell
        text={opp.description}
        label="Description"
        emptyLabel="No Description"
      />
    );
  }

  if (col.key === 'serviceProviderStakeholderId') {
    return <span className="text-slate-600 font-semibold">{opp.serviceProviderStakeholderName || '—'}</span>;
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
