/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Account, Stakeholder, StakeholderType, ServiceProviderUser } from '@/types';
import { Building2, Wrench, Mail } from 'lucide-react';
import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';
import { StakeholderTable } from './StakeholderTable';
import {
  Card,
  EmptyRow,
  FilterBar,
  Pagination,
  SearchBar,
  SortableHeader,
  StatusBadge,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { compareForSort, serviceProviderStatus, SortDirection } from '@/utils';

export interface StakeholderTabsProps {
  /** Client (stakeholderType === 'CLIENT') rows to display in the Client tab. */
  clientRows: Stakeholder[];
  /**
   * NEW: System Users shown in the Service Providers tab.
   * All System Users are Service Providers regardless of is_active status.
   */
  serviceProviders?: ServiceProviderUser[];
  /**
   * LEGACY: Kept for components that pass old stakeholder rows directly.
   * When serviceProviders is provided it takes precedence for the SP tab display.
   */
  serviceProviderRows?: Stakeholder[];
  resolveAccount: (id: string) => Account | undefined;
  /** Hide the Add button on the Service Providers tab */
  hideSpAdd?: boolean;
  /** Hide the Account column (single-account / single-opportunity scopes). */
  hideAccountColumn?: boolean;
  /** Distinguishes storage keys + empty-state copy per usage. */
  storageKeyPrefix: string;
  /** Optional header title rendered to the left of the Add button. */
  title?: string;

  // Permissions — gate the Add button and per-row Edit/Delete actions.
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;

  // Handlers — omit any to disable that action. `onAdd` receives the active
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
 * Providers.
 *
 * The Service Providers tab shows the whole Service Provider directory —
 * registered System Users *and* whitelisted employees still pending
 * self-registration — in a sortable, searchable, paginated table, identical in
 * format to the Client Stakeholders table.
 * Columns: Name, Department, Designation, Email, Status.
 */
export const StakeholderTabs: React.FC<StakeholderTabsProps> = ({
  clientRows,
  serviceProviders,
  serviceProviderRows,
  resolveAccount,
  hideSpAdd = false,
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

  const showAdd = canCreate && !!onAdd && (activeTab === 'CLIENT' || (!hideSpAdd && activeTab === 'SERVICE_PROVIDER'));

  // SP tab: prefer system users list, fall back to legacy stakeholder rows
  const hasSystemUsers = serviceProviders !== undefined;
  const spCount = serviceProviderCount ?? (hasSystemUsers ? (serviceProviders?.length ?? 0) : (serviceProviderRows?.length ?? 0));

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
      count: spCount,
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
              {activeTab === 'CLIENT' ? 'Add Client Stakeholder' : 'Add Service Provider'}
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
        /* Service Providers tab */
        hasSystemUsers ? (
          <SystemUserServiceProviderTable
            users={serviceProviders ?? []}
            emptyMessage={serviceProviderEmptyMessage}
            storageKey={`${storageKeyPrefix}-sp`}
          />
        ) : (
          /* Legacy fallback: render stakeholder rows if no system users provided */
          <StakeholderTable
            rows={serviceProviderRows ?? []}
            type="SERVICE_PROVIDER"
            resolveAccount={resolveAccount}
            hideAccountColumn={hideAccountColumn}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            onRowClick={onRowClick}
            storageKey={`${storageKeyPrefix}-sp`}
            emptyMessage={(serviceProviderRows?.length ?? 0) === 0
              ? serviceProviderEmptyMessage
              : 'No service providers match your search.'}
          />
        )
      )}
    </div>
  );
};

// ─── System User table for SP tab ─────────────────────────────────────────────

interface SystemUserServiceProviderTableProps {
  users: ServiceProviderUser[];
  emptyMessage: string;
  storageKey?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-slate-100 text-slate-500',
  'Pending Registration': 'bg-amber-100 text-amber-700',
};

/**
 * Sortable, searchable, paginated table for the Service Provider directory —
 * mirrors the StakeholderTable layout used for Client Stakeholders. Pending
 * registrations are listed alongside registered users and carry an amber
 * "Pending Registration" status; they have no name on record yet, so the Name
 * cell falls back to their whitelisted email.
 * Columns: Name | Department | Designation | Email | Status
 */
const SystemUserServiceProviderTable: React.FC<SystemUserServiceProviderTableProps> = ({
  users,
  emptyMessage,
  storageKey,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() =>
    users.filter(u => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.designation || '').toLowerCase().includes(q) ||
        // Searching "pending" surfaces everyone still to register.
        serviceProviderStatus(u).toLowerCase().includes(q)
      );
    }),
    [users, q],
  );

  const sorted = useMemo(() => {
    // The Status column sorts on the resolved label so the three states
    // (Active / Inactive / Pending Registration) group together.
    const value = (u: ServiceProviderUser) =>
      sortField === 'isActive' ? serviceProviderStatus(u) : ((u as any)[sortField] ?? '');
    return [...filtered].sort((a, b) => compareForSort(value(a), value(b), sortDirection));
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search service providers by name, email, department..."
          className="flex-1 min-w-[240px]"
        />
      </FilterBar>

      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable={!!storageKey} storageKey={storageKey}>
            <TableHead>
              <TableHeadCell>
                <SortableHeader label="Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell>
                <SortableHeader label="Department" field="department" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell>
                <SortableHeader label="Designation" field="designation" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell>
                <SortableHeader label="Email" field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell align="center">
                <SortableHeader label="Status" field="isActive" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" />
              </TableHeadCell>
            </TableHead>
            <tbody>
              {sorted.length === 0 ? (
                <EmptyRow
                  colSpan={5}
                  message={q ? 'No service providers match your search.' : emptyMessage}
                />
              ) : (
                paged.map(u => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-extrabold text-slate-900">
                      {u.name || (
                        <span className="text-slate-400 italic font-semibold">
                          {u.email || '(No name)'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 font-semibold">
                      {u.department || '—'}
                    </TableCell>
                    <TableCell className="text-slate-500 font-semibold">
                      {u.designation || '—'}
                    </TableCell>
                    <TableCell className="select-all text-slate-500 hover:text-blue-500 transition-colors">
                      {u.email ? (
                        <a href={`mailto:${u.email}`} className="flex items-center gap-1 font-semibold">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[180px]">{u.email}</span>
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <StatusBadge
                        value={serviceProviderStatus(u)}
                        colorMap={STATUS_COLORS}
                        shape="rounded"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="service providers"
        />
      </Card>
    </div>
  );
};
