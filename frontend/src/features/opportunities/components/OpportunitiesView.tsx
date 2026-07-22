/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Opportunity } from '@/types';
import { Plus, Eye, Trash2, TrendingUp, X, FileSpreadsheet, Settings2, Pencil } from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { OpportunityActionsCommentsPanel } from '@/features/opportunities/components/OpportunityActionsCommentsPanel';
import { OpportunityFormModal } from '@/features/opportunities/components/OpportunityFormModal';
import { renderOpportunityCell } from '@/features/opportunities/components/OpportunityTableCells';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { OPPORTUNITY_STAGE_OPTIONS, STAGE_DEFAULT_PROBABILITY } from '@/constants';
import { compareForSort, deriveOppStatus, SortDirection } from '@/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  INPUT_CLS,
  PageHeader,
  Pagination,
  RestoreButton,
  RestoreDialog,
  RowActionButton,
  SearchBar,
  SortableHeader,
  STAGE_COLORS,
  StatusBadge,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';

export const OpportunitiesView: React.FC = () => {
  const {
    opportunities,
    deactivatedOpportunities,
    accounts,
    stakeholders,
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
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('All');
  const [allocationEndDateFrom, setAllocationEndDateFrom] = useState<string>('');
  const [allocationEndDateTo, setAllocationEndDateTo] = useState<string>('');
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
    value: 0,
    crmValue: 0,
    probability: STAGE_DEFAULT_PROBABILITY.Lead ?? 0,
    description: '',
    allocationStartDate: '',
    allocationEndDate: '',
    dealStartDate: undefined,
    dealCloseDate: undefined,
    nextStep: '',
    risksAndDependencies: '',
    tags: [],
    team: [],
    clientStakeholderId: '',
    serviceProviderStakeholderId: '',
    opportunityType: 'Growth',
    aopAvailable: false,
    aopYear: null,
    serviceLine: undefined,
  });

  // Operational list — module-specific filters only, never fiscal-period-based.
  const filteredOpps = opportunities.filter(o => {
    const account = accounts.find(a => a.id === o.accountId);
    const matchesSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (account?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage   = selectedStage === 'All' || o.stage === selectedStage;
    const matchesAccount = selectedAccountFilter === 'All' || o.accountId === selectedAccountFilter;
    const matchesDashboardStatus = dashboardOppStatusFilter === 'All' || deriveOppStatus(o.stage) === dashboardOppStatusFilter;
    const matchesAllocationEndFrom = !allocationEndDateFrom || (o.allocationEndDate && o.allocationEndDate >= allocationEndDateFrom);
    const matchesAllocationEndTo   = !allocationEndDateTo   || (o.allocationEndDate && o.allocationEndDate <= allocationEndDateTo);
    const matchesProbability = minProbability === 'All' || o.probability >= parseInt(minProbability, 10);
    return matchesSearch && matchesStage && matchesAccount &&
           matchesDashboardStatus && matchesAllocationEndFrom && matchesAllocationEndTo && matchesProbability;
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
      probability: STAGE_DEFAULT_PROBABILITY.Lead ?? 0,
      description: '',
      allocationStartDate: '',
      allocationEndDate: '',
      dealStartDate: undefined,
      dealCloseDate: undefined,
      nextStep: '',
      risksAndDependencies: '',
      tags: [],
      team: [],
      clientStakeholderId: '',
      serviceProviderStakeholderId: '',
      opportunityType: 'Growth',
      aopAvailable: false,
      aopYear: null,
      serviceLine: undefined,
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
  // User-added (non-standard) columns widen the table past the viewport and
  // trigger horizontal scroll; the default column set always fits the screen.
  const extraColumnCount = displayedConfigs.filter(col => !col.isStandard).length;

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
            ...OPPORTUNITY_STAGE_OPTIONS.map((s) => ({ value: s, label: s })),
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

        {/* Allocation End Date range */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Alloc End from</label>
          <input
            type="date"
            value={allocationEndDateFrom}
            onChange={(e) => setAllocationEndDateFrom(e.target.value)}
            aria-label="Allocation end date from"
            className={`${INPUT_CLS} font-mono`}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Alloc End to</label>
          <input
            type="date"
            value={allocationEndDateTo}
            onChange={(e) => setAllocationEndDateTo(e.target.value)}
            aria-label="Allocation end date to"
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
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table extraColumns={extraColumnCount} resizable storageKey="opportunities">
            <TableHead>
              {displayedConfigs.map(col => (
                <TableHeadCell
                  key={col.key}
                  columnId={col.key}
                  align={col.key === 'value' ? 'right' : col.key === 'probability' ? 'center' : 'left'}
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
                </TableHeadCell>
              ))}
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
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
                    <TableRow
                      key={opp.id}
                      clickable
                      onClick={() => setSelectedOppId(opp.id)}
                      className={selectedOppId === opp.id ? 'bg-blue-50/45 border-l-4 border-l-blue-600 font-semibold' : ''}
                    >
                      {displayedConfigs.map(col => (
                        <TableCell
                          key={col.key}
                          align={col.key === 'value' ? 'right' : col.key === 'probability' ? 'center' : 'left'}
                        >
                          {renderOpportunityCell(
                            col,
                            opp,
                            associatedAccount ? associatedAccount.name : (opp.accountName ?? 'Unknown Account'),
                          )}
                        </TableCell>
                      ))}

                      {/* Actions */}
                      <TableCell
                        align="center"
                        sticky="right"
                        className={selectedOppId === opp.id ? 'bg-blue-50' : ''}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
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
          totalItems={filteredOpps.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="opportunities"
        />
      </Card>

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
      <OpportunityFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateOpportunity}
        submitLabel="Create Opportunity"
        value={newOpp}
        onChange={(patch) => setNewOpp({ ...newOpp, ...patch })}
        accounts={accounts}
        stakeholders={stakeholders}
        opportunityColumns={opportunityColumns}
        opportunitiesColumnConfig={opportunitiesColumnConfig}
      />

      {isEditModalOpen && editingOpp && (
        <InlineEditModal
          mode="opportunities"
          entity={editingOpp}
          displayedConfigs={displayedConfigs}
          accounts={accounts}
          opportunities={opportunities}
          stakeholders={stakeholders}
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
          <Table>
            <TableHead>
              <TableHeadCell>Opportunity Name</TableHeadCell>
              <TableHeadCell>Account</TableHeadCell>
              <TableHeadCell>Stage</TableHeadCell>
              <TableHeadCell>Deal Value</TableHeadCell>
              <TableHeadCell align="center">Restore</TableHeadCell>
            </TableHead>
            <tbody>
              {deactivatedOpportunities.map((opp) => {
                // accountName is joined server-side, so it resolves even when the
                // parent account was cascade-deactivated with this opportunity.
                const accountName = opp.accountName || accounts.find(a => a.id === opp.accountId)?.name;
                return (
                  <TableRow key={opp.id} className="opacity-70">
                    <TableCell>
                      <span className="font-semibold text-slate-600 line-through decoration-slate-300">{opp.name}</span>
                    </TableCell>
                    <TableCell>{accountName || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} shape="rounded" muted />
                    </TableCell>
                    <TableCell className="font-mono">${opp.value?.toLocaleString() || '0'}</TableCell>
                    <TableCell align="center">
                      <RestoreButton
                        label={`Restore opportunity ${opp.name}`}
                        onClick={() => setRestoreTarget({ id: opp.id, label: opp.name })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
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
