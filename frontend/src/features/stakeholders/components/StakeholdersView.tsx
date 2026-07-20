/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Stakeholder } from '@/types';
import { Plus, Mail, Phone, X, Users } from 'lucide-react';
import {
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  FilterBar,
  FilterSelect,
  INFLUENCE_COLORS,
  PageHeader,
  Pagination,
  RELATIONSHIP_COLORS,
  SearchBar,
  SortableHeader,
  STAKEHOLDER_TYPE_COLORS,
  STAKEHOLDER_TYPE_LABELS,
  StatusBadge,
  Table,
  TableActions,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { StakeholderFormModal } from './StakeholderFormModal';
import { LoadingState } from '@/components/common/LoadingState';
import { compareForSort, SortDirection } from '@/utils';

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
    loading,
  } = useCRM();

  // Single-record focus set when the user opens a stakeholder notification
  const focusedStakeholderId = focusedRecord?.type === 'stakeholder' ? focusedRecord.id : null;
  const focusedStakeholder = focusedStakeholderId
    ? stakeholders.find(s => s.id === focusedStakeholderId)
    : undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<string>('All');
  const [stakeholderTypeFilter, setStakeholderTypeFilter] = useState<string>('All');

  // Client-side pagination over the already-filtered/sorted rows (display only)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const resolveAccount = (accountId: string) =>
    accounts.find(a => a.id === accountId) || deactivatedAccounts.find(a => a.id === accountId);

  // Create/edit dialog state (shared StakeholderFormModal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Stakeholder | null>(null);

  // Account filter options: only accounts that actually have stakeholders.
  const accountFilterOptions = Array.from(new Set(stakeholders.map(s => s.accountId)))
    .map(id => ({
      value: id,
      label: resolveAccount(id)?.name
        || stakeholders.find(s => s.accountId === id)?.accountName
        || id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filteredStks = stakeholders.filter(s => {
    if (focusedStakeholderId && s.id !== focusedStakeholderId) return false;
    if (accountFilter !== 'All' && s.accountId !== accountFilter) return false;
    if (stakeholderTypeFilter !== 'All' && s.stakeholderType !== stakeholderTypeFilter) return false;
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

  // Clamp the page so filter changes never leave the user on an empty page.
  const totalPages = Math.max(1, Math.ceil(sortedStks.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedStks = sortedStks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
          <>
            <Button size="md" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
              Add Stakeholder
            </Button>
          </>
        }
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

      {/* Control Filters */}
      <FilterBar>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search stakeholders by name, designation, or client account..."
          className="flex-1 min-w-[240px]"
        />
        <FilterSelect
          label="Account"
          hideLabel
          value={accountFilter}
          onChange={(v) => { setAccountFilter(v); setPage(1); }}
          options={[{ value: 'All', label: 'All Accounts' }, ...accountFilterOptions]}
          className="w-56 shrink-0"
        />
        <FilterSelect
          label="Stakeholder Type"
          hideLabel
          value={stakeholderTypeFilter}
          onChange={(v) => { setStakeholderTypeFilter(v); setPage(1); }}
          options={[
            { value: 'All', label: 'All Stakeholders' },
            { value: 'CLIENT', label: 'Client Stakeholders' },
            { value: 'SERVICE_PROVIDER', label: 'Service Provider Stakeholders' },
          ]}
          className="w-56 shrink-0"
        />
      </FilterBar>

      {/* Stakeholders spreadsheet grid */}
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable storageKey="stakeholders">
            <TableHead>
              <TableHeadCell><SortableHeader label="Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Client Account" field="accountId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Type" field="stakeholderType" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Department" field="department" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Designation" field="designation" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell align="center"><SortableHeader label="Influence" field="influence" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" /></TableHeadCell>
              <TableHeadCell align="center"><SortableHeader label="Relationship" field="relationship" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Email" field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Phone" field="phone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {sortedStks.length === 0 ? (
                <EmptyRow colSpan={10} message="No stakeholders registered yet in the registry." />
              ) : (
                pagedStks.map(s => {
                  const account = resolveAccount(s.accountId);
                  return (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-extrabold text-slate-900">{s.name}</TableCell>
                      <TableCell className="text-slate-600 font-bold">{account?.name || s.accountName || 'Unknown'}</TableCell>
                      <TableCell>
                        <StatusBadge value={STAKEHOLDER_TYPE_LABELS[s.stakeholderType]} colorMap={STAKEHOLDER_TYPE_COLORS} shape="rounded" />
                      </TableCell>
                      <TableCell className="text-slate-500 font-semibold">{s.department || '—'}</TableCell>
                      <TableCell className="text-slate-500 font-semibold">{s.designation}</TableCell>
                      <TableCell align="center">
                        {s.stakeholderType === 'SERVICE_PROVIDER'
                          ? <span className="text-slate-300">—</span>
                          : <StatusBadge value={s.influence} colorMap={INFLUENCE_COLORS} shape="rounded" />}
                      </TableCell>
                      <TableCell align="center">
                        {s.stakeholderType === 'SERVICE_PROVIDER'
                          ? <span className="text-slate-300">—</span>
                          : <StatusBadge value={s.relationship} colorMap={RELATIONSHIP_COLORS} />}
                      </TableCell>
                      <TableCell className="select-all text-slate-500 hover:text-blue-500 transition-colors">
                        <a href={`mailto:${s.email}`} className="flex items-center space-x-1 font-semibold">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[150px]">{s.email}</span>
                        </a>
                      </TableCell>
                      <TableCell className="font-mono select-all text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>{s.phone}</span>
                        </span>
                      </TableCell>
                      <TableCell align="center" sticky="right">
                        <TableActions
                          entityLabel={`stakeholder ${s.name}`}
                          onEdit={() => setEditTarget(s)}
                          onDelete={() => setDeleteTarget({ id: s.id, label: s.name })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={sortedStks.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="stakeholders"
        />
      </Card>

      {/* Add stakeholder modal */}
      <StakeholderFormModal
        isOpen={isModalOpen}
        mode="create"
        accounts={accounts}
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
              <TableHeadCell align="center">Influence</TableHeadCell>
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
