/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Account, Stakeholder, StakeholderType } from '@/types';
import { Building2, Plus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui';
import { StakeholderTable } from './StakeholderTable';

export interface StakeholderTabsProps {
  /** Client (stakeholderType === 'CLIENT') rows to display in the Client tab. */
  clientRows: Stakeholder[];
  /** Service-provider (stakeholderType === 'SERVICE_PROVIDER') rows for the SP tab. */
  serviceProviderRows: Stakeholder[];
  resolveAccount: (id: string) => Account | undefined;
  /** Hide the Account column (single-account / single-opportunity scopes). */
  hideAccountColumn?: boolean;
  /** Distinguishes storage keys + empty-state copy per usage. */
  storageKeyPrefix: string;
  /** Optional header title rendered to the left of the Add button. */
  title?: string;

  // Permissions ─ gate the Add button and per-row Edit/Delete actions.
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;

  // Handlers ─ omit any to disable that action. `onAdd` receives the active
  // tab's type so the parent's create form defaults to the right kind.
  onAdd?: (type: StakeholderType) => void;
  onEdit?: (s: Stakeholder) => void;
  onDelete?: (s: Stakeholder) => void;
  /** Row / name click — used for a read-only "view details" affordance. */
  onRowClick?: (s: Stakeholder) => void;

  /**
   * Forces the active tab (e.g. when arriving from a notification for a
   * specific stakeholder). Switching is otherwise fully internal.
   */
  focusTab?: StakeholderType | null;

  /**
   * Badge counts. Default to the displayed row counts; the global directory
   * overrides these so the badges reflect totals even while a single record is
   * focused.
   */
  clientCount?: number;
  serviceProviderCount?: number;

  /** Override the "no rows at all" empty-state copy per tab. */
  clientEmptyMessage?: string;
  serviceProviderEmptyMessage?: string;
}

/**
 * The canonical two-tab stakeholder view — Client Stakeholders vs Service
 * Providers — shared by the Stakeholders directory, Account Details and
 * Opportunity Details so all three read and behave identically.
 *
 * The parent supplies the already-scoped rows for each type (global, single
 * account, or single opportunity) plus permissions and CRUD handlers; this
 * component owns the tab UI, per-tab counts, the (type-aware) Add button and
 * the empty states. Each tab's `StakeholderTable` keeps its own search / sort /
 * pagination, so switching tabs only changes the displayed data — filters never
 * leak across tabs.
 */
export const StakeholderTabs: React.FC<StakeholderTabsProps> = ({
  clientRows,
  serviceProviderRows,
  resolveAccount,
  hideAccountColumn = false,
  storageKeyPrefix,
  title,
  canCreate = false,
  canEdit = false,
  canDelete = false,
  onAdd,
  onEdit,
  onDelete,
  onRowClick,
  focusTab,
  clientCount,
  serviceProviderCount,
  clientEmptyMessage = 'No Client Stakeholders found.',
  serviceProviderEmptyMessage = 'No Service Providers found.',
}) => {
  const [activeTab, setActiveTab] = useState<StakeholderType>('CLIENT');

  // Jump to the tab a focused (notification) record belongs to.
  useEffect(() => {
    if (focusTab) setActiveTab(focusTab);
  }, [focusTab]);

  const showAdd = canCreate && !!onAdd;

  const tabs: Array<{ key: StakeholderType; label: string; icon: React.ReactNode; count: number }> = [
    {
      key: 'CLIENT',
      label: 'Client Stakeholders',
      icon: <Building2 className="w-4 h-4" />,
      count: clientCount ?? clientRows.length,
    },
    {
      key: 'SERVICE_PROVIDER',
      label: 'Service Providers',
      icon: <Wrench className="w-4 h-4" />,
      count: serviceProviderCount ?? serviceProviderRows.length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header row: optional title + type-aware Add button */}
      {(title || showAdd) && (
        <div className="flex items-center justify-between gap-3">
          {title
            ? <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">{title}</h4>
            : <span />}
          {showAdd && (
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => onAdd!(activeTab)}>
              {activeTab === 'SERVICE_PROVIDER' ? 'Add Service Provider' : 'Add Stakeholder'}
            </Button>
          )}
        </div>
      )}

      {/* Tabs: Client Stakeholders | Service Providers */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map(t => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-tight border-b-2 -mb-px transition-colors cursor-pointer ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'CLIENT' ? (
        <StakeholderTable
          rows={clientRows}
          type="CLIENT"
          resolveAccount={resolveAccount}
          hideAccountColumn={hideAccountColumn}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onRowClick={onRowClick}
          storageKey={`${storageKeyPrefix}-client`}
          emptyMessage={clientRows.length === 0
            ? clientEmptyMessage
            : 'No client stakeholders match your search.'}
        />
      ) : (
        <StakeholderTable
          rows={serviceProviderRows}
          type="SERVICE_PROVIDER"
          resolveAccount={resolveAccount}
          hideAccountColumn={hideAccountColumn}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onRowClick={onRowClick}
          storageKey={`${storageKeyPrefix}-sp`}
          emptyMessage={serviceProviderRows.length === 0
            ? serviceProviderEmptyMessage
            : 'No service providers match your search.'}
        />
      )}
    </div>
  );
};
