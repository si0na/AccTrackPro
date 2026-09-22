/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Plus } from 'lucide-react';

export interface OpportunityClientStakeholderSelectorProps {
  accountId: string;
  /** Currently assigned client stakeholder ID on the opportunity (if any) */
  currentClientStakeholderId?: string;
  selectedStakeholderId: string;
  onSelectStakeholderId: (id: string) => void;
  /** Triggers the main canonical Client Stakeholder Registration Form modal */
  onCreateNew: () => void;
}

export const OpportunityClientStakeholderSelector: React.FC<OpportunityClientStakeholderSelectorProps> = ({
  accountId,
  selectedStakeholderId,
  onSelectStakeholderId,
  onCreateNew,
}) => {
  const { stakeholders } = useCRM();

  // Retrieve ONLY Client Stakeholders associated with THIS Opportunity's Account
  const accountClientStakeholders = useMemo(() => {
    return (stakeholders || [])
      .filter((s) => s.accountId === accountId && s.stakeholderType === 'CLIENT')
      .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }));
  }, [stakeholders, accountId]);

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-slate-600">
        Client Stakeholder
      </label>
      <div className="flex items-center gap-2">
        <select
          value={selectedStakeholderId}
          onChange={(e) => onSelectStakeholderId(e.target.value)}
          className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="">— Select Client Stakeholder —</option>
          {accountClientStakeholders.length === 0 ? (
            <option value="" disabled>No Client Stakeholders available for this account</option>
          ) : (
            accountClientStakeholders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.designation ? ` (${s.designation})` : ''}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          + New Stakeholder
        </button>
      </div>
      {accountClientStakeholders.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">
          No Client Stakeholders available for this account. Click "+ New Stakeholder" to register one.
        </p>
      )}
    </div>
  );
};
