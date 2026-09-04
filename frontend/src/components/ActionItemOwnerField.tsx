import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Info, User, X, ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { useCRM } from '@/contexts/CRMContext';
import type { Stakeholder } from '@/types';
import { serviceProviderStatus, type ServiceProviderStatus } from '@/utils';

export interface ActionItemOwnerFieldProps {
  accountId: string;
  stakeholders: Stakeholder[];
  /** The selected stakeholder's id (the Action Item's ownerStakeholderId). */
  value?: string;
  /** Fallback string display name if value is not matched to a stakeholder record. */
  fallbackName?: string;
  onChange: (stakeholderId: string) => void;
  tone?: 'blue' | 'amber';
  required?: boolean;
}

/** One row in the Service Providers column of the owner picker. */
interface ServiceProviderOption {
  /** Stable React key — the directory or stakeholder id it was built from. */
  key: string;
  /** Directory id (user or pending employee); absent for hand-created SP rows. */
  directoryId?: string;
  /** The SERVICE_PROVIDER stakeholder on this account, once one exists. */
  stakeholderId?: string;
  name: string;
  designation: string;
  /** Registration / activation state; null for rows with no directory entry. */
  status: ServiceProviderStatus | null;
}

/** Shown as tooltip/hint until an account is chosen. */
const NO_ACCOUNT_MSG = 'Please select an Account before assigning an Owner.';

/**
 * Simplified Owner picker for Action Items.
 * A single styled button shows the current selection (or a placeholder).
 * Clicking it opens the global stakeholder modal – no inline dropdown.
 *
 * The two columns are sourced differently on purpose:
 *   • Client Stakeholders — existing CLIENT stakeholder rows, as before.
 *   • Service Providers — the full Service Provider directory (every System
 *     User *plus* every whitelisted employee still pending self-registration),
 *     so it matches the Service Providers tab and every other SP picker rather
 *     than showing only people already attached to some account.
 *
 * An action item's owner is a `stakeholders` FK, so picking a directory person
 * who has no Service Provider stakeholder row on this account yet materialises
 * one first (idempotent server-side) and stores the resulting id.
 */
