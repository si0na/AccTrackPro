/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ActionItem, ActionItemStatus, PriorityLevel } from '@/types';
import {
  Plus,
  CheckSquare,
  X,
  Settings2,
  MessageSquare,
} from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import {
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  FilterBar,
  FilterChip,
  FilterSelect,
  FormField,
  FormGrid,
  FormModal,
  INPUT_CLS,
  PageHeader,
  PRIORITY_COLORS,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  StatusBadge,
  TableActions,
} from '@/components/ui';
import { InlineEditModal } from '@/components/InlineEditModal';
import { LoadingState } from '@/components/common/LoadingState';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { compareForSort, isDueThisWeek, normalizeOwnerName, SortDirection } from '@/utils';

export const ActionItemsView: React.FC = () => {
  const {
    actionItems,
    deactivatedActionItems,
    accounts,
    deactivatedAccounts,
    opportunities,
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
  // state ('Not Started'), which is not a preference default.
  const EMPTY_ACTION_ITEM: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
    dueDate: '',
    priority: '' as PriorityLevel,
    status: 'Not Started',
    notes: ''
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

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

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
    // Quick due-date filters apply to open (not completed) items with a valid date.
    if (dueFilter === 'Overdue' &&
        (ai.status === 'Completed' || !ai.dueDate || ai.dueDate >= todayStr)) return false;
    if (dueFilter === 'Due Today' &&
        (ai.status === 'Completed' || ai.dueDate !== todayStr)) return false;
    if (dueFilter === 'Due This Week' &&
        (ai.status === 'Completed' || !isDueThisWeek(ai.dueDate))) return false;
    // Dashboard "Due This Week" drill-down: same rule as the dashboard widget.
    if (dueThisWeekFilter && (ai.status === 'Completed' || !isDueThisWeek(ai.dueDate))) return false;
    // Dashboard "My Action Items" drill-down: only non-completed items.
    if (openActionItemsFilter && ai.status === 'Completed') return false;
    // Dashboard "Overdue Tasks" drill-down: open items past their due date.
    if (overdueActionItemsFilter && (ai.status === 'Completed' || !ai.dueDate || ai.dueDate >= todayStr)) return false;
    return true;
  });

  const sortedActionItems = [...filteredActionItems].sort((a, b) =>
    compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
  );

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
            { value: 'Not Started', label: 'Not Started' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Blocked', label: 'Blocked' },
            { value: 'Completed', label: 'Completed' },
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
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                {displayedConfigs.map(col => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 font-bold uppercase tracking-wider ${
                      col.key === 'title' ? 'px-5' : ''
                    }`}
                  >
                    <SortableHeader
                      label={col.name}
                      field={col.key}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                ))}
                <th className="py-3 px-5 text-center">Delete</th>
              </tr>
            </thead>
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
              {sortedActionItems.map(item => {
                const account = resolveAccount(item.accountId);
                const itemComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === item.id);
                return (
                  <React.Fragment key={item.id}>
                    <tr className="border-b last:border-0 hover:bg-slate-50/50 text-slate-800 font-medium">
                      {displayedConfigs.map(col => {
                        if (col.key === 'title') {
                          return (
                            <td key={col.key} className="py-3.5 px-5">
                              <div className="flex items-center flex-wrap gap-1">
                                <div className="flex-1">
                                  <p className="font-extrabold text-slate-900 text-sm">{item.title}</p>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedItemId(expandedItemId === item.id ? null : item.id);
                                  }}
                                  className={`inline-flex items-center space-x-1 ml-2 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                    expandedItemId === item.id
                                      ? 'bg-blue-100 text-blue-700 font-bold'
                                      : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                                  }`}
                                  title="View/Add Comments"
                                  aria-label={`View or add comments for ${item.title}`}
                                  aria-expanded={expandedItemId === item.id}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span className="text-[10px] font-bold">{itemComments.length}</span>
                                </button>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === 'notes') {
                          return (
                            <td key={col.key} className="py-3.5 px-4 text-slate-600 font-medium">
                              {item.notes || '—'}
                            </td>
                          );
                        }
                        if (col.key === 'accountId') {
                          return (
                            <td key={col.key} className="py-3.5 px-4 text-slate-600 font-bold">
                              {account?.name || item.accountName || 'Unknown Account'}
                            </td>
                          );
                        }
                        if (col.key === 'opportunityId') {
                          const opp = opportunities.find(o => o.id === item.opportunityId);
                          return (
                            <td key={col.key} className="py-3.5 px-4 text-slate-600 font-semibold text-xs">
                              {opp ? opp.name : '—'}
                            </td>
                          );
                        }
                        if (col.key === 'owner') {
                          return (
                            <td key={col.key} className="py-3.5 px-4 text-slate-600 font-semibold">
                              {item.owner}
                            </td>
                          );
                        }
                        if (col.key === 'priority') {
                          return (
                            <td key={col.key} className="py-3.5 px-4">
                              <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                            </td>
                          );
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={col.key} className="py-3.5 px-4">
                              <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
                            </td>
                          );
                        }
                        if (col.key === 'dueDate') {
                          return (
                            <td key={col.key} className="py-3.5 px-4 font-mono font-medium text-slate-500">
                              {item.dueDate}
                            </td>
                          );
                        }

                        // Customizable dynamic custom columns
                        const rawVal = item[col.key] ?? (col.type === 'boolean' ? false : '');
                        return (
                          <td key={col.key} className="py-3.5 px-4">
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

                      <td className="py-3.5 px-5 text-center">
                        <TableActions
                          entityLabel={`action item ${item.title}`}
                          onEdit={() => handleEditClick(item)}
                          onDelete={() => setDeleteTarget({ type: 'actionItem', id: item.id, label: item.title })}
                        />
                      </td>
                    </tr>

                    {expandedItemId === item.id && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={displayedConfigs.length + 1} className="p-4">
                          <div className="space-y-3 max-w-2xl">
                            <div className="flex items-center space-x-2 border-b border-slate-200 pb-1.5">
                              <MessageSquare className="w-4 h-4 text-blue-600" aria-hidden="true" />
                              <h4 className="font-bold text-slate-700 text-xs">Governance Comments ({itemComments.length})</h4>
                            </div>
                            
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {itemComments.length === 0 ? (
                                <p className="text-[11px] text-slate-400 font-medium py-1">No comments logged for this action item.</p>
                              ) : (
                                itemComments.map(c => (
                                  <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-1 relative group">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-bold text-slate-700 text-[11px]">{c.user}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-[9px] text-slate-400 font-mono">{c.timestamp}</span>
                                      </div>
                                      <button
                                        onClick={() => setDeleteTarget({ type: 'comment', id: c.id, label: c.text.substring(0, 40) })}
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{c.text}</p>
                                  </div>
                                ))
                              )}
                            </div>

                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                const input = e.currentTarget.elements.namedItem('commentText') as HTMLInputElement;
                                if (input && input.value.trim()) {
                                  addComment('actionItem', item.id, input.value.trim());
                                  input.value = '';
                                }
                              }} 
                              className="flex gap-2"
                            >
                              <input
                                type="text"
                                name="commentText"
                                required
                                placeholder="Add a comment or update..."
                                aria-label="Add a comment or update"
                                className={`${INPUT_CLS} flex-1 bg-white`}
                              />
                              <Button type="submit" size="xs" className="shrink-0">
                                Add Comment
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Action Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 tracking-tight">Create Action Item</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateActionItem} className="flex flex-col flex-1 min-h-0 text-xs">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Task Title */}
              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase tracking-wide">Task Title</label>
                <input
                  type="text"
                  required
                  value={newAi.title}
                  onChange={(e) => setNewAi({ ...newAi, title: e.target.value })}
                  placeholder="e.g., Share Technical SLA Draft"
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Account ID */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wide">Target Account</label>
                  <select
                    required
                    value={newAi.accountId}
                    onChange={(e) => setNewAi({ ...newAi, accountId: e.target.value, opportunityId: '' })}
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-white focus:outline-none"
                  >
                    <option value="" disabled>Select an account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Associated Opportunity */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wide">Associated Opportunity</label>
                  <select
                    value={newAi.opportunityId || ''}
                    onChange={(e) => setNewAi({ ...newAi, opportunityId: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-white focus:outline-none"
                  >
                    <option value="">None / General Task</option>
                    {opportunities
                      .filter(opp => opp.accountId === newAi.accountId)
                      .map(opp => (
                        <option key={opp.id} value={opp.id}>
                          {opp.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Owner */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wide">Task Owner</label>
                  <input
                    type="text"
                    value={newAi.owner}
                    onChange={(e) => setNewAi({ ...newAi, owner: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wide">Priority</label>
                  <select
                    required
                    value={newAi.priority}
                    onChange={(e) => setNewAi({ ...newAi, priority: e.target.value as PriorityLevel })}
                    className="w-full text-xs px-3 py-2 border rounded-lg bg-white focus:outline-none"
                  >
                    <option value="" disabled>Select priority…</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wide">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newAi.dueDate}
                    onChange={(e) => setNewAi({ ...newAi, dueDate: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase tracking-wide">Task Notes</label>
                <textarea
                  rows={2}
                  value={newAi.notes}
                  onChange={(e) => setNewAi({ ...newAi, notes: e.target.value })}
                  placeholder="Additional context or requirements..."
                  className="w-full text-xs p-2.5 border rounded-lg focus:outline-none"
                />
              </div>

              {/* Active custom columns (hidden ones excluded) */}
              <CustomColumnFields
                columns={actionItemColumns}
                config={actionItemsColumnConfig}
                values={newAi}
                onChange={(key, value) => setNewAi({ ...newAi, [key]: value })}
              />

              </div>{/* end scrollable body */}
              {/* Actions Footer */}
              <div className="flex items-center justify-end space-x-2 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  Create Action Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingAi && (
        <InlineEditModal
          mode="actionItems"
          entity={editingAi}
          displayedConfigs={displayedConfigs}
          accounts={accounts}
          opportunities={opportunities}
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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-5">Title</th>
                <th className="py-2.5 px-4">Account</th>
                <th className="py-2.5 px-4">Owner</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {deactivatedActionItems.map((item) => {
                const acc = resolveAccount(item.accountId);
                return (
                  <tr key={item.id} className="border-b last:border-0 text-slate-500 font-medium opacity-70">
                    <td className="py-3 px-5 font-semibold text-slate-600 line-through decoration-slate-300">{item.title}</td>
                    <td className="py-3 px-4 text-slate-500">{item.accountName || acc?.name || '—'}</td>
                    <td className="py-3 px-4">{item.owner}</td>
                    <td className="py-3 px-4">
                      <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" muted />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} muted />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{item.dueDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
