/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Stakeholder, InfluenceLevel, RelationshipStatus } from '@/types';
import { Plus, Mail, Phone, Trash2, Users, X } from 'lucide-react';
import {
  BackButton,
  Button,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  FilterBar,
  FormField,
  FormGrid,
  FormModal,
  INPUT_CLS,
  INFLUENCE_COLORS,
  PageHeader,
  RELATIONSHIP_COLORS,
  RowActionButton,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  StatusBadge,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { compareForSort, SortDirection } from '@/utils';

export const StakeholdersView: React.FC = () => {
  const {
    stakeholders,
    deactivatedStakeholders,
    accounts,
    deactivatedAccounts,
    addStakeholder,
    deleteStakeholder,
    focusedRecord,
    setFocusedRecord,
    setView,
    cameFromDashboard,
    navSource,
    loading,
  } = useCRM();

  // Single-record focus set when the user opens a stakeholder notification
  const focusedStakeholderId = focusedRecord?.type === 'stakeholder' ? focusedRecord.id : null;
  const focusedStakeholder = focusedStakeholderId
    ? stakeholders.find(s => s.id === focusedStakeholderId)
    : undefined;

  const [searchQuery, setSearchQuery] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const resolveAccount = (accountId: string) =>
    accounts.find(a => a.id === accountId) || deactivatedAccounts.find(a => a.id === accountId);

  // Creation state. Account, influence, and relationship start unselected —
  // the user must make explicit choices rather than inheriting defaults.
  const EMPTY_STAKEHOLDER: Omit<Stakeholder, 'id'> = {
    name: '',
    accountId: '',
    designation: '',
    influence: '' as InfluenceLevel,
    relationship: '' as RelationshipStatus,
    email: '',
    phone: ''
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStk, setNewStk] = useState<Omit<Stakeholder, 'id'>>(EMPTY_STAKEHOLDER);

  const filteredStks = stakeholders.filter(s => {
    if (focusedStakeholderId && s.id !== focusedStakeholderId) return false;
    const account = resolveAccount(s.accountId);
    return s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (account?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Column sort state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };
  const getSortValue = (s: Stakeholder, key: string) => {
    if (key === 'accountId') return resolveAccount(s.accountId)?.name || s.accountName || '';
    return (s as any)[key];
  };
  const sortedStks = [...filteredStks].sort((a, b) =>
    compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
  );

  const handleCreateStakeholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStk.name.trim() || !newStk.accountId || !newStk.influence || !newStk.relationship) return;
    try {
      await addStakeholder(newStk);
      setIsModalOpen(false);
      setNewStk(EMPTY_STAKEHOLDER);
    } catch {
      // Failure toast raised centrally by the API client; keep the modal open.
    }
  };

  if (loading) return <LoadingState label="Loading stakeholders…" />;

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
        subtitle="Keep record of client executives, their corporate influence, and relationship health."
        actions={
          <Button size="md" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
            Add Stakeholder
          </Button>
        }
      />

      {/* Single-record focus banner (arrived here from a notification) */}
      {focusedStakeholderId && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-2.5 rounded-lg text-xs font-semibold">
          <span>
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

      {/* Control Filters */}
      <FilterBar>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search stakeholders by name, designation, or client account..."
        />
      </FilterBar>

      {/* Stakeholders spreadsheet grid */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider select-none">
                <th className="py-3 px-5"><SortableHeader label="Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></th>
                <th className="py-3 px-4"><SortableHeader label="Client Account" field="accountId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></th>
                <th className="py-3 px-4"><SortableHeader label="Designation" field="designation" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></th>
                <th className="py-3 px-4 text-center"><SortableHeader label="Influence" field="influence" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" /></th>
                <th className="py-3 px-4 text-center"><SortableHeader label="Relationship" field="relationship" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" /></th>
                <th className="py-3 px-4"><SortableHeader label="Email" field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></th>
                <th className="py-3 px-4"><SortableHeader label="Phone" field="phone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></th>
                <th className="py-3 px-5 text-center">Remove</th>
              </tr>
            </thead>
            <tbody>
              {sortedStks.length === 0 ? (
                <EmptyRow colSpan={8} message="No stakeholders registered yet in the registry." />
              ) : (
                sortedStks.map(s => {
                  const account = resolveAccount(s.accountId);
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50/50 text-slate-800 font-medium">
                      <td className="py-3.5 px-5 font-extrabold text-slate-900">{s.name}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-bold">{account?.name || s.accountName || 'Unknown'}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-semibold">{s.designation}</td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge value={s.influence} colorMap={INFLUENCE_COLORS} shape="rounded" />
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge value={s.relationship} colorMap={RELATIONSHIP_COLORS} />
                      </td>
                      <td className="py-3.5 px-4 select-all text-slate-500 hover:text-blue-500 transition-colors">
                        <a href={`mailto:${s.email}`} className="flex items-center space-x-1 font-semibold">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[150px]">{s.email}</span>
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-mono select-all text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>{s.phone}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <RowActionButton
                          intent="delete"
                          label={`Delete stakeholder ${s.name}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => setDeleteTarget({ id: s.id, label: s.name })}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add stakeholder modal */}
      <FormModal
        isOpen={isModalOpen}
        title="Register Corporate Stakeholder"
        icon={<Users className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateStakeholder}
        submitLabel="Register Stakeholder"
      >
        <FormField label="Stakeholder Name" required>
          <input
            type="text"
            required
            value={newStk.name}
            onChange={(e) => setNewStk({ ...newStk, name: e.target.value })}
            placeholder="e.g., David Miller"
            className={INPUT_CLS}
          />
        </FormField>

        <FormField label="Client Account Association" required>
          <select
            required
            value={newStk.accountId}
            onChange={(e) => setNewStk({ ...newStk, accountId: e.target.value })}
            className={SELECT_CLS}
          >
            <option value="" disabled>Select account…</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormGrid>
          <FormField label="Corporate Designation" required>
            <input
              type="text"
              required
              value={newStk.designation}
              onChange={(e) => setNewStk({ ...newStk, designation: e.target.value })}
              placeholder="e.g., CTO"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Influence Level" required>
            <select
              required
              value={newStk.influence}
              onChange={(e) => setNewStk({ ...newStk, influence: e.target.value as InfluenceLevel })}
              className={SELECT_CLS}
            >
              <option value="" disabled>Select influence…</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </FormField>

          <FormField label="Relationship Status" required>
            <select
              required
              value={newStk.relationship}
              onChange={(e) => setNewStk({ ...newStk, relationship: e.target.value as RelationshipStatus })}
              className={SELECT_CLS}
            >
              <option value="" disabled>Select relationship…</option>
              <option value="Strong">Strong</option>
              <option value="Neutral">Neutral</option>
              <option value="Weak">Weak</option>
            </select>
          </FormField>

          <FormField label="Direct Line Phone" required>
            <input
              type="text"
              required
              value={newStk.phone}
              onChange={(e) => setNewStk({ ...newStk, phone: e.target.value })}
              placeholder="e.g., +1 555 123 4567"
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
        </FormGrid>

        <FormField label="Direct Email" required>
          <input
            type="email"
            required
            value={newStk.email}
            onChange={(e) => setNewStk({ ...newStk, email: e.target.value })}
            placeholder="e.g., david.miller@company.com"
            className={INPUT_CLS}
          />
        </FormField>
      </FormModal>

      {/* Deactivated Stakeholders Section */}
      {deactivatedStakeholders.length > 0 && (
        <DeactivatedSection title="Deactivated Stakeholders" count={deactivatedStakeholders.length}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider select-none">
                <th className="py-2.5 px-5">Name</th>
                <th className="py-2.5 px-4">Client Account</th>
                <th className="py-2.5 px-4">Designation</th>
                <th className="py-2.5 px-4 text-center">Influence</th>
                <th className="py-2.5 px-4 text-center">Relationship</th>
                <th className="py-2.5 px-4">Email</th>
              </tr>
            </thead>
            <tbody>
              {deactivatedStakeholders.map((s) => {
                const acc = resolveAccount(s.accountId);
                return (
                  <tr key={s.id} className="border-b last:border-0 text-slate-500 font-medium opacity-70">
                    <td className="py-3 px-5 font-semibold text-slate-600 line-through decoration-slate-300">{s.name}</td>
                    <td className="py-3 px-4 text-slate-500">{s.accountName || acc?.name || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{s.designation}</td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge value={s.influence} colorMap={INFLUENCE_COLORS} shape="rounded" muted />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge value={s.relationship} colorMap={RELATIONSHIP_COLORS} muted />
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[10px] font-mono">{s.email}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
