/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Account, Stakeholder, StakeholderType } from '@/types';
import { X, Users } from 'lucide-react';
import {
  BackButton,
  ConfirmDialog,
  DeactivatedSection,
  INFLUENCE_COLORS,
  PageHeader,
  RELATIONSHIP_COLORS,
  STAKEHOLDER_TYPE_COLORS,
  STAKEHOLDER_TYPE_LABELS,
  StatusBadge,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { StakeholderFormModal } from './StakeholderFormModal';
import { StakeholderTabs } from './StakeholderTabs';
import { LoadingState } from '@/components/common/LoadingState';

export const StakeholdersView: React.FC = () => {
  const {
    stakeholders,
    deactivatedStakeholders,
    accounts,
    deactivatedAccounts,
    addStakeholder,
    updateStakeholder,
    deleteStakeholder,
    focusedRecord,
    setFocusedRecord,
    setView,
    cameFromDashboard,
    navSource,
    globalAccountId: accountFilter,
    loading,
    can,
    serviceProviders,
  } = useCRM();

  // Single-record focus set when the user opens a stakeholder notification
  const focusedStakeholderId = focusedRecord?.type === 'stakeholder' ? focusedRecord.id : null;
  const focusedStakeholder = focusedStakeholderId
    ? stakeholders.find(s => s.id === focusedStakeholderId)
    : undefined;

  const [createType, setCreateType] = useState<StakeholderType>('CLIENT');

  const resolveAccount = (accountId: string): Account | undefined =>
    accounts.find(a => a.id === accountId) || deactivatedAccounts.find(a => a.id === accountId);

  const lockedAccount = accountFilter !== 'All'
    ? { id: accountFilter, name: accounts.find(a => a.id === accountFilter)?.name ?? '' }
    : undefined;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Stakeholder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  // Client Stakeholders: respect global account filter and notification focus
  const baseStakeholders = stakeholders.filter(s => {
    if (focusedStakeholderId && s.id !== focusedStakeholderId) return false;
    if (accountFilter !== 'All' && s.accountId !== accountFilter) return false;
    return true;
  });

  const clientStks = baseStakeholders.filter(s => s.stakeholderType === 'CLIENT');

  // Service Providers: ALL system users regardless of active status
  // (not filtered by account — this is the global directory)
  const clientCount = stakeholders.filter(s => s.stakeholderType === 'CLIENT').length;
  const spCount = serviceProviders.length;

  if (loading) return <LoadingState label="Loading stakeholders…" />;

  const canCreate = can('stakeholders', 'create');

  return (
    <div className="space-y-6">
      {/* Back to Dashboard (when arriving from a dashboard drill-down) */}
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />
        </div>
      )}

      {/* Back to Notifications / Audit Log */}
      {navSource && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton
            label={navSource === 'notifications' ? 'Back to Notifications' : 'Back to Audit Log'}
            onClick={() => setView(navSource === 'notifications' ? 'notifications' : 'audit-log')}
          />
        </div>
      )}

      <PageHeader
        title="Stakeholders Directory"
        subtitle="Client executives and internal service providers, kept in clearly separated registers."
      />

      {/* Single-record focus banner (arrived here from a notification) */}
      {focusedStakeholderId && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-2.5 rounded-lg text-xs font-semibold">
          <span className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden="true" />
            {focusedStakeholder
              ? <>Showing the stakeholder <span className="font-extrabold">"{focusedStakeholder.name}"</span> from your notification.</>
              : 'The stakeholder from your notification is not in the current period/filter — they may be deactivated or belong to another financial year.'}
          </span>
          <button
            onClick={() => setFocusedRecord(null)}
            className="shrink-0 flex items-center gap-1 text-indigo-500 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
            title="Show all stakeholders"
          >
            <X className="w-3 h-3" />
            <span>Show all</span>
          </button>
        </div>
      )}

      <StakeholderTabs
        clientRows={clientStks}
        serviceProviders={serviceProviders}
        resolveAccount={resolveAccount}
        hideSpAdd={true}
        storageKeyPrefix="stakeholders"
        focusTab={focusedStakeholder?.stakeholderType ?? null}
        clientCount={clientCount}
        serviceProviderCount={spCount}
        canCreate={canCreate}
        canEdit={can('stakeholders', 'update')}
        canDelete={can('stakeholders', 'delete')}
        onAdd={(type) => { setCreateType(type); setIsModalOpen(true); }}
        onEdit={setEditTarget}
        onDelete={(s) => setDeleteTarget({ id: s.id, label: s.name })}
        clientEmptyMessage="No Client Stakeholders found."
        serviceProviderEmptyMessage="No System Users found. Add users in the Administration page."
      />

      {/* Add stakeholder modal — type is fixed to the tab the user added from. */}
      <StakeholderFormModal
        isOpen={isModalOpen}
        mode="create"
        accounts={accounts}
        lockedAccount={lockedAccount}
        lockedType={createType}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (draft) => { await addStakeholder(draft); }}
      />

      {/* Edit stakeholder modal */}
      <StakeholderFormModal
        isOpen={!!editTarget}
        mode="edit"
        stakeholder={editTarget}
        accounts={accounts}
        onClose={() => setEditTarget(null)}
        onSubmit={async (draft) => {
          if (editTarget) await updateStakeholder({ ...editTarget, ...draft });
        }}
      />

      {/* Deactivated Stakeholders Section */}
      {deactivatedStakeholders.length > 0 && (
        <DeactivatedSection title="Deactivated Stakeholders" count={deactivatedStakeholders.length}>
          <Table>
            <TableHead>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>Client Account</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Department</TableHeadCell>
              <TableHeadCell>Designation</TableHeadCell>
              <TableHeadCell align="center">Influence Level</TableHeadCell>
              <TableHeadCell align="center">Relationship</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
            </TableHead>
            <tbody>
              {deactivatedStakeholders.map((s) => {
                const acc = resolveAccount(s.accountId);
                return (
                  <TableRow key={s.id} className="opacity-70">
                    <TableCell className="font-semibold text-slate-600 line-through decoration-slate-300">{s.name}</TableCell>
                    <TableCell className="text-slate-500">{s.accountName || acc?.name || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge value={STAKEHOLDER_TYPE_LABELS[s.stakeholderType]} colorMap={STAKEHOLDER_TYPE_COLORS} shape="rounded" muted />
                    </TableCell>
                    <TableCell className="text-slate-400">{s.department || '—'}</TableCell>
                    <TableCell className="text-slate-400">{s.designation}</TableCell>
                    <TableCell align="center">
                      {s.stakeholderType === 'SERVICE_PROVIDER'
                        ? <span className="text-slate-300">—</span>
                        : <StatusBadge value={s.influence} colorMap={INFLUENCE_COLORS} shape="rounded" muted />}
                    </TableCell>
                    <TableCell align="center">
                      {s.stakeholderType === 'SERVICE_PROVIDER'
                        ? <span className="text-slate-300">—</span>
                        : <StatusBadge value={s.relationship} colorMap={RELATIONSHIP_COLORS} muted />}
                    </TableCell>
                    <TableCell className="text-slate-400 text-[10px] font-mono">{s.email}</TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </DeactivatedSection>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Stakeholder"
        message={deleteTarget ? <>Deactivate stakeholder <span className="font-bold">"{deleteTarget.label}"</span>? They will no longer appear in the directory.</> : undefined}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteStakeholder(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
