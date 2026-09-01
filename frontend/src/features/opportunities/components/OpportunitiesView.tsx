/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Opportunity, OpportunityStage } from '@/types';
import { Plus, Eye, Trash2, TrendingUp, X, FileSpreadsheet, Settings2, Pencil, Calendar, FolderKanban, LineChart } from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { OpportunityActionsCommentsPanel } from '@/features/opportunities/components/OpportunityActionsCommentsPanel';
import { OpportunityFormModal } from '@/features/opportunities/components/OpportunityFormModal';
import { renderOpportunityCell } from '@/features/opportunities/components/OpportunityTableCells';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { OPPORTUNITY_STAGE_OPTIONS, STAGE_DEFAULT_PROBABILITY, OPPORTUNITY_HEALTH_OPTIONS, SERVICE_LINE_OPTIONS, stageChangePatch } from '@/constants';
import { compareForSort, deriveOppStatus, matchesGlobalAccount, SortDirection } from '@/utils';
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
  FormModal,
  INPUT_CLS,
} from '@/components/ui';

// Empty draft for the "New Opportunity" modal — a module constant so it can be
// reused both as the initial state and whenever the create form is reset/reopened.
const EMPTY_OPPORTUNITY: Omit<Opportunity, 'id'> = {
  name: '',
  accountId: '',
  stage: undefined as any,
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
  serviceProviderUserId: '',
  opportunityType: undefined as any,
  aopAvailable: false,
  aopYear: null,
  serviceLine: undefined,
  opportunityHealth: undefined,
  location: undefined,
  cost: 0,
  grossMargin: undefined,
};

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
    setSelectedProjectId,
    setCreateProjectIntent,
    opportunityColumns,
    opportunitiesColumnConfig,
    updateOpportunity,
    cameFromDashboard,
    navSource,
    selectedStage,
    setSelectedStage,
    dashboardOppStatusFilter,
    setDashboardOppStatusFilter,
    globalAccountId: selectedAccountFilter,
    refreshData,
    currentUser,
    loading,
    can,
  } = useCRM();

  // Module-specific filter states (operational — never fiscal-period-based)
  const [searchQuery, setSearchQuery] = useState('');
  const [allocationEndDateFrom, setAllocationEndDateFrom] = useState<string>('');
  const [allocationEndDateTo, setAllocationEndDateTo] = useState<string>('');
  const [minProbability, setMinProbability] = useState<string>('All');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [serviceLineFilter, setServiceLineFilter] = useState<string>('All');

  // Client-side pagination over the already-filtered rows
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // The Global Account Selector represents a workspace switch — clear
  // page-specific state so the newly selected account starts from a clean view.
  useEffect(() => {
    setSearchQuery('');
    setPage(1);
    setSelectedOppId(null);
  }, [selectedAccountFilter]);

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
    if (key === 'serviceProviderStakeholderId') {
      return opp.serviceProviderStakeholderName ?? '';
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
  const [promptConvertProject, setPromptConvertProject] = useState<string | null>(null);

  // Refresh from DB on mount
  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditClick = (opp: Opportunity) => {
    setEditingOpp({ ...opp });
    setIsEditModalOpen(true);
  };

  const handleUpdateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp || !editingOpp.name.trim()) return;
    const original = opportunities.find(o => o.id === editingOpp.id);
    const stageBecameWon = editingOpp.stage === 'Won' && (!original || original.stage !== 'Won') && !editingOpp.projectId;
    await updateOpportunity(editingOpp);
    setIsEditModalOpen(false);
    setEditingOpp(null);
    if (stageBecameWon) {
      setPromptConvertProject(editingOpp.id);
    }
  };

  // Stage change modal state
  const [closeDialog, setCloseDialog] = useState<{ outcome: 'Won' | 'Lost'; opp: Opportunity } | null>(null);
  const [closeReasonDraft, setCloseReasonDraft] = useState('');
  const [isClosingOpp, setIsClosingOpp] = useState(false);

  const [stageReasonDialog, setStageReasonDialog] = useState<{ stage: 'Blocked' | 'Delayed'; opp: Opportunity } | null>(null);
  const [stageReasonDraft, setStageReasonDraft] = useState('');
  const [isSavingStageReason, setIsSavingStageReason] = useState(false);

  const handleStageChange = async (opp: Opportunity, newStage: OpportunityStage) => {
    if (newStage === 'Won' || newStage === 'Lost') {
      setCloseReasonDraft(opp.closeReason || '');
      setCloseDialog({ outcome: newStage, opp });
    } else if (newStage === 'Blocked' || newStage === 'Delayed') {
      setStageReasonDraft((newStage === 'Blocked' ? opp.blockedReason : opp.delayedReason) || '');
      setStageReasonDialog({ stage: newStage, opp });
    } else {
      try {
        await updateOpportunity({
          ...opp,
          ...stageChangePatch(newStage),
        });
      } catch {
        // Central error handling
      }
    }
  };

  const handleCloseDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeDialog) return;
    const { outcome, opp } = closeDialog;
    setIsClosingOpp(true);
    try {
      const stageBecameWon = outcome === 'Won' && opp.stage !== 'Won' && !opp.projectId;
      await updateOpportunity({
        ...opp,
        ...stageChangePatch(outcome),
        closeReason: closeReasonDraft.trim(),
      });
      setCloseDialog(null);
      if (stageBecameWon) {
        setPromptConvertProject(opp.id);
      }
    } catch {
      // Central error handling
    } finally {
      setIsClosingOpp(false);
    }
  };

  const handleStageReasonDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageReasonDialog) return;
    const { stage, opp } = stageReasonDialog;
    setIsSavingStageReason(true);
    try {
      await updateOpportunity({
        ...opp,
        ...stageChangePatch(stage),
        ...(stage === 'Blocked'
          ? { blockedReason: stageReasonDraft.trim() }
          : { delayedReason: stageReasonDraft.trim() }),
      });
      setStageReasonDialog(null);
    } catch {
      // Central error handling
    } finally {
      setIsSavingStageReason(false);
    }
  };

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newOpp, setNewOpp] = useState<Omit<Opportunity, 'id'>>(EMPTY_OPPORTUNITY);

  // When a specific account is active in the Global Account Selector, new
  // opportunities lock to it — same mechanism Account Details already uses.
  const lockedAccount = selectedAccountFilter !== 'All'
    ? { id: selectedAccountFilter, name: accounts.find(a => a.id === selectedAccountFilter)?.name ?? '' }
    : undefined;

  const handleOpenAddOpportunity = () => {
    setNewOpp({ ...EMPTY_OPPORTUNITY, accountId: lockedAccount?.id ?? '' });
    setIsAddModalOpen(true);
  };

  // Operational list — module-specific filters only, never fiscal-period-based.
  const filteredOpps = opportunities.filter(o => {
    const account = accounts.find(a => a.id === o.accountId);
    const matchesSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (account?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage   = selectedStage === 'All' || o.stage === selectedStage;
    const matchesAccount = matchesGlobalAccount(o.accountId, selectedAccountFilter);
    const matchesDashboardStatus = dashboardOppStatusFilter === 'All' || deriveOppStatus(o.stage) === dashboardOppStatusFilter;
    const matchesAllocationEndFrom = !allocationEndDateFrom || (o.allocationEndDate && o.allocationEndDate >= allocationEndDateFrom);
    const matchesAllocationEndTo   = !allocationEndDateTo   || (o.allocationEndDate && o.allocationEndDate <= allocationEndDateTo);
    const matchesProbability = minProbability === 'All' || o.probability >= parseInt(minProbability, 10);
    const matchesHealth = healthFilter === 'All' || o.opportunityHealth === healthFilter;
    const matchesLocation = locationFilter === 'All' || o.location === locationFilter;
    const matchesServiceLine = serviceLineFilter === 'All' || o.serviceLine === serviceLineFilter;
    // Won opportunities stay visible in the list even after transitioning into
    // a Project — they are visually differentiated (a "Project" pill on the
    // stage cell and a "View project" row action) rather than hidden, so users
    // can always trace a deal from the pipeline through to its project.
    return matchesSearch && matchesStage && matchesAccount &&
           matchesDashboardStatus && matchesAllocationEndFrom && matchesAllocationEndTo && matchesProbability &&
           matchesHealth && matchesLocation && matchesServiceLine;
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
    setNewOpp({ ...EMPTY_OPPORTUNITY, accountId: lockedAccount?.id ?? '' });
    // Jump straight to details
    setSelectedOpportunityId(created.id);
    setView('opportunity-details');
  };

  const handleRowClick = (id: string) => {
    setSelectedOpportunityId(id);
    setView('opportunity-details');
  };

  const handleForecastClick = (id: string) => {
    setSelectedOpportunityId(id);
    setView('opportunity-forecast');
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
        subtitle="Track negotiations, deal size, stages, and execution dates across your accounts. Won deals move to their Project and are hidden from the active pipeline."
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
            {can('opportunities', 'create') && (
              <Button
                size="md"
                icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                onClick={handleOpenAddOpportunity}
              >
                New Opportunity
              </Button>
            )}
          </>
        }
      />

      {/* Customizable Column Sidebar */}
      <CustomizeColumnsSidebar
        module="opportunities"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Control Panel: Search & Module-Specific Filters.
          One compact grid — search + selects rely on their self-describing
          "All …" option; the two allocation dates carry a small top label.
          `items-end` bottom-aligns every control so the dates' extra label
          height never breaks the row alignment. */}
      <FilterBar className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search opportunities or accounts..."
          className="w-full sm:col-span-2 lg:col-span-3 xl:col-span-2"
        />

        <FilterSelect
          label="Stage"
          hideLabel
          value={selectedStage}
          onChange={setSelectedStage}
          className="w-full"
          options={[
            { value: 'All', label: 'All Stages' },
            ...OPPORTUNITY_STAGE_OPTIONS.map((s) => ({ value: s, label: s })),
          ]}
        />

        <FilterSelect
          label="Health"
          hideLabel
          value={healthFilter}
          onChange={setHealthFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Health' },
            ...OPPORTUNITY_HEALTH_OPTIONS.map((h) => ({ value: h, label: h })),
          ]}
        />

        <FilterSelect
          label="Service Line"
          hideLabel
          value={serviceLineFilter}
          onChange={setServiceLineFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Service Lines' },
            ...SERVICE_LINE_OPTIONS.map((s) => ({ value: s, label: s })),
          ]}
        />

        <FilterSelect
          label="Probability"
          hideLabel
          value={minProbability}
          onChange={setMinProbability}
          className="w-full"
          options={[
            { value: 'All', label: 'Any Probability' },
            { value: '25', label: 'Probability ≥ 25%' },
            { value: '50', label: 'Probability ≥ 50%' },
            { value: '75', label: 'Probability ≥ 75%' },
            { value: '90', label: 'Probability ≥ 90%' },
          ]}
        />



        <FilterSelect
          label="Location"
          hideLabel
          value={locationFilter}
          onChange={setLocationFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Locations' },
            ...Array.from(new Set(opportunities.map((o) => o.location).filter((l): l is string => !!l)))
              .sort()
              .map((l) => ({ value: l, label: l })),
          ]}
        />

        <label className="block w-full">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Expected Project End (From)
          </span>
          <div className="flex items-center gap-1.5 w-full border border-slate-200 rounded-lg bg-white px-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="date"
              value={allocationEndDateFrom}
              onChange={(e) => setAllocationEndDateFrom(e.target.value)}
              aria-label="Expected project end date from"
              className="w-full min-w-0 text-xs font-mono py-2.5 border-0 bg-transparent focus:outline-none focus:ring-0 p-0"
            />
          </div>
        </label>

        <label className="block w-full">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Expected Project End (To)
          </span>
          <div className="flex items-center gap-1.5 w-full border border-slate-200 rounded-lg bg-white px-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="date"
              value={allocationEndDateTo}
              onChange={(e) => setAllocationEndDateTo(e.target.value)}
              aria-label="Expected project end date to"
              className="w-full min-w-0 text-xs font-mono py-2.5 border-0 bg-transparent focus:outline-none focus:ring-0 p-0"
            />
          </div>
        </label>
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
                  const hasProject = opp.stage === 'Won' && !!opp.projectId;
                  return (
                    <TableRow
                      key={opp.id}
                      clickable
                      onClick={() => setSelectedOppId(opp.id)}
                      className={
                        selectedOppId === opp.id
                          ? 'bg-blue-50/45 border-l-4 border-l-blue-600 font-semibold'
                          : hasProject
                            ? 'bg-indigo-50/30'
                            : ''
                      }
                    >
                      {displayedConfigs.map(col => (
                        <TableCell
                          key={col.key}
                          align={col.key === 'value' ? 'right' : col.key === 'probability' ? 'center' : 'left'}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (can('opportunities', 'update')) handleEditClick(opp);
                          }}
                        >
                          {renderOpportunityCell(
                            col,
                            opp,
                            associatedAccount ? associatedAccount.name : (opp.accountName ?? 'Unknown Account'),
                            can('opportunities', 'update') ? handleStageChange : undefined,
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
                            intent="forecast"
                            label={`Forecast for ${opp.name}`}
                            icon={<LineChart className="w-3.5 h-3.5" />}
                            onClick={() => handleForecastClick(opp.id)}
                          />
                          {opp.stage === 'Won' ? (
                            opp.projectId ? (
                              <RowActionButton
                                intent="view"
                                label={`View project for ${opp.name}`}
                                icon={<FolderKanban className="w-3.5 h-3.5" />}
                                onClick={() => {
                                  setSelectedProjectId(opp.projectId!);
                                  setView('project-details');
                                }}
                              />
                            ) : (
                              can('opportunities', 'update') && (
                                <RowActionButton
                                  intent="edit"
                                  label={`Create project for ${opp.name}`}
                                  icon={<FolderKanban className="w-3.5 h-3.5" />}
                                  onClick={() => {
                                    // Open the details view and auto-launch its Create Project modal.
                                    setCreateProjectIntent(true);
                                    setSelectedOpportunityId(opp.id);
                                    setView('opportunity-details');
                                  }}
                                />
                              )
                            )
                          ) : (
                            can('opportunities', 'update') && (
                              <RowActionButton
                                intent="edit"
                                label={`Edit opportunity ${opp.name}`}
                                icon={<Pencil className="w-3.5 h-3.5" />}
                                onClick={() => handleEditClick(opp)}
                              />
                            )
                          )}
                          {can('opportunities', 'delete') && (
                            <RowActionButton
                              intent="delete"
                              label={`Delete opportunity ${opp.name}`}
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => setDeleteTarget({ id: opp.id, label: opp.name })}
                            />
                          )}
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
        lockedAccount={lockedAccount}
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

      <ConfirmDialog
        isOpen={!!promptConvertProject}
        title="Convert to Project"
        message="Opportunity stage has been set to Won. Would you like to convert this opportunity to a project now?"
        confirmLabel="Yes, Convert"
        cancelLabel="No, Later"
        onConfirm={() => {
          if (promptConvertProject) {
            setSelectedOpportunityId(promptConvertProject);
            setCreateProjectIntent(true);
            setView('opportunity-details');
            setPromptConvertProject(null);
          }
        }}
        onCancel={() => setPromptConvertProject(null)}
      />

      {/* Won/Lost Close-out Dialog */}
      <FormModal
        isOpen={!!closeDialog}
        title={closeDialog?.outcome === 'Won' ? 'Mark Opportunity as Won' : 'Mark Opportunity as Lost'}
        onClose={() => setCloseDialog(null)}
        onSubmit={handleCloseDialogSubmit}
        submitLabel={isClosingOpp ? 'Saving…' : `Mark ${closeDialog?.outcome ?? ''}`}
        submitVariant={closeDialog?.outcome === 'Won' ? 'success' : 'danger'}
        isSubmitting={isClosingOpp}
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          <label className="text-label font-semibold text-slate-600 uppercase tracking-wide block">
            {closeDialog?.outcome === 'Won' ? 'Win Reason' : 'Loss Reason'}
          </label>
          <textarea
            autoFocus
            rows={3}
            value={closeReasonDraft}
            onChange={(e) => setCloseReasonDraft(e.target.value)}
            placeholder={closeDialog?.outcome === 'Won'
              ? 'e.g., Strong technical fit and competitive pricing'
              : 'e.g., Lost to competitor on price'}
            className={`${INPUT_CLS} resize-none`}
          />
          <p className="text-[10px] text-slate-400 font-medium">
            Recorded on the opportunity for win/loss analysis.
          </p>
        </div>
      </FormModal>

      {/* Blocked/Delayed reason dialog */}
      <FormModal
        isOpen={!!stageReasonDialog}
        title={stageReasonDialog?.stage === 'Blocked' ? 'Mark Opportunity as Blocked' : 'Mark Opportunity as Delayed'}
        onClose={() => setStageReasonDialog(null)}
        onSubmit={handleStageReasonDialogSubmit}
        submitLabel={isSavingStageReason ? 'Saving…' : `Mark ${stageReasonDialog?.stage ?? ''}`}
        submitVariant="warning"
        isSubmitting={isSavingStageReason}
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          <label className="text-label font-semibold text-slate-600 uppercase tracking-wide block">
            {stageReasonDialog?.stage === 'Blocked' ? 'Blocked Reason' : 'Delayed Reason'}
          </label>
          <textarea
            autoFocus
            rows={3}
            value={stageReasonDraft}
            onChange={(e) => setStageReasonDraft(e.target.value)}
            placeholder={stageReasonDialog?.stage === 'Blocked'
              ? 'Describe why this opportunity is currently blocked...'
              : 'Describe why this opportunity has been delayed...'}
            className={`${INPUT_CLS} resize-none`}
          />
          <p className="text-[10px] text-slate-400 font-medium">
            Optional — separate from Risks &amp; Dependencies.
          </p>
        </div>
      </FormModal>

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
                      {can('opportunities', 'update') && (
                        <RestoreButton
                          label={`Restore opportunity ${opp.name}`}
                          onClick={() => setRestoreTarget({ id: opp.id, label: opp.name })}
                        />
                      )}
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
