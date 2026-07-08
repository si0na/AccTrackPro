/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Opportunity, OpportunityStage } from '@/types';
import { Plus, Eye, Trash2, TrendingUp, X, FileSpreadsheet, Settings2, Pencil } from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { OpportunityActionsCommentsPanel } from '@/features/opportunities/components/OpportunityActionsCommentsPanel';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { NumberInput } from '@/components/NumberInput';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { compareForSort, normalizeOwnerName, SortDirection } from '@/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
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
  INPUT_CLS,
  OPPORTUNITY_STATUS_COLORS,
  PageHeader,
  Pagination,
  RestoreButton,
  RestoreDialog,
  RowActionButton,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  STAGE_COLORS,
  StatusBadge,
} from '@/components/ui';

export const OpportunitiesView: React.FC = () => {
  const {
    opportunities,
    deactivatedOpportunities,
    accounts,
    addOpportunity,
    deleteOpportunity,
    restoreOpportunity,
    setView,
    setSelectedOpportunityId,
    opportunityColumns,
    opportunitiesColumnConfig,
    updateOpportunity,
    cameFromDashboard,
    navSource,
    selectedStage,
    setSelectedStage,
    dashboardOppStatusFilter,
    setDashboardOppStatusFilter,
    refreshData,
    currentUser,
    loading,
  } = useCRM();

  // Module-specific filter states (operational — never fiscal-period-based)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [closeDateFrom, setCloseDateFrom] = useState<string>('');
  const [closeDateTo, setCloseDateTo] = useState<string>('');
  const [minProbability, setMinProbability] = useState<string>('All');

  // Client-side pagination over the already-filtered rows
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column sort state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };
  const getSortValue = (opp: Opportunity, key: string) => {
    if (key === 'accountId') {
      const acc = accounts.find(a => a.id === opp.accountId);
      return acc ? acc.name : (opp.accountName ?? '');
    }
    return (opp as any)[key];
  };

  // Sidebar Open State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Restore validation error (e.g. parent account still deactivated)
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Restore confirmation state
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; label: string } | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  // Selected opportunity state for inline actions and comments
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  // Edit Opportunity Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);

  // Refresh from DB on mount
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditClick = (opp: Opportunity) => {
    setEditingOpp({ ...opp });
    setIsEditModalOpen(true);
  };

  const handleUpdateOpportunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp || !editingOpp.name.trim()) return;
    updateOpportunity(editingOpp);
    setIsEditModalOpen(false);
    setEditingOpp(null);
  };

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newOpp, setNewOpp] = useState<Omit<Opportunity, 'id'>>({
    name: '',
    accountId: '',
    stage: 'Lead',
    status: 'Open',
    value: 0,
    crmValue: 0,
    probability: 0,
    owner: '',
    closeDate: '',
    description: '',
    startDate: '',
    endDate: '',
    nextStep: '',
    tags: [],
    team: []
  });

  // Dedupe case-insensitively so legacy variants ("john"/"JOHN") yield one entry.
  const ownersList = Array.from(
    new Map(
      opportunities
        .filter(o => o.owner?.trim())
        .map(o => [o.owner.trim().toLowerCase(), normalizeOwnerName(o.owner)]),
    ).values(),
  );

  // Operational list — module-specific filters only, never fiscal-period-based.
  const filteredOpps = opportunities.filter(o => {
    const account = accounts.find(a => a.id === o.accountId);
    const matchesSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (account?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage   = selectedStage === 'All' || o.stage === selectedStage;
    const matchesOwner   = selectedOwner === 'All' || o.owner.trim().toLowerCase() === selectedOwner.toLowerCase();
    const matchesAccount = selectedAccountFilter === 'All' || o.accountId === selectedAccountFilter;
    const matchesStatus  = selectedStatus === 'All' || (o.status ?? 'Open') === selectedStatus;
    const matchesDashboardStatus = dashboardOppStatusFilter === 'All' || (o.status ?? 'Open') === dashboardOppStatusFilter;
    const matchesCloseFrom = !closeDateFrom || (o.closeDate && o.closeDate >= closeDateFrom);
    const matchesCloseTo   = !closeDateTo   || (o.closeDate && o.closeDate <= closeDateTo);
    const matchesProbability = minProbability === 'All' || o.probability >= parseInt(minProbability, 10);
    return matchesSearch && matchesStage && matchesOwner && matchesAccount &&
           matchesStatus && matchesDashboardStatus && matchesCloseFrom && matchesCloseTo && matchesProbability;
  });

  const sortedOpps = [...filteredOpps].sort((a, b) =>
    compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
  );

  // Clamp page so filter changes never leave the user on an empty page.
  const totalPages = Math.max(1, Math.ceil(sortedOpps.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOpps = sortedOpps.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Submit modal
  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpp.name.trim() || !newOpp.accountId) return;
    // Fiscal period is derived server-side from the close date.
    const created = await addOpportunity(newOpp);
    setIsAddModalOpen(false);
    // Reset form
    setNewOpp({
      name: '',
      accountId: '',
      stage: 'Lead',
      value: 0,
      crmValue: 0,
      probability: 0,
      owner: '',
      closeDate: '',
      description: '',
      startDate: '',
      endDate: '',
      nextStep: '',
      tags: [],
      team: []
    });
    // Jump straight to details
    setSelectedOpportunityId(created.id);
    setView('opportunity-details');
  };

  const handleRowClick = (id: string) => {
    setSelectedOpportunityId(id);
    setView('opportunity-details');
  };

  const handleRestoreOpportunity = async (id: string) => {
    setRestoreError(null);
    try {
      await restoreOpportunity(id);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setRestoreError(
        typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : 'Failed to restore the opportunity.'),
      );
    }
  };

  const displayedConfigs = opportunitiesColumnConfig.filter(col => col.isDisplayed);

  if (loading) return <LoadingState label="Loading opportunities…" />;

  return (
    <div className="space-y-6">
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />

          {selectedStage !== 'All' && (
            <div className="inline-flex items-center gap-3 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-1.5 rounded-lg text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                <span>Pipeline stage:</span>
                <span className="font-extrabold text-indigo-700">{selectedStage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStage('All')}
                className="flex items-center gap-1 text-indigo-500 hover:text-indigo-800 font-bold transition-colors cursor-pointer ml-1 border-l border-indigo-200 pl-3"
                title="Show all stages"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </div>
          )}

          {dashboardOppStatusFilter !== 'All' && (
            <div className="inline-flex items-center gap-3 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-1.5 rounded-lg text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                <span>Showing:</span>
                <span className="font-extrabold text-indigo-700">{dashboardOppStatusFilter} Opportunities</span>
              </div>
              <button
                type="button"
                onClick={() => setDashboardOppStatusFilter('All')}
                className="flex items-center gap-1 text-indigo-500 hover:text-indigo-800 font-bold transition-colors cursor-pointer ml-1 border-l border-indigo-200 pl-3"
                title="Show all statuses"
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

      <PageHeader
        title="Deals & Opportunities"
        subtitle="Track negotiations, deal size, stages, and execution dates across your accounts. An opportunity stays visible here until it is closed (Won or Lost)."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              icon={<Settings2 className="w-4 h-4 text-slate-500" aria-hidden="true" />}
              onClick={() => setIsSidebarOpen(true)}
            >
              Customize Columns
            </Button>
            <Button
              size="md"
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              New Opportunity
            </Button>
          </>
        }
      />

      {/* Customizable Column Sidebar */}
      <CustomizeColumnsSidebar
        module="opportunities"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Control Panel: Search & Module-Specific Filters */}
      <FilterBar className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search opportunities or accounts..."
          className="w-full"
        />

        <FilterSelect
          label="Stage"
          hideLabel
          value={selectedStage}
          onChange={setSelectedStage}
          options={[
            { value: 'All', label: 'All Stages' },
            { value: 'Lead', label: 'Lead' },
            { value: 'Qualified', label: 'Qualified' },
            { value: 'Proposal', label: 'Proposal' },
            { value: 'Negotiation', label: 'Negotiation' },
            { value: 'Won', label: 'Won' },
          ]}
        />

        <FilterSelect
          label="Owner"
          hideLabel
          value={selectedOwner}
          onChange={setSelectedOwner}
          options={[
            { value: 'All', label: 'All Owners' },
            ...ownersList.map(owner => ({ value: owner, label: owner })),
          ]}
        />

        <FilterSelect
          label="Account"
          hideLabel
          value={selectedAccountFilter}
          onChange={setSelectedAccountFilter}
          options={[
            { value: 'All', label: 'All Accounts' },
            ...accounts.map(acc => ({ value: acc.id, label: acc.name })),
          ]}
        />

        <FilterSelect
          label="Status"
          hideLabel
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={[
            { value: 'All', label: 'All Statuses' },
            { value: 'Open', label: 'Open' },
            { value: 'Won', label: 'Won' },
            { value: 'Lost', label: 'Lost' },
          ]}
        />

        {/* Expected Close Date range */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Close from</label>
          <input
            type="date"
            value={closeDateFrom}
            onChange={(e) => setCloseDateFrom(e.target.value)}
            aria-label="Close date from"
            className={`${INPUT_CLS} font-mono`}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Close to</label>
          <input
            type="date"
            value={closeDateTo}
            onChange={(e) => setCloseDateTo(e.target.value)}
            aria-label="Close date to"
            className={`${INPUT_CLS} font-mono`}
          />
        </div>

        <FilterSelect
          label="Probability"
          hideLabel
          value={minProbability}
          onChange={setMinProbability}
          options={[
            { value: 'All', label: 'Any Probability' },
            { value: '25', label: 'Probability ≥ 25%' },
            { value: '50', label: 'Probability ≥ 50%' },
            { value: '75', label: 'Probability ≥ 75%' },
            { value: '90', label: 'Probability ≥ 90%' },
          ]}
        />
      </FilterBar>

      {/* Opportunities Grid Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 select-none text-slate-500 font-bold text-xs uppercase tracking-wider">
                {displayedConfigs.map(col => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 font-bold text-xs uppercase tracking-wider ${
                      col.key === 'name' ? 'px-5' : ''
                    } ${
                      col.key === 'value' ? 'text-right' : col.key === 'probability' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <SortableHeader
                      label={col.name}
                      field={col.key}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      className={
                        col.key === 'value' ? 'justify-end w-full' : col.key === 'probability' ? 'justify-center w-full' : ''
                      }
                    />
                  </th>
                ))}
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpps.length === 0 ? (
                <EmptyRow
                  colSpan={displayedConfigs.length + 1}
                  message="No opportunities found matching the selected search and criteria."
                />
              ) : (
                pagedOpps.map((opp) => {
                  const associatedAccount = accounts.find(a => a.id === opp.accountId);
                  return (
                    <tr
                      key={opp.id}
                      onClick={() => setSelectedOppId(opp.id)}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 cursor-pointer text-xs font-medium text-slate-800 transition-colors ${
                        selectedOppId === opp.id ? 'bg-blue-50/45 border-l-4 border-l-blue-600 font-semibold' : ''
                      }`}
                    >
                      {displayedConfigs.map(col => {
                        if (col.key === 'name') {
                          return (
                            <td key={col.key} className="py-4 px-5">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0">
                                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                                    {opp.name}
                                  </p>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'accountId') {
                          return (
                            <td key={col.key} className="py-4 px-4 text-slate-600 font-semibold">
                              {associatedAccount ? associatedAccount.name : (opp.accountName ?? 'Unknown Account')}
                            </td>
                          );
                        }
                        if (col.key === 'stage') {
                          return (
                            <td key={col.key} className="py-4 px-4">
                              <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />
                            </td>
                          );
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={col.key} className="py-4 px-4">
                              <StatusBadge value={opp.status ?? 'Open'} colorMap={OPPORTUNITY_STATUS_COLORS} />
                            </td>
                          );
                        }
                        if (col.key === 'value') {
                          return (
                            <td key={col.key} className="py-4 px-4 text-right text-slate-900 font-bold font-mono text-sm">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(opp.value)}
                            </td>
                          );
                        }
                        if (col.key === 'probability') {
                          return (
                            <td key={col.key} className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className={`h-full ${
                                      opp.probability >= 80 ? 'bg-green-500' :
                                      opp.probability >= 50 ? 'bg-blue-500' :
                                      'bg-yellow-500'
                                    }`}
                                    style={{ width: `${opp.probability}%` }}
                                    aria-label={`${opp.probability}%`}
                                  />
                                </div>
                                <span className="font-bold text-slate-700 font-mono text-[11px]">{opp.probability}%</span>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'owner') {
                          return (
                            <td key={col.key} className="py-4 px-4 text-slate-600 font-medium">
                              {opp.owner}
                            </td>
                          );
                        }
                        if (col.key === 'startDate') {
                          return (
                            <td key={col.key} className="py-4 px-4 text-slate-500 font-mono font-medium whitespace-nowrap">
                              {opp.startDate || 'N/A'}
                            </td>
                          );
                        }
                        if (col.key === 'closeDate') {
                          return (
                            <td key={col.key} className="py-4 px-4 text-slate-500 font-mono font-medium">
                              {opp.closeDate}
                            </td>
                          );
                        }

                        // Customizable dynamic custom columns
                        const rawVal = opp[col.key] ?? (col.type === 'boolean' ? false : '');
                        return (
                          <td key={col.key} className="py-4 px-4">
                            {col.type === 'boolean' ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rawVal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {rawVal ? 'Yes' : 'No'}
                              </span>
                            ) : col.type === 'number' ? (
                              <span className="font-mono font-semibold text-slate-700">{rawVal}</span>
                            ) : (
                              <span className="text-slate-600">{String(rawVal)}</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="py-4 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <RowActionButton
                            intent="view"
                            label={`View opportunity ${opp.name}`}
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => handleRowClick(opp.id)}
                          />
                          <RowActionButton
                            intent="edit"
                            label={`Edit opportunity ${opp.name}`}
                            icon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => handleEditClick(opp)}
                          />
                          <RowActionButton
                            intent="delete"
                            label={`Delete opportunity ${opp.name}`}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setDeleteTarget({ id: opp.id, label: opp.name })}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filteredOpps.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="opportunities"
        />
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Opportunity"
        message={deleteTarget ? <>Deactivate opportunity <span className="font-bold">"{deleteTarget.label}"</span>? It will move to the Deactivated section.</> : undefined}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteOpportunity(deleteTarget.id);
            if (selectedOppId === deleteTarget.id) setSelectedOppId(null);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Slide-over comments & actions sidebar overlapping the main page */}
      <AnimatePresence>
        {selectedOppId && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOppId(null)}
              className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs z-50 cursor-pointer"
            />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="fixed right-0 top-0 h-screen w-full sm:w-[650px] md:w-[750px] lg:w-[900px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden"
            >
              <OpportunityActionsCommentsPanel
                opportunityId={selectedOppId}
                onClose={() => setSelectedOppId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Opportunity Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        title="Create Corporate Opportunity"
        icon={<TrendingUp className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateOpportunity}
        submitLabel="Create Opportunity"
        maxWidth="max-w-lg"
      >
        <FormGrid>
          <FormField label="Target Corporate Account" required wide>
            <select
              required
              value={newOpp.accountId}
              onChange={(e) => setNewOpp({ ...newOpp, accountId: e.target.value })}
              className={SELECT_CLS}
            >
              <option value="" disabled>Select an account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Opportunity Name" required wide>
            <input
              type="text"
              required
              value={newOpp.name}
              onChange={(e) => setNewOpp({ ...newOpp, name: e.target.value })}
              placeholder="e.g., Salesforce Integration"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Deal Value ($)" required>
            <NumberInput
              required
              min={0}
              value={newOpp.value}
              onValueChange={(v) => setNewOpp({ ...newOpp, value: v, crmValue: Math.round(v * 0.9) })}
              placeholder="e.g. 50000"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Expected Close Date" required>
            <input
              type="date"
              required
              min={new Date().toLocaleDateString('en-CA')}
              value={newOpp.closeDate}
              onChange={(e) => setNewOpp({ ...newOpp, closeDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>

          <FormField label="Start Date">
            <input
              type="date"
              value={newOpp.startDate}
              onChange={(e) => setNewOpp({ ...newOpp, startDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>

          <FormField label="Initial Stage">
            <select
              value={newOpp.stage}
              onChange={(e) => {
                const stage = e.target.value as OpportunityStage;
                // Lifecycle sync: reaching Won closes the deal as Won.
                setNewOpp({ ...newOpp, stage, status: stage === 'Won' ? 'Won' : 'Open' });
              }}
              className={SELECT_CLS}
            >
              <option value="Lead">Lead</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal">Proposal</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Won">Won</option>
            </select>
          </FormField>

          <FormField label="Probability (%)">
            <NumberInput
              min={0}
              max={100}
              required
              value={newOpp.probability}
              onValueChange={(v) => setNewOpp({ ...newOpp, probability: v })}
              placeholder="0–100"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Owner" wide>
            <input
              type="text"
              value={newOpp.owner}
              onChange={(e) => setNewOpp({ ...newOpp, owner: e.target.value })}
              placeholder="e.g., John Smith"
              className={INPUT_CLS}
            />
          </FormField>

          {/* Win reason — required when the deal is created already Won */}
          {newOpp.stage === 'Won' && (
            <FormField label="Win Reason" required wide>
              <textarea
                required
                rows={2}
                value={newOpp.closeReason ?? ''}
                onChange={(e) => setNewOpp({ ...newOpp, closeReason: e.target.value })}
                placeholder="e.g., Strong technical fit and competitive pricing"
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
          )}

          <FormField label="Detailed Scope" wide>
            <textarea
              rows={2}
              value={newOpp.description}
              onChange={(e) => setNewOpp({ ...newOpp, description: e.target.value })}
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </FormGrid>

        {/* Active custom columns (hidden ones excluded) */}
        <CustomColumnFields
          columns={opportunityColumns}
          config={opportunitiesColumnConfig}
          values={newOpp}
          onChange={(key, value) => setNewOpp({ ...newOpp, [key]: value })}
        />
      </FormModal>

      {isEditModalOpen && editingOpp && (
        <InlineEditModal
          mode="opportunities"
          entity={editingOpp}
          displayedConfigs={displayedConfigs}
          accounts={accounts}
          opportunities={opportunities}
          onChange={(patch) => setEditingOpp({ ...editingOpp, ...patch })}
          onSave={handleUpdateOpportunity}
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingOpp(null);
          }}
        />
      )}

      {/* Deactivated Opportunities Section */}
      {deactivatedOpportunities.length > 0 && (
        <DeactivatedSection title="Deactivated Opportunities" count={deactivatedOpportunities.length}>
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
                <th className="py-2.5 px-5">Opportunity Name</th>
                <th className="py-2.5 px-4">Account</th>
                <th className="py-2.5 px-4">Stage</th>
                <th className="py-2.5 px-4">Deal Value</th>
                <th className="py-2.5 px-4">Owner</th>
                <th className="py-2.5 px-5 text-center">Restore</th>
              </tr>
            </thead>
            <tbody>
              {deactivatedOpportunities.map((opp) => {
                // accountName is joined server-side, so it resolves even when the
                // parent account was cascade-deactivated with this opportunity.
                const accountName = opp.accountName || accounts.find(a => a.id === opp.accountId)?.name;
                return (
                  <tr key={opp.id} className="border-b last:border-0 text-slate-500 font-medium opacity-70">
                    <td className="py-3 px-5">
                      <span className="font-semibold text-slate-600 line-through decoration-slate-300">{opp.name}</span>
                    </td>
                    <td className="py-3 px-4">{accountName || '—'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} shape="rounded" muted />
                    </td>
                    <td className="py-3 px-4 font-mono">${opp.value?.toLocaleString() || '0'}</td>
                    <td className="py-3 px-4">{opp.owner}</td>
                    <td className="py-3 px-5 text-center">
                      <RestoreButton
                        label={`Restore opportunity ${opp.name}`}
                        onClick={() => setRestoreTarget({ id: opp.id, label: opp.name })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DeactivatedSection>
      )}

      {/* Restore Confirmation */}
      <RestoreDialog
        isOpen={!!restoreTarget}
        title="Restore Opportunity"
        message={restoreTarget ? <>Restore opportunity <span className="font-bold">"{restoreTarget.label}"</span>? It will reappear in the active pipeline.</> : undefined}
        onConfirm={async () => {
          if (restoreTarget) {
            await handleRestoreOpportunity(restoreTarget.id);
            setRestoreTarget(null);
          }
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
};
