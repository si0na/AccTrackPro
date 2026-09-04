/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCRM } from '@/contexts/CRMContext';
import { usersApi } from '@/api/crm.api';
import { Account, AccountType, AccountHealth, User, Stakeholder } from '@/types';
import { Plus, Building2, Settings2, HeartPulse, X } from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { AccountFormModal } from '@/features/accounts/components/AccountFormModal';
import { compareForSort, getCustomerSinceYearOptions, mapLocationToOption, matchesGlobalAccount, serviceProviderOptionLabel, SortDirection } from '@/utils';
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_HEALTH_OPTIONS, LOCATION_OPTIONS, TOWER_OPTIONS } from '@/constants';
import {
  ACCOUNT_TYPE_COLORS,
  InlineTextEditCell,
  InlineSelectEditCell,
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  HEALTH_COLORS,
  INPUT_CLS,
  PageHeader,
  Pagination,
  RestoreButton,
  RestoreDialog,
  SearchableSelect,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  StatusBadge,
  Table,
  TableActions,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  InlineCreateField,
} from '@/components/ui';

export const AccountsListView: React.FC = () => {
  const {
    accounts,
    deactivatedAccounts,
    opportunities,
    stakeholders,
    addAccount,
    addStakeholder,
    deleteAccount,
    restoreAccount,
    setView,
    setSelectedAccountId,
    accountColumns,
    accountsColumnConfig,
    updateAccount,
    addCustomColumn,
    cameFromDashboard,
    navSource,
    selectedHealth,
    setSelectedHealth,
    globalAccountId,
    currentUser,
    loading,
    can,
    refreshData,
    serviceProviders,
  } = useCRM();

  // Users list — backs the four role-filtered "owner" dropdowns on the create
  // form (loaded once on mount, same pattern as ProjectDetailsView).
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, []);

  const { practiceLeads, clientPartners, verticalHeads } = useCRM();

  // Role-filtered option lists ({ value: id, label: name }) for each FK field.
  const practiceLeadOptions = useMemo(
    () => (practiceLeads || []).map(u => ({ value: u.id, label: serviceProviderOptionLabel(u) })),
    [practiceLeads],
  );
  const clientPartnerOptions = useMemo(
    () => (clientPartners || []).map(u => ({ value: u.id, label: serviceProviderOptionLabel(u) })),
    [clientPartners],
  );
  const verticalHeadOptions = useMemo(
    () => (verticalHeads || []).map(u => ({ value: u.id, label: serviceProviderOptionLabel(u) })),
    [verticalHeads],
  );

  // Restore failure message (network/server errors must not fail silently)
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Restore confirmation state
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; label: string } | null>(null);

  const handleRestoreAccount = async (id: string) => {
    setRestoreError(null);
    try {
      await restoreAccount(id);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setRestoreError(
        typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : 'Failed to restore the account.'),
      );
    }
  };

  // Module-specific filter states (operational — never fiscal-period-based)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');

  // Client-side pagination over the already-filtered rows (display only)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // The Global Account Selector represents a workspace switch — clear
  // page-specific state so the newly selected account starts from a clean view.
  useEffect(() => {
    setSearchQuery('');
    setPage(1);
  }, [globalAccountId]);

  // Column sort state — defaults to name asc, toggles direction on repeat clicks
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };

  // Sidebar Open State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Modal State for adding new Account.
  // Type and health start unselected — the user must make an explicit choice
  // rather than silently inheriting a default classification.
  const EMPTY_ACCOUNT: Omit<Account, 'id'> = {
    name: '',
    type: '' as AccountType,
    health: '' as AccountHealth,
    owner: '',
    revenue: 0, // auto-calculated from opportunity values — not user-entered
    industry: '',
    since: '',
    website: '',
    phone: '',
    email: '',
    address: '',
    location: '',
    description: '',
    accountManagerId: '',
    practiceLeadId: '',
    clientPartnerId: '',
    verticalHeadId: '',
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<Omit<Account, 'id'>>(EMPTY_ACCOUNT);

  // Multi-stakeholder selection states for account creation
  const [selectedClientStakeholderIds, setSelectedClientStakeholderIds] = useState<string[]>([]);
  const [selectedSpUserIds, setSelectedSpUserIds] = useState<string[]>([]);
  const [showAddClientModal, setShowAddClientModal] = useState<boolean>(false);

  // Dropdown options derived from live data (deduped, sorted).
  const industryOptions = Array.from(new Set(accounts.map(a => a.industry?.trim()).filter(Boolean))).sort();
  const locationOptions = Array.from(new Set(accounts.map(a => a.location?.trim()).filter(Boolean))).sort();

  // Accounts are never fiscal-period-filtered — the list always shows every
  // account (subject to owner scoping server-side and the UI filters below).
  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          acc.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (acc.location ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGlobalScope = matchesGlobalAccount(acc.id, globalAccountId);
    const matchesType     = selectedType   === 'All' || acc.type   === selectedType;
    const matchesHealth   = selectedHealth === 'All' || acc.health === selectedHealth;
    const matchesIndustry = selectedIndustry === 'All' || acc.industry?.trim() === selectedIndustry;
    const matchesLocation = selectedLocation === 'All' || acc.location?.trim() === selectedLocation;
    return matchesSearch && matchesGlobalScope && matchesType && matchesHealth && matchesIndustry && matchesLocation;
  });

  const sortedAccounts = [...filteredAccounts].sort((a, b) =>
    compareForSort((a as any)[sortField], (b as any)[sortField], sortDirection),
  );

  // Clamp the page so filter changes never leave the user on an empty page.
  const totalPages = Math.max(1, Math.ceil(sortedAccounts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedAccounts = sortedAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Submit Modal
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name.trim() || !newAccount.type || !newAccount.health) return;
    try {
      // Account Manager is never sent from creation — the backend assigns the
      // logged-in creator (when they are an Account Manager).
      const { accountManagerId: _omitAm, ...rest } = newAccount;
      const payload: Omit<Account, 'id'> & Record<string, any> = {
        ...rest,
        practiceLeadId: newAccount.practiceLeadId || null,
        clientPartnerId: newAccount.clientPartnerId || null,
        verticalHeadId: newAccount.verticalHeadId || null,
        clientStakeholderIds: selectedClientStakeholderIds.length ? selectedClientStakeholderIds : null,
        serviceProviderUserIds: selectedSpUserIds.length ? selectedSpUserIds : null,
      };
      const created = await addAccount(payload);
      setIsAddModalOpen(false);
      setNewAccount(EMPTY_ACCOUNT);
      setSelectedClientStakeholderIds([]);
      setSelectedSpUserIds([]);

      // Jump straight to details
      setSelectedAccountId(created.id);
      setView('account-details');
    } catch {
      // Failure toast raised centrally by the API client; keep the modal open
      // so the user can correct the form and retry.
    }
  };

  const handleRowClick = (id: string) => {
    setSelectedAccountId(id);
    setView('account-details');
  };

  const displayedConfigs = accountsColumnConfig.filter(col => col.isDisplayed);
  // User-added (non-standard) columns widen the table past the viewport and
  // trigger horizontal scroll; the default column set always fits the screen.
  const extraColumnCount = displayedConfigs.filter(col => !col.isStandard).length;

  if (loading) return <LoadingState label="Loading accounts…" />;

  return (
    <div className="space-y-6 relative">
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />

          {selectedHealth !== 'All' && (
            <div className="inline-flex items-center gap-3 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-1.5 rounded-lg text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                <span>Account health:</span>
                <span className="font-extrabold text-indigo-700">{selectedHealth}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHealth('All')}
                className="flex items-center gap-1 text-indigo-500 hover:text-indigo-800 font-bold transition-colors cursor-pointer ml-1 border-l border-indigo-200 pl-3"
                title="Show all health statuses"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>
      )}

      {navSource && (
        <BackButton
          label={navSource === 'notifications' ? 'Back to Notifications' : 'Back to Audit Log'}
          onClick={() => setView(navSource === 'notifications' ? 'notifications' : 'audit-log')}
        />
      )}

      {/* Page Title & Add New Button */}
      <PageHeader
        title="Accounts Portfolio"
        subtitle="Manage and review the corporate relationship status, metrics, and allocations."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={<Settings2 className="w-4.5 h-4.5 text-slate-500" aria-hidden="true" />}
              onClick={() => setIsSidebarOpen(true)}
            >
              Customize Columns
            </Button>
            {can('accounts', 'create') && (
              <Button
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedClientStakeholderIds([]);
                  setSelectedSpUserIds([]);
                  setIsAddModalOpen(true);
                }}
              >
                New Account
              </Button>
            )}
          </>
        }
      />

      {/* Customizable Column Sidebar */}
      <CustomizeColumnsSidebar
        module="accounts"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Control Panel: Search & Module-Specific Filters */}
      <FilterBar className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-center">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search accounts..."
          className="lg:col-span-2 w-full"
        />

        <FilterSelect
          label="Industry"
          hideLabel
          value={selectedIndustry}
          onChange={setSelectedIndustry}
          options={[
            { value: 'All', label: 'All Industries' },
            ...industryOptions.map(ind => ({ value: ind as string, label: ind as string })),
          ]}
        />

        <FilterSelect
          label="Health"
          hideLabel
          value={selectedHealth}
          onChange={setSelectedHealth}
          options={[
            { value: 'All', label: 'All Health' },
            ...ACCOUNT_HEALTH_OPTIONS.map(h => ({ value: h as string, label: h as string })),
          ]}
        />

        <FilterSelect
          label="Type"
          hideLabel
          value={selectedType}
          onChange={setSelectedType}
          options={[
            { value: 'All', label: 'All Types' },
            ...ACCOUNT_TYPE_OPTIONS.map(t => ({ value: t as string, label: t as string })),
          ]}
        />

        <FilterSelect
          label="Location"
          hideLabel
          value={selectedLocation}
          onChange={setSelectedLocation}
          options={[
            { value: 'All', label: 'All Locations' },
            ...locationOptions.map(loc => ({ value: loc as string, label: loc as string })),
          ]}
        />
      </FilterBar>

      {/* Accounts Excel-style List Table */}
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table extraColumns={extraColumnCount} resizable storageKey="accounts">
            <TableHead>
              {displayedConfigs.filter(col => col.key !== 'owner').map(col => (
                <TableHeadCell
                  key={col.key}
                  columnId={col.key}
                  align={col.key === 'revenue' ? 'right' : 'left'}
                >
                  <SortableHeader
                    label={col.name}
                    field={col.key}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    className={col.key === 'revenue' ? 'justify-end w-full' : ''}
                  />
                </TableHeadCell>
              ))}
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <EmptyRow
                  colSpan={displayedConfigs.length + 1}
                  message="No corporate accounts found matching the criteria."
                />
              ) : (
                pagedAccounts.map((acc) => {
                  const canUpdate = can('accounts', 'update');
                  return (
                    <TableRow key={acc.id}>
                      {displayedConfigs.filter(col => col.key !== 'owner').map(col => {
                        if (col.key === 'name') {
                          return (
                            <TableCell key={col.key} onClick={() => handleRowClick(acc.id)} className="cursor-pointer">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                  {acc.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors">
                                    {acc.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-normal">{acc.industry}</p>
                                </div>
                              </div>
                            </TableCell>
                          );
                        }
                        if (col.key === 'status') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineSelectEditCell
                                value={acc.status || 'Active'}
                                options={['Active', 'Inactive', 'Prospect']}
                                disabled={!canUpdate}
                                onSave={async (val) => { await updateAccount({ ...acc, status: val as any }); }}
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'health') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineSelectEditCell
                                value={acc.health}
                                options={ACCOUNT_HEALTH_OPTIONS}
                                disabled={!canUpdate}
                                onSave={async (val) => { await updateAccount({ ...acc, health: val as any }); }}
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'owner') {
                          return (
                            <TableCell key={col.key} className="text-slate-600 font-medium">
                              {acc.owner}
                            </TableCell>
                          );
                        }
                        if (col.key === 'type') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineSelectEditCell
                                value={acc.type}
                                options={ACCOUNT_TYPE_OPTIONS}
                                disabled={!canUpdate}
                                onSave={async (val) => { await updateAccount({ ...acc, type: val as any }); }}
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'industry') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineTextEditCell
                                value={acc.industry ?? ''}
                                disabled={!canUpdate}
                                onSave={async (val) => { await updateAccount({ ...acc, industry: val }); }}
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'since') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineSelectEditCell
                                value={acc.since || ''}
                                options={getCustomerSinceYearOptions()}
                                disabled={!canUpdate}
                                placeholder="Select year…"
                                onSave={async (val) => { await updateAccount({ ...acc, since: val }); }}
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'location') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineSelectEditCell
                                value={acc.location || ''}
                                options={LOCATION_OPTIONS}
                                disabled={!canUpdate}
                                placeholder="Select location…"
                                onSave={async (val) => { await updateAccount({ ...acc, location: val }); }}
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'revenue') {
                          return (
                            <TableCell key={col.key} align="right" onClick={(e) => e.stopPropagation()}>
                              <InlineTextEditCell
                                type="number"
                                value={acc.revenue}
                                disabled={!canUpdate}
                                formatDisplay={(val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)}
                                onSave={async (val) => { await updateAccount({ ...acc, revenue: val ?? 0 }); }}
                              />
                            </TableCell>
                          );
                        }

                        if (col.key === 'tower') {
                          return (
                            <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                              <InlineSelectEditCell
                                value={acc.tower || ''}
                                options={TOWER_OPTIONS}
                                disabled={!canUpdate}
                                placeholder="Select tower…"
                                onSave={async (val) => { await updateAccount({ ...acc, tower: val }); }}
                              />
                            </TableCell>
                          );
                        }

                      // Dynamic Render for custom columns/fields
                      const rawVal = acc[col.key] ?? (col.type === 'boolean' ? false : '');
                      return (
                        <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                          {col.type === 'boolean' ? (
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={!!rawVal}
                                onChange={(e) => {
                                  updateAccount({ ...acc, [col.key]: e.target.checked });
                                }}
                                aria-label={col.name}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                            </div>
                          ) : col.type === 'number' ? (
                            <input
                              type="number"
                              value={rawVal}
                              onChange={(e) => {
                                updateAccount({ ...acc, [col.key]: e.target.value === '' ? '' : Number(e.target.value) });
                              }}
                              placeholder="-"
                              aria-label={col.name}
                              className="w-24 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded px-2 py-1 text-slate-800 font-medium transition-all"
                            />
                          ) : col.type === 'date' ? (
                            <input
                              type="date"
                              value={rawVal}
                              onChange={(e) => {
                                updateAccount({ ...acc, [col.key]: e.target.value });
                              }}
                              aria-label={col.name}
                              className="text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded px-2 py-1 text-slate-800 font-medium transition-all font-mono"
                            />
                          ) : (col.type as string) === 'enum' || (col as any).options ? (
                            <select
                              value={rawVal}
                              onChange={(e) => {
                                updateAccount({ ...acc, [col.key]: e.target.value });
                              }}
                              aria-label={col.name}
                              className="text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded px-2 py-1 text-slate-800 font-medium transition-all cursor-pointer"
                            >
                              <option value="" disabled>Select…</option>
                              {((col as any).options || TOWER_OPTIONS).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={rawVal}
                              onChange={(e) => {
                                updateAccount({ ...acc, [col.key]: e.target.value });
                              }}
                              placeholder="Click to enter..."
                              aria-label={col.name}
                              className="w-32 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded px-2 py-1 text-slate-800 font-medium transition-all"
                            />
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Action Panel */}
                    <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                      <TableActions
                        entityLabel={`account ${acc.name}`}
                        onView={() => handleRowClick(acc.id)}
                        onEdit={can('accounts', 'update')
                          ? () => {
                              setEditingAccount({
                                ...acc,
                                location: mapLocationToOption(acc.location),
                              });
                              setIsEditModalOpen(true);
                            }
                          : undefined}
                        onDelete={can('accounts', 'delete')
                          ? () => setDeleteTarget({ id: acc.id, label: acc.name })
                          : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </tbody>
          </Table>
        </div>

        {/* Pagination footer — client-side slicing of the filtered rows */}
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filteredAccounts.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="entries"
        />
      </Card>

      {/* Deactivated Accounts Section */}
      {deactivatedAccounts.length > 0 && (
        <DeactivatedSection title="Deactivated Accounts" count={deactivatedAccounts.length}>
          {restoreError && (
            <ErrorBanner
              message={restoreError}
              onDismiss={() => setRestoreError(null)}
              className="mx-5 my-3"
            />
          )}
          <Table>
            <TableHead>
              <TableHeadCell>Account Name</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Health</TableHeadCell>
              <TableHeadCell>Owner</TableHeadCell>
              <TableHeadCell align="center">Restore</TableHeadCell>
            </TableHead>
            <tbody>
              {deactivatedAccounts.map((acc) => (
                <TableRow key={acc.id} className="opacity-70">
                  <TableCell>
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[11px]">
                        {acc.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-slate-600 line-through decoration-slate-300">{acc.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{acc.type}</TableCell>
                  <TableCell>
                    <StatusBadge value={acc.health} colorMap={HEALTH_COLORS} shape="rounded" muted />
                  </TableCell>
                  <TableCell>{acc.owner}</TableCell>
                  <TableCell align="center">
                    {can('accounts', 'update') && (
                      <RestoreButton
                        label={`Restore account ${acc.name}`}
                        onClick={() => setRestoreTarget({ id: acc.id, label: acc.name })}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </DeactivatedSection>
      )}

      {/* Restore Confirmation */}
      <RestoreDialog
        isOpen={!!restoreTarget}
        title="Restore Account"
        message={restoreTarget ? <>Restore account <span className="font-bold">"{restoreTarget.label}"</span>? It will reappear in the active portfolio.</> : undefined}
        onConfirm={async () => {
          if (restoreTarget) {
            await handleRestoreAccount(restoreTarget.id);
            setRestoreTarget(null);
          }
        }}
        onCancel={() => setRestoreTarget(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Account"
        message={deleteTarget ? <>Deactivate account <span className="font-bold">"{deleteTarget.label}"</span>? It will move to the Deactivated Accounts section.</> : undefined}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteAccount(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Edit Account Modal */}
      <AccountFormModal
        isOpen={isEditModalOpen && !!editingAccount}
        mode="edit"
        account={editingAccount}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={async (draft) => {
          if (editingAccount) {
            await updateAccount({ ...editingAccount, ...draft } as Account);
            setIsEditModalOpen(false);
            setEditingAccount(null);
          }
        }}
      />

      {/* Create Account Modal */}
      <AccountFormModal
        isOpen={isAddModalOpen}
        mode="create"
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (draft) => {
          const created = await addAccount(draft as Omit<Account, 'id'>);
          setIsAddModalOpen(false);
          setSelectedAccountId(created.id);
          setView('account-details');
        }}
      />
    </div>
  );
};
