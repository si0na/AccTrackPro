/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Account, AccountType, AccountHealth } from '@/types';
import { Plus, Building2, Settings2 } from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { compareForSort, SortDirection } from '@/utils';
import {
  ACCOUNT_TYPE_COLORS,
  BackButton,
  Button,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  FormField,
  FormGrid,
  FormModal,
  HEALTH_COLORS,
  INPUT_CLS,
  PageHeader,
  Pagination,
  RestoreButton,
  RestoreDialog,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  StatusBadge,
  TableActions,
} from '@/components/ui';

export const AccountsListView: React.FC = () => {
  const {
    accounts,
    deactivatedAccounts,
    opportunities,
    addAccount,
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
    currentUser,
    loading,
  } = useCRM();

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
  const [selectedHealth, setSelectedHealth] = useState<string>('All');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');

  // Client-side pagination over the already-filtered rows (display only)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    description: ''
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<Omit<Account, 'id'>>(EMPTY_ACCOUNT);

  // Dropdown options derived from live data (deduped, sorted).
  const industryOptions = Array.from(new Set(accounts.map(a => a.industry?.trim()).filter(Boolean))).sort();

  // Accounts are never fiscal-period-filtered — the list always shows every
  // account (subject to owner scoping server-side and the UI filters below).
  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          acc.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType     = selectedType   === 'All' || acc.type   === selectedType;
    const matchesHealth   = selectedHealth === 'All' || acc.health === selectedHealth;
    const matchesIndustry = selectedIndustry === 'All' || acc.industry?.trim() === selectedIndustry;
    return matchesSearch && matchesType && matchesHealth && matchesIndustry;
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
      const created = await addAccount(newAccount);
      setIsAddModalOpen(false);
      setNewAccount(EMPTY_ACCOUNT);
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

  if (loading) return <LoadingState label="Loading accounts…" />;

  return (
    <div className="space-y-6 relative">
      {cameFromDashboard && (
        <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />
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
            <Button
              size="md"
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              New Account
            </Button>
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
      <FilterBar className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
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
            { value: 'Healthy', label: 'Healthy' },
            { value: 'At Risk', label: 'At Risk' },
            { value: 'Critical', label: 'Critical' },
          ]}
        />

        <FilterSelect
          label="Type"
          hideLabel
          value={selectedType}
          onChange={setSelectedType}
          options={[
            { value: 'All', label: 'All Types' },
            { value: 'Growth', label: 'Growth' },
            { value: 'Pursuit', label: 'Pursuit' },
            { value: 'Project', label: 'Project' },
          ]}
        />
      </FilterBar>

      {/* Accounts Excel-style List Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 select-none text-slate-500 font-bold text-xs uppercase tracking-wider">
                {displayedConfigs.filter(col => col.key !== 'owner').map(col => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 font-bold text-xs uppercase tracking-wider ${
                      col.key === 'name' ? 'px-5' : ''
                    } ${
                      col.key === 'revenue' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <SortableHeader
                      label={col.name}
                      field={col.key}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      className={col.key === 'revenue' ? 'justify-end w-full' : ''}
                    />
                  </th>
                ))}
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <EmptyRow
                  colSpan={displayedConfigs.length + 1}
                  message="No corporate accounts found matching the criteria."
                />
              ) : (
                pagedAccounts.map((acc) => (
                  <tr
                    key={acc.id}
                    onClick={() => handleRowClick(acc.id)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 cursor-pointer text-xs font-medium text-slate-800 transition-colors"
                  >
                    {displayedConfigs.filter(col => col.key !== 'owner').map(col => {
                      if (col.key === 'name') {
                        return (
                          <td key={col.key} className="py-4 px-5">
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
                          </td>
                        );
                      }
                      if (col.key === 'status') {
                        return (
                          <td key={col.key} className="py-4 px-4 text-slate-600 font-semibold">
                            {acc.status || 'Active'}
                          </td>
                        );
                      }
                      if (col.key === 'health') {
                        return (
                          <td key={col.key} className="py-4 px-4">
                            <StatusBadge value={acc.health} colorMap={HEALTH_COLORS} />
                          </td>
                        );
                      }
                      if (col.key === 'owner') {
                        return (
                          <td key={col.key} className="py-4 px-4 text-slate-600 font-medium">
                            {acc.owner}
                          </td>
                        );
                      }
                      if (col.key === 'type') {
                        return (
                          <td key={col.key} className="py-4 px-4">
                            <StatusBadge value={acc.type} colorMap={ACCOUNT_TYPE_COLORS} />
                          </td>
                        );
                      }
                      if (col.key === 'industry') {
                        return (
                          <td key={col.key} className="py-4 px-4 text-slate-600 font-medium">
                            {acc.industry || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      }
                      if (col.key === 'since') {
                        return (
                          <td key={col.key} className="py-4 px-4 text-slate-600 font-medium">
                            {acc.since || <span className="text-slate-300">—</span>}
                          </td>
                        );
                      }
                      if (col.key === 'revenue') {
                        return (
                          <td key={col.key} className="py-4 px-4 text-right text-slate-900 font-bold font-mono">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(acc.revenue)}
                          </td>
                        );
                      }

                      // Dynamic Render for custom columns/fields
                      const rawVal = acc[col.key] ?? (col.type === 'boolean' ? false : '');
                      return (
                        <td key={col.key} className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
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
                        </td>
                      );
                    })}

                    {/* Action Panel */}
                    <td className="py-4 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                      <TableActions
                        entityLabel={`account ${acc.name}`}
                        onView={() => handleRowClick(acc.id)}
                        onEdit={() => { setEditingAccount({ ...acc }); setIsEditModalOpen(true); }}
                        onDelete={() => setDeleteTarget({ id: acc.id, label: acc.name })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
      </div>

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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-5">Account Name</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Health</th>
                <th className="py-2.5 px-4">Owner</th>
                <th className="py-2.5 px-5 text-center">Restore</th>
              </tr>
            </thead>
            <tbody>
              {deactivatedAccounts.map((acc) => (
                <tr key={acc.id} className="border-b last:border-0 text-slate-500 font-medium opacity-70">
                  <td className="py-3 px-5">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[11px]">
                        {acc.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-slate-600 line-through decoration-slate-300">{acc.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">{acc.type}</td>
                  <td className="py-3 px-4">
                    <StatusBadge value={acc.health} colorMap={HEALTH_COLORS} shape="rounded" muted />
                  </td>
                  <td className="py-3 px-4">{acc.owner}</td>
                  <td className="py-3 px-5 text-center">
                    <RestoreButton
                      label={`Restore account ${acc.name}`}
                      onClick={() => setRestoreTarget({ id: acc.id, label: acc.name })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {isEditModalOpen && editingAccount && (
        <InlineEditModal
          mode="accounts"
          entity={editingAccount}
          displayedConfigs={displayedConfigs}
          accounts={accounts}
          opportunities={opportunities}
          onChange={(patch) => setEditingAccount({ ...editingAccount, ...patch })}
          onSave={async (e) => {
            e.preventDefault();
            await updateAccount(editingAccount);
            setIsEditModalOpen(false);
            setEditingAccount(null);
          }}
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingAccount(null);
          }}
        />
      )}

      {/* Create Account Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        title="Create Account Profile"
        icon={<Building2 className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateAccount}
        submitLabel="Create Account"
        maxWidth="max-w-2xl"
      >
        <FormGrid>
          <FormField label="Account Name" required wide>
            <input
              type="text"
              required
              value={newAccount.name}
              onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              placeholder="e.g., Tesla Inc."
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Account Type" required>
            <select
              required
              value={newAccount.type}
              onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}
              className={SELECT_CLS}
            >
              <option value="" disabled>Select type…</option>
              <option value="Growth">Growth</option>
              <option value="Pursuit">Pursuit</option>
              <option value="Project">Project</option>
            </select>
          </FormField>

          <FormField label="Health Status" required>
            <select
              required
              value={newAccount.health}
              onChange={(e) => setNewAccount({ ...newAccount, health: e.target.value as AccountHealth })}
              className={SELECT_CLS}
            >
              <option value="" disabled>Select health…</option>
              <option value="Healthy">Healthy</option>
              <option value="At Risk">At Risk</option>
              <option value="Critical">Critical</option>
            </select>
          </FormField>

          <FormField label="Industry (Optional)" wide>
            <input
              type="text"
              value={newAccount.industry}
              onChange={(e) => setNewAccount({ ...newAccount, industry: e.target.value })}
              placeholder="e.g., Technology"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Customer Since (Optional)" wide>
            <input
              type="text"
              value={newAccount.since || ''}
              onChange={(e) => setNewAccount({ ...newAccount, since: e.target.value })}
              placeholder="e.g., 2020"
              className={INPUT_CLS}
            />
          </FormField>
        </FormGrid>
      </FormModal>
    </div>
  );
};
