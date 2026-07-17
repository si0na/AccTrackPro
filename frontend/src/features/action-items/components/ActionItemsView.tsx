/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ActionItem, ActionItemStatus, PriorityLevel } from '@/types';
import {
  AlertTriangle,
  Plus,
  X,
  Settings2,
} from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import {
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  FilterBar,
  FilterChip,
  FilterSelect,
  PageHeader,
  Pagination,
  PRIORITY_COLORS,
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
  ExpandableTextCell,
} from '@/components/ui';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { ActionItemFormModal } from '@/features/action-items/components/ActionItemFormModal';
import { ActionItemCommentToggle, ActionItemCommentsExpandedRow } from '@/components/ActionItemComments';
import { ACTION_ITEM_STATUS_OPTIONS } from '@/constants';
import { compareForSort, getTodayISODate, isDueThisWeek, isOpenActionItemStatus, normalizeOwnerName, SortDirection } from '@/utils';

export const ActionItemsView: React.FC = () => {
  const {
    actionItems,
    deactivatedActionItems,
    accounts,
    deactivatedAccounts,
    opportunities,
    stakeholders,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    actionItemColumns,
    actionItemsColumnConfig,
    comments,
    addComment,
    deleteComment,
    focusedRecord,
    setFocusedRecord,
    setView,
    cameFromDashboard,
    navSource,
    dueThisWeekFilter,
    setDueThisWeekFilter,
    openActionItemsFilter,
    setOpenActionItemsFilter,
    overdueActionItemsFilter,
    setOverdueActionItemsFilter,
    loading,
  } = useCRM();

  // Single-record focus set when the user opens an action-item notification
  const focusedActionItemId = focusedRecord?.type === 'actionItem' ? focusedRecord.id : null;
  const focusedItem = focusedActionItemId
    ? actionItems.find(ai => ai.id === focusedActionItemId)
    : undefined;

  const resolveAccount = (accountId: string) =>
    accounts.find(a => a.id === accountId) || deactivatedAccounts.find(a => a.id === accountId);

  // Sidebar Open State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'actionItem' | 'comment'; id: string; label: string } | null>(null);

  // Expanded row comment state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Module-specific filter states (operational — never fiscal-period-based)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('All');
  const [selectedOpportunityFilter, setSelectedOpportunityFilter] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  /** Quick due-date filter: All | Overdue | Due Today | Due This Week */
  const [dueFilter, setDueFilter] = useState<string>('All');

  // Client-side pagination over the already-filtered/sorted rows (display only)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Opportunity filter is dependent on the selected account — switching
  // accounts invalidates any opportunity selection that no longer applies.
  const handleAccountFilterChange = (value: string) => {
    setSelectedAccountFilter(value);
    setSelectedOpportunityFilter('All');
  };

  const opportunityFilterOptions = selectedAccountFilter === 'All'
    ? opportunities
    : opportunities.filter(opp => opp.accountId === selectedAccountFilter);

  // Column sort state
  const [sortField, setSortField] = useState<string>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };
  const getSortValue = (item: ActionItem, key: string) => {
    if (key === 'accountId') return resolveAccount(item.accountId)?.name || item.accountName || '';
    if (key === 'opportunityId') return opportunities.find(o => o.id === item.opportunityId)?.name || '';
    return (item as any)[key];
  };

  // Edit Action Item Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAi, setEditingAi] = useState<ActionItem | null>(null);

  const handleEditClick = (item: ActionItem) => {
    setEditingAi({ ...item });
    setIsEditModalOpen(true);
  };

  const handleUpdateActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAi || !editingAi.title.trim()) return;
    updateActionItem(editingAi);
    setIsEditModalOpen(false);
    setEditingAi(null);
  };

  // New Action Item Modal State. Priority starts unselected — the user must
  // choose explicitly. Status legitimately starts at the lifecycle's first
  // state ('To Do'), which is not a preference default. Open Date defaults to
  // today but stays user-editable before saving.
  const EMPTY_ACTION_ITEM: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
    openDate: getTodayISODate(),
    dueDate: '',
    priority: '' as PriorityLevel,
    status: 'To Do',
    notes: '',
    risksAndDependencies: ''
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAi, setNewAi] = useState<Omit<ActionItem, 'id'>>(EMPTY_ACTION_ITEM);

  // Dedupe case-insensitively so legacy variants ("john"/"JOHN") yield one entry.
  const ownersList = Array.from(
    new Map(
      actionItems
        .filter(ai => ai.owner?.trim())
        .map(ai => [ai.owner.trim().toLowerCase(), normalizeOwnerName(ai.owner)]),
    ).values(),
  );

  const todayStr = getTodayISODate();

  // Operational task list — module-specific filters only, never fiscal-period-based.
  const filteredActionItems = actionItems.filter(ai => {
    if (focusedActionItemId && ai.id !== focusedActionItemId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const account = resolveAccount(ai.accountId);
      const matches =
        ai.title.toLowerCase().includes(q) ||
        (ai.notes || '').toLowerCase().includes(q) ||
        (account?.name || '').toLowerCase().includes(q) ||
        ai.owner.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (selectedOwner !== 'All' && ai.owner.trim().toLowerCase() !== selectedOwner.toLowerCase()) return false;
    if (selectedAccountFilter !== 'All' && ai.accountId !== selectedAccountFilter) return false;
    if (selectedOpportunityFilter !== 'All' && ai.opportunityId !== selectedOpportunityFilter) return false;
    if (selectedStatus !== 'All' && ai.status !== selectedStatus) return false;
    if (selectedPriority !== 'All' && ai.priority !== selectedPriority) return false;
    // Quick due-date filters apply to open (not completed/cancelled) items with a valid date.
    if (dueFilter === 'Overdue' &&
        (!isOpenActionItemStatus(ai.status) || !ai.dueDate || ai.dueDate >= todayStr)) return false;
    if (dueFilter === 'Due Today' &&
        (!isOpenActionItemStatus(ai.status) || ai.dueDate !== todayStr)) return false;
    if (dueFilter === 'Due This Week' &&
        (!isOpenActionItemStatus(ai.status) || !isDueThisWeek(ai.dueDate))) return false;
    // Dashboard "Due This Week" drill-down: same rule as the dashboard widget.
    if (dueThisWeekFilter && (!isOpenActionItemStatus(ai.status) || !isDueThisWeek(ai.dueDate))) return false;
    // Dashboard "My Action Items" drill-down: only open items.
    if (openActionItemsFilter && !isOpenActionItemStatus(ai.status)) return false;
    // Dashboard "Overdue Tasks" drill-down: open items past their due date.
    if (overdueActionItemsFilter && (!isOpenActionItemStatus(ai.status) || !ai.dueDate || ai.dueDate >= todayStr)) return false;
    return true;
  });

  const sortedActionItems = [...filteredActionItems].sort((a, b) =>
    compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
  );

  // Clamp the page so filter changes never leave the user on an empty page.
  const totalPages = Math.max(1, Math.ceil(sortedActionItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedActionItems = sortedActionItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Create action item
  const handleCreateActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAi.title.trim() || !newAi.accountId || !newAi.priority) return;
    try {
      await addActionItem(newAi);
      setIsAddModalOpen(false);
      setNewAi(EMPTY_ACTION_ITEM);
    } catch {
      // Failure toast raised centrally by the API client; keep the modal open.
    }
  };

  // Move status handler
  const handleMoveStatus = (item: ActionItem, newStatus: ActionItemStatus) => {
    const updated = {
      ...item,
      status: newStatus,
      completedDate: newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : undefined
    };
    updateActionItem(updated);
  };

  const displayedConfigs = actionItemsColumnConfig.filter(col => col.isDisplayed);
  // User-added (non-standard) columns widen the table past the viewport and
  // trigger horizontal scroll; the default column set always fits the screen.
  const extraColumnCount = displayedConfigs.filter(col => !col.isStandard).length;

  if (loading) return <LoadingState label="Loading action items…" />;

  return (
    <div className="space-y-6">
      {/* Dashboard drill-down context: back button + active drill-down filter pills */}
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />

          {dueThisWeekFilter && (
            <FilterChip
              label="Showing open action items due this week"
              active
              onClick={() => setDueThisWeekFilter(false)}
            />
          )}

          {openActionItemsFilter && !dueThisWeekFilter && (
            <FilterChip
              label="Showing open action items"
              active
              onClick={() => setOpenActionItemsFilter(false)}
            />
          )}

          {overdueActionItemsFilter && (
            <FilterChip
              label="Showing overdue tasks"
              active
              onClick={() => setOverdueActionItemsFilter(false)}
            />
          )}
        </div>
      )}

      {navSource && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton
            label={navSource === 'notifications' ? 'Back to Notifications' : 'Back to Audit Log'}
            onClick={() => setView(navSource === 'notifications' ? 'notifications' : 'audit-log')}
          />
        </div>
      )}

      <PageHeader
        title="Governance & Action Items"
        subtitle="Coordinate delivery, track critical dependencies, and resolve blocks instantly."
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
              New Action Item
            </Button>
          </>
        }
      />

      {/* Customizable Column Sidebar */}
      <CustomizeColumnsSidebar
        module="actionItems"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Single-record focus banner (arrived here from a notification) */}
      {focusedActionItemId && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-2.5 rounded-lg text-xs font-semibold">
          <span>
            {focusedItem
              ? <>Showing the action item <span className="font-extrabold">"{focusedItem.title}"</span> from your notification.</>
              : 'The action item from your notification is not in the current list — it may have been deactivated.'}
          </span>
          <button
            onClick={() => setFocusedRecord(null)}
            className="shrink-0 flex items-center gap-1 text-indigo-500 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
            title="Show all action items"
          >
            <X className="w-3 h-3" />
            <span>Show all</span>
          </button>
        </div>
      )}

      {/* Control Panel: Search & Module-Specific Filters */}
      <FilterBar className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-center">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tasks, accounts, owners..."
          className="w-full"
        />

        <FilterSelect
          label="Account"
          hideLabel
          value={selectedAccountFilter}
          onChange={handleAccountFilterChange}
          options={[
            { value: 'All', label: 'All Accounts' },
            ...accounts.map(acc => ({ value: acc.id, label: acc.name })),
          ]}
        />

        <FilterSelect
          label="Opportunity"
          hideLabel
          value={selectedOpportunityFilter}
          onChange={setSelectedOpportunityFilter}
          options={[
            { value: 'All', label: 'All Opportunities' },
            ...opportunityFilterOptions.map(opp => ({ value: opp.id, label: opp.name })),
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
          label="Status"
          hideLabel
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={[
            { value: 'All', label: 'All Statuses' },
            ...ACTION_ITEM_STATUS_OPTIONS.map(s => ({ value: s, label: s })),
          ]}
        />

        <FilterSelect
          label="Priority"
          hideLabel
          value={selectedPriority}
          onChange={setSelectedPriority}
          options={[
            { value: 'All', label: 'All Priorities' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' },
          ]}
        />

        <FilterSelect
          label="Due Date"
          hideLabel
          value={dueFilter}
          onChange={setDueFilter}
          options={[
            { value: 'All', label: 'Any Due Date' },
            { value: 'Overdue', label: 'Overdue' },
            { value: 'Due Today', label: 'Due Today' },
            { value: 'Due This Week', label: 'Due This Week' },
          ]}
        />
      </FilterBar>

      {/* List Layout View */}
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table extraColumns={extraColumnCount} resizable storageKey="action-items">
            <TableHead>
              {displayedConfigs.map(col => (
                <TableHeadCell key={col.key} columnId={col.key}>
                  <SortableHeader
                    label={col.name}
                    field={col.key}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
              ))}
              <TableHeadCell align="center" sticky="right">Delete</TableHeadCell>
            </TableHead>
            <tbody>
              {filteredActionItems.length === 0 && (
                <EmptyRow
                  colSpan={displayedConfigs.length + 1}
                  message={
                    dueThisWeekFilter
                      ? 'No open action items are due this week.'
                      : overdueActionItemsFilter
                      ? 'No overdue action items found.'
                      : openActionItemsFilter
                      ? 'No open action items found.'
                      : 'No action items match the current filters.'
                  }
                />
              )}
              {pagedActionItems.map(item => {
                const account = resolveAccount(item.accountId);
                const itemComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === item.id);
                return (
                  <React.Fragment key={item.id}>
                    <TableRow className="hover:bg-slate-50/50">
                      {displayedConfigs.map(col => {
                        if (col.key === 'title') {
                          return (
                            <TableCell key={col.key}>
                              <div className="flex items-center flex-wrap gap-1">
                                <div className="flex-1">
                                  <p className="font-extrabold text-slate-900 text-sm">{item.title}</p>
                                </div>
                                {!!item.risksAndDependencies?.trim() && (
                                  <span
                                    className="shrink-0 inline-flex"
                                    title={`Risks & Dependencies: ${item.risksAndDependencies}`}
                                    aria-label={`Action item has risks or dependencies: ${item.risksAndDependencies}`}
                                    role="img"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                                  </span>
                                )}
                                <ActionItemCommentToggle
                                  itemTitle={item.title}
                                  commentCount={itemComments.length}
                                  isExpanded={expandedItemId === item.id}
                                  onToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                />
                              </div>
                            </TableCell>
                          );
                        }
                        if (col.key === 'notes') {
                          return (
                            <TableCell key={col.key} className="text-slate-600 font-medium">
                              <span className="block max-w-[280px] line-clamp-2" title={item.notes || undefined}>
                                {item.notes || '—'}
                              </span>
                            </TableCell>
                          );
                        }
                        if (col.key === 'risksAndDependencies') {
                          return (
                            <TableCell key={col.key}>
                              <ExpandableTextCell
                                text={item.risksAndDependencies}
                                label="Risks & Dependencies"
                                emptyLabel="No Risks"
                              />
                            </TableCell>
                          );
                        }
                        if (col.key === 'accountId') {
                          return (
                            <TableCell key={col.key} className="text-slate-600 font-bold">
                              {account?.name || item.accountName || 'Unknown Account'}
                            </TableCell>
                          );
                        }
                        if (col.key === 'opportunityId') {
                          const opp = opportunities.find(o => o.id === item.opportunityId);
                          return (
                            <TableCell key={col.key} className="text-slate-600 font-semibold text-xs">
                              {opp ? opp.name : '—'}
                            </TableCell>
                          );
                        }
                        if (col.key === 'owner') {
                          return (
                            <TableCell key={col.key} className="text-slate-600 font-semibold">
                              {item.owner}
                            </TableCell>
                          );
                        }
                        if (col.key === 'priority') {
                          return (
                            <TableCell key={col.key}>
                              <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                            </TableCell>
                          );
                        }
                        if (col.key === 'status') {
                          return (
                            <TableCell key={col.key}>
                              <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
                            </TableCell>
                          );
                        }
                        if (col.key === 'openDate') {
                          return (
                            <TableCell key={col.key} className="font-mono font-medium text-slate-500">
                              {item.openDate}
                            </TableCell>
                          );
                        }
                        if (col.key === 'dueDate') {
                          return (
                            <TableCell key={col.key} className="font-mono font-medium text-slate-500">
                              {item.dueDate}
                            </TableCell>
                          );
                        }

                        // Customizable dynamic custom columns
                        const rawVal = item[col.key] ?? (col.type === 'boolean' ? false : '');
                        return (
                          <TableCell key={col.key}>
                            {col.type === 'boolean' ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rawVal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {rawVal ? 'Yes' : 'No'}
                              </span>
                            ) : col.type === 'number' ? (
                              <span className="font-mono font-semibold text-slate-700">{rawVal}</span>
                            ) : (
                              <span className="text-slate-600">{String(rawVal)}</span>
                            )}
                          </TableCell>
                        );
                      })}

                      <TableCell align="center" sticky="right">
                        <TableActions
                          entityLabel={`action item ${item.title}`}
                          onEdit={() => handleEditClick(item)}
                          onDelete={() => setDeleteTarget({ type: 'actionItem', id: item.id, label: item.title })}
                        />
                      </TableCell>
                    </TableRow>

                    {expandedItemId === item.id && (
                      <ActionItemCommentsExpandedRow
                        colSpan={displayedConfigs.length + 1}
                        comments={itemComments}
                        risksAndDependencies={item.risksAndDependencies ?? ''}
                        onAddComment={(text) => addComment('actionItem', item.id, text)}
                        onDeleteComment={(comment) => setDeleteTarget({ type: 'comment', id: comment.id, label: comment.text.substring(0, 40) })}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={sortedActionItems.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="action items"
        />
      </Card>

      {/* New Action Item Modal */}
      <ActionItemFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateActionItem}
        submitLabel="Create Action Item"
        value={newAi}
        onChange={(patch) => setNewAi({ ...newAi, ...patch })}
        accounts={accounts}
        opportunities={opportunities}
        actionItemColumns={actionItemColumns}
        actionItemsColumnConfig={actionItemsColumnConfig}
      />

      {isEditModalOpen && editingAi && (
        <InlineEditModal
          mode="actionItems"
          entity={editingAi}
          displayedConfigs={displayedConfigs}
          accounts={accounts}
          opportunities={opportunities}
          stakeholders={stakeholders}
          onChange={(patch) => setEditingAi({ ...editingAi, ...patch })}
          onSave={handleUpdateActionItem}
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingAi(null);
          }}
        />
      )}
      {/* Deactivated Action Items Section */}
      {deactivatedActionItems.length > 0 && (
        <DeactivatedSection title="Deactivated Action Items" count={deactivatedActionItems.length}>
          <Table>
            <TableHead>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Account</TableHeadCell>
              <TableHeadCell>Owner</TableHeadCell>
              <TableHeadCell>Priority</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Open Date</TableHeadCell>
              <TableHeadCell>Due Date</TableHeadCell>
            </TableHead>
            <tbody>
              {deactivatedActionItems.map((item) => {
                const acc = resolveAccount(item.accountId);
                return (
                  <TableRow key={item.id} className="opacity-70">
                    <TableCell className="font-semibold text-slate-600 line-through decoration-slate-300">{item.title}</TableCell>
                    <TableCell className="text-slate-500">{item.accountName || acc?.name || '—'}</TableCell>
                    <TableCell>{item.owner}</TableCell>
                    <TableCell>
                      <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" muted />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} muted />
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">{item.openDate}</TableCell>
                    <TableCell className="font-mono text-slate-400">{item.dueDate}</TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </DeactivatedSection>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'comment' ? 'Delete Comment' : 'Delete Action Item'}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'actionItem') await deleteActionItem(deleteTarget.id);
          else await deleteComment(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
