import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Info, User, X, ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { useCRM } from '@/contexts/CRMContext';
import type { Stakeholder } from '@/types';

export interface ActionItemOwnerFieldProps {
  accountId: string;
  stakeholders: Stakeholder[];
  /** The selected stakeholder's id (the Action Item's ownerStakeholderId). */
  value?: string;
  onChange: (stakeholderId: string) => void;
  tone?: 'blue' | 'amber';
  required?: boolean;
}

/** Shown as tooltip/hint until an account is chosen. */
const NO_ACCOUNT_MSG = 'Please select an Account before assigning an Owner.';

/**
 * Simplified Owner picker for Action Items.
 * A single styled button shows the current selection (or a placeholder).
 * Clicking it opens the global stakeholder modal – no inline dropdown.
 */
export const ActionItemOwnerField: React.FC<ActionItemOwnerFieldProps> = ({
  accountId,
  stakeholders,
  value,
  onChange,
  required = true,
}) => {
  const { accounts, addStakeholder } = useCRM();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const account = accounts.find((a) => a.id === accountId);
  const createDisabledReason = account ? undefined : NO_ACCOUNT_MSG;

  // The currently-selected stakeholder (resolved from all stakeholders)
  const selected = React.useMemo(
    () => stakeholders.find((s) => s.id === value),
    [stakeholders, value],
  );

  // Deduplicate stakeholders by name + type (keep first occurrence)
  const uniqueStakeholders = React.useMemo(() => {
    const seen = new Set<string>();
    const unique: Stakeholder[] = [];
    for (const s of stakeholders) {
      const key = `${s.name.toLowerCase().trim()}_${s.stakeholderType}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    return unique;
  }, [stakeholders]);

  // Filter by search
  const filteredStakeholders = React.useMemo(() => {
    const q = globalSearchQuery.toLowerCase().trim();
    if (!q) return uniqueStakeholders;
    return uniqueStakeholders.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.designation ?? '').toLowerCase().includes(q),
    );
  }, [uniqueStakeholders, globalSearchQuery]);

  const globalClients = React.useMemo(
    () => filteredStakeholders.filter((s) => s.stakeholderType === 'CLIENT'),
    [filteredStakeholders],
  );

  const globalServiceProviders = React.useMemo(
    () => filteredStakeholders.filter((s) => s.stakeholderType === 'SERVICE_PROVIDER'),
    [filteredStakeholders],
  );

  const handleCreated = async (draft: Omit<Stakeholder, 'id'>) => {
    const created = await addStakeholder(draft);
    onChange(created.id);
    setCreating(false);
    setPickerOpen(false);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setPickerOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="space-y-1">
      {/* Single trigger button */}
      <button
        type="button"
        onClick={() => {
          setGlobalSearchQuery('');
          setPickerOpen(true);
        }}
        disabled={!accountId}
        title={!accountId ? NO_ACCOUNT_MSG : 'Click to select task owner'}
        className={`
          w-full flex items-center justify-between gap-2
          text-xs pl-3 pr-2.5 py-2 rounded-lg border transition-all
          ${
            selected
              ? 'border-blue-200 bg-blue-50/60 text-slate-800 hover:border-blue-400'
              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
          }
          disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
        `}
      >
        <span className="flex items-center gap-2 min-w-0">
          <User className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className={`truncate font-medium ${selected ? 'text-slate-700' : 'text-slate-400'}`}>
            {selected ? selected.name : 'Select task owner…'}
          </span>
          {selected?.designation && (
            <span className="shrink-0 text-[10px] text-slate-400 font-normal hidden sm:inline">
              · {selected.designation}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear selection"
              aria-label="Clear owner selection"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
        </span>
      </button>

      {/* Global Stakeholder Picker Modal */}
      {isPickerOpen && (
        <Modal
          isOpen={isPickerOpen}
          title={
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 text-base">Select Task Owner</span>
              <span className="text-[11px] text-slate-400 font-medium font-sans">
                Choose from existing stakeholders or create a new client stakeholder.
              </span>
            </div>
          }
          onClose={() => setPickerOpen(false)}
          maxWidth="max-w-4xl"
        >
          <div className="flex flex-col h-[560px]">
            {/* Scrollable content */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto min-h-0">
              {/* Search + Create row */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or designation..."
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  disabled={!!createDisabledReason}
                  title={createDisabledReason ?? 'Create a new client stakeholder'}
                  className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-blue-600 hover:bg-blue-50 text-blue-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm bg-white"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Create Client Stakeholder
                </button>
              </div>

              {/* Two-column list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 flex-1">
                {/* Client Stakeholders */}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[380px] bg-white shadow-sm">
                  <div className="px-4 py-3 bg-blue-50/40 border-b border-slate-200 font-bold text-slate-700 text-[10px] uppercase tracking-wider select-none shrink-0 flex items-center justify-between">
                    <span>Client Stakeholders</span>
                    <span className="bg-blue-100/80 text-blue-800 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      {globalClients.length}
                    </span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100/60">
                    {globalClients.map((s) => {
                      const isSelected = s.id === value;
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleSelect(s.id)}
                          className={`px-4 py-3 cursor-pointer flex flex-col gap-0.5 transition-all group ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50/85'
                          }`}
                        >
                          <span className={`font-bold text-xs transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-800 group-hover:text-blue-600'}`}>
                            {s.name}
                            {isSelected && <span className="ml-2 text-[9px] font-semibold text-blue-500 uppercase tracking-wide">Selected</span>}
                          </span>
                          {s.designation && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {s.designation}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {globalClients.length === 0 && (
                      <div className="p-12 text-center text-slate-400 text-xs italic">
                        No client stakeholders found.
                      </div>
                    )}
                  </div>
                </div>

                {/* Service Provider Stakeholders */}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[380px] bg-white shadow-sm">
                  <div className="px-4 py-3 bg-emerald-50/40 border-b border-slate-200 font-bold text-slate-700 text-[10px] uppercase tracking-wider select-none shrink-0 flex items-center justify-between">
                    <span>Service Provider Stakeholders</span>
                    <span className="bg-emerald-100/80 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      {globalServiceProviders.length}
                    </span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100/60">
                    {globalServiceProviders.map((s) => {
                      const isSelected = s.id === value;
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleSelect(s.id)}
                          className={`px-4 py-3 cursor-pointer flex flex-col gap-0.5 transition-all group ${
                            isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50/85'
                          }`}
                        >
                          <span className={`font-bold text-xs transition-colors ${isSelected ? 'text-emerald-600' : 'text-slate-800 group-hover:text-blue-600'}`}>
                            {s.name}
                            {isSelected && <span className="ml-2 text-[9px] font-semibold text-emerald-500 uppercase tracking-wide">Selected</span>}
                          </span>
                          {s.designation && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {s.designation}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {globalServiceProviders.length === 0 && (
                      <div className="p-12 text-center text-slate-400 text-xs italic">
                        No service provider stakeholders found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pinned Footer */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Click a stakeholder row to assign them as the task owner.</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Stakeholder Creation Modal */}
      {creating &&
        account &&
        createPortal(
          <StakeholderFormModal
            isOpen
            mode="create"
            accounts={accounts}
            lockedAccount={{ id: account.id, name: account.name }}
            lockedType="CLIENT"
            onClose={() => setCreating(false)}
            onSubmit={handleCreated}
          />,
          document.body,
        )}
    </div>
  );
};