export const ActionItemOwnerField: React.FC<ActionItemOwnerFieldProps> = ({
  accountId,
  stakeholders,
  value,
  fallbackName,
  onChange,
  required = true,
}) => {
  const { accounts, addStakeholder, serviceProviders, associateServiceProvider } = useCRM();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  /** Key of the Service Provider row currently being registered on the account. */
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const createDisabledReason = account ? undefined : NO_ACCOUNT_MSG;

  // The currently-selected stakeholder (resolved from all stakeholders)
  const selected = React.useMemo(
    () => stakeholders.find((s) => s.id === value),
    [stakeholders, value],
  );

  const query = globalSearchQuery.toLowerCase().trim();

  // Client column: existing CLIENT rows, deduplicated by name (keep first).
  const globalClients = React.useMemo(() => {
    const seen = new Set<string>();
    return stakeholders.filter((s) => {
      if (s.stakeholderType !== 'CLIENT') return false;
      const key = s.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [stakeholders]);

  const filteredClients = React.useMemo(() => {
    if (!query) return globalClients;
    return globalClients.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.designation ?? '').toLowerCase().includes(query),
    );
  }, [globalClients, query]);

  // Service Provider column: the whole directory, plus any hand-created SP
  // stakeholder rows that predate the directory link so nothing disappears.
  const serviceProviderOptions = React.useMemo<ServiceProviderOption[]>(() => {
    const rowFor = (personId: string) =>
      stakeholders.find(
        (s) =>
          s.stakeholderType === 'SERVICE_PROVIDER' &&
          s.accountId === accountId &&
          (s.userId === personId || s.employeeId === personId),
      );

    const fromDirectory: ServiceProviderOption[] = serviceProviders.map((sp) => ({
      key:           `dir-${sp.id}`,
      directoryId:   sp.id,
      stakeholderId: rowFor(sp.id)?.id,
      // Pending people have no name on record yet — their email is the label.
      name:          sp.name || sp.email,
      designation:   sp.designation,
      status:        serviceProviderStatus(sp),
    }));

    const linked = new Set(serviceProviders.map((sp) => sp.id));
    const seen = new Set<string>();
    const unlinked: ServiceProviderOption[] = [];
    for (const s of stakeholders) {
      if (s.stakeholderType !== 'SERVICE_PROVIDER') continue;
      if ((s.userId && linked.has(s.userId)) || (s.employeeId && linked.has(s.employeeId))) continue;
      const key = s.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      unlinked.push({
        key:           `stk-${s.id}`,
        stakeholderId: s.id,
        name:          s.name || s.email,
        designation:   s.designation,
        status:        null,
      });
    }

    return [...fromDirectory, ...unlinked];
  }, [serviceProviders, stakeholders, accountId]);

  const filteredServiceProviders = React.useMemo(() => {
    if (!query) return serviceProviderOptions;
    return serviceProviderOptions.filter(
      (o) =>
        o.name.toLowerCase().includes(query) ||
        (o.designation ?? '').toLowerCase().includes(query) ||
        // Searching "pending" surfaces everyone still to register.
        (o.status ?? '').toLowerCase().includes(query),
    );
  }, [serviceProviderOptions, query]);

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

  /**
   * Picking a Service Provider. Rows that already exist on this account are
   * assigned straight away; a directory person without one is registered on the
   * account first, and the stakeholder id that comes back becomes the owner.
   */
  const handleSelectServiceProvider = async (option: ServiceProviderOption) => {
    if (option.stakeholderId) {
      handleSelect(option.stakeholderId);
      return;
    }
    if (!option.directoryId || !accountId) return;
    setResolvingKey(option.key);
    try {
      const stakeholderId = await associateServiceProvider(option.directoryId, accountId);
      if (stakeholderId) handleSelect(stakeholderId);
    } finally {
      setResolvingKey(null);
    }
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
            selected || fallbackName
              ? 'border-blue-200 bg-blue-50/60 text-slate-800 hover:border-blue-400 font-medium'
              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
          }
          disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
        `}
      >
        <span className="flex items-center gap-2 min-w-0">
          <User className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className={`truncate ${selected || fallbackName ? 'text-slate-800 font-semibold' : 'text-slate-400 font-medium'}`}>
            {selected ? (selected.name || selected.email) : (fallbackName || 'Select task owner…')}
          </span>
          {selected?.pendingRegistration && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700">
              Pending
            </span>
          )}
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
                      {filteredClients.length}
                    </span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100/60">
                    {filteredClients.map((s) => {
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
                    {filteredClients.length === 0 && (
                      <div className="p-12 text-center text-slate-400 text-xs italic">
                        No client stakeholders found.
                      </div>
                    )}
                  </div>
                </div>

                {/* Service Provider Stakeholders */}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[380px] bg-white shadow-sm">
                  <div className="px-4 py-3 bg-emerald-50/40 border-b border-slate-200 font-bold text-slate-700 text-[10px] uppercase tracking-wider select-none shrink-0 flex items-center justify-between">
                    <span>Service Providers</span>
                    <span className="bg-emerald-100/80 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      {filteredServiceProviders.length}
                    </span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100/60">
                    {filteredServiceProviders.map((o) => {
                      const isSelected = !!o.stakeholderId && o.stakeholderId === value;
                      const isResolving = resolvingKey === o.key;
                      const busy = resolvingKey !== null;
                      return (
                        <div
                          key={o.key}
                          onClick={() => { if (!busy) void handleSelectServiceProvider(o); }}
                          className={`px-4 py-3 flex flex-col gap-0.5 transition-all group ${
                            busy ? 'cursor-wait opacity-60' : 'cursor-pointer'
                          } ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50/85'}`}
                        >
                          <span className={`font-bold text-xs transition-colors flex items-center gap-2 ${isSelected ? 'text-emerald-600' : 'text-slate-800 group-hover:text-blue-600'}`}>
                            <span className="truncate">{o.name}</span>
                            {o.status === 'Pending Registration' && (
                              <span
                                className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-700"
                                title="Whitelisted employee who has not completed self-registration yet"
                              >
                                Pending Registration
                              </span>
                            )}
                            {o.status === 'Inactive' && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-500">
                                Inactive
                              </span>
                            )}
                            {isResolving && (
                              <span className="ml-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Adding…</span>
                            )}
                            {isSelected && (
                              <span className="ml-1 text-[9px] font-semibold text-emerald-500 uppercase tracking-wide">Selected</span>
                            )}
                          </span>
                          {o.designation && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {o.designation}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {filteredServiceProviders.length === 0 && (
                      <div className="p-12 text-center text-slate-400 text-xs italic">
                        No service providers found.
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
