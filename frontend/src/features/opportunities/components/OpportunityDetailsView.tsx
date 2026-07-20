/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Opportunity, OpportunityStage, PriorityLevel, ActionItem, ActionItemStatus } from '@/types';
import {
  Briefcase,
  Calendar,
  CheckSquare,
  DollarSign,
  Edit2,
  FileText,
  MessageSquare,
  MoreVertical,
  Plus,
  Trash2,
  Settings2,
  TrendingUp,
  X,
  Pencil,
} from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { InlineEditModal } from '@/components/InlineEditModal';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { OpportunityPipelineProgress } from './OpportunityPipelineProgress';
import { ACTION_ITEM_STATUS_OPTIONS, OPPORTUNITY_STAGE_OPTIONS, stageChangePatch } from '@/constants';
import {
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DetailHeaderCard,
  DetailTabBar,
  EmptyRow,
  FilterBar,
  FilterSelect,
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  Pagination,
  PRIORITY_COLORS,
  RowActionButton,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  STAGE_COLORS,
  StatusBadge,
  SummaryCard,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { compareForSort, getTodayISODate, isOpenActionItemStatus, SortDirection } from '@/utils';

type OppTab = 'overview' | 'action-items' | 'comments' | 'documents';

const SORTABLE_AI_FIELDS = new Set(['title', 'owner', 'priority', 'status', 'dueDate']);

export const OpportunityDetailsView: React.FC = () => {
  const {
    opportunities,
    accounts,
    actionItems,
    stakeholders,
    comments,
    selectedOpportunityId,
    setView,
    setSelectedAccountId,
    setSelectedOpportunityId,
    setFocusedRecord,
    updateOpportunity,
    deleteOpportunity,
    addComment,
    deleteComment,
    actionItemColumns,
    actionItemsColumnConfig,
    opportunitiesColumnConfig,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    oppDetailsSourceView,
    setOppDetailsSourceView,
    setAccountDetailsActiveTab,
    cameFromDashboard,
    navSource,
    dashboardStageHighlight,
    currentUser,
  } = useCRM();

  // Find current opportunity
  const opp = opportunities.find(o => o.id === selectedOpportunityId);
  const account = opp ? accounts.find(a => a.id === opp.accountId) : null;

  // Tab navigation + Documents tab count
  const [activeTab, setActiveTab] = useState<OppTab>('overview');
  const [docCount, setDocCount] = useState(0);

  const [commentText, setCommentText] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'actionItem' | 'comment' | 'opportunity'; id: string; label: string } | null>(null);

  // Header overflow actions menu
  const [showOppMenu, setShowOppMenu] = useState(false);

  // Customizable column sidebar & comment states for action items
  const [isColumnsSidebarOpen, setIsColumnsSidebarOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Action Items tab: search / filter / sort / pagination
  const [aiSearch, setAiSearch] = useState('');
  const [aiStatusFilter, setAiStatusFilter] = useState('all');
  const [aiPriorityFilter, setAiPriorityFilter] = useState('all');
  const [aiSortField, setAiSortField] = useState<string | null>(null);
  const [aiSortDirection, setAiSortDirection] = useState<SortDirection>('asc');
  const [aiPage, setAiPage] = useState(1);
  const [aiPageSize, setAiPageSize] = useState(10);

  const handleAiSort = (field: string) => {
    if (aiSortField === field) {
      setAiSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAiSortField(field);
      setAiSortDirection('asc');
    }
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

  // Close-out dialog: capturing the win/loss reason is required when a deal
  // transitions to Won or Lost (the backend rejects the change without one).
  const [closeDialog, setCloseDialog] = useState<{ outcome: 'Won' | 'Lost'; stage: OpportunityStage } | null>(null);
  const [closeReasonDraft, setCloseReasonDraft] = useState('');
  const [isClosingOpp, setIsClosingOpp] = useState(false);

  // Blocked/Delayed reason dialog — mirrors the Won/Lost close-out experience but
  // captures an *optional* reason into a dedicated field (blockedReason /
  // delayedReason), kept separate from Risks & Dependencies.
  const [stageReasonDialog, setStageReasonDialog] = useState<{ stage: 'Blocked' | 'Delayed' } | null>(null);
  const [stageReasonDraft, setStageReasonDraft] = useState('');
  const [isSavingStageReason, setIsSavingStageReason] = useState(false);

  // Edit Opportunity Modal state — shares InlineEditModal with the
  // Opportunities page and Account Detail view so all three entry points
  // render an identical edit experience.
  const [isEditOppModalOpen, setIsEditOppModalOpen] = useState(false);
  const [oppDraft, setOppDraft] = useState<Opportunity | null>(null);

  const openOppEdit = () => {
    if (!opp) return;
    setOppDraft({ ...opp });
    setIsEditOppModalOpen(true);
    setActiveTab('overview');
  };

  const handleSaveOpp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppDraft || !oppDraft.name.trim()) return;
    updateOpportunity(oppDraft);
    setIsEditOppModalOpen(false);
    setOppDraft(null);
  };

  // New action item modal state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const emptyTask: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
    openDate: getTodayISODate(),
    dueDate: '',
    priority: 'Medium' as PriorityLevel,
    status: 'To Do' as ActionItemStatus,
    notes: '',
    risksAndDependencies: ''
  };
  const [newAi, setNewAi] = useState<Omit<ActionItem, 'id'>>(emptyTask);

  const handleCreateAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAi.title.trim() || !opp) return;
    addActionItem({
      ...newAi,
      accountId: opp.accountId,
      opportunityId: opp.id,
    });
    setIsAddTaskOpen(false);
    setNewAi(emptyTask);
  };

  // Shared by the "no opportunity" fallback and by post-deactivation
  // navigation — both leave this view the same way the back button would.
  const goBackFromOpportunity = () => {
    if (oppDetailsSourceView === 'account-details') {
      setAccountDetailsActiveTab('opportunities');
      setView('account-details');
      setOppDetailsSourceView(null);
    } else {
      setView('opportunities');
    }
  };

  if (!opp || !account) {
    return (
      <Card padding="none">
        <div className="p-8 text-center">
          <p className="text-slate-400 font-medium">No opportunity selected.</p>
          <button
            onClick={goBackFromOpportunity}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Back
          </button>
        </div>
      </Card>
    );
  }

  // Filter actions & comments
  const oppActions = actionItems.filter(ai => ai.opportunityId === opp.id);
  const oppComments = comments.filter(c => c.targetType === 'opportunity' && c.targetId === opp.id);

  const stages: OpportunityStage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won'];
  const currentStageIdx = stages.indexOf(opp.stage);

  const formatCur = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment('opportunity', opp.id, commentText);
    setCommentText('');
  };

  // Action items: filter -> sort -> paginate
  const displayedActionCols = actionItemsColumnConfig.filter(col => col.isDisplayed);
  // User-added (non-standard) columns widen the table past the viewport and
  // trigger horizontal scroll; the default column set always fits the screen.
  const extraActionColCount = displayedActionCols.filter(col => !col.isStandard).length;
  const filteredActions = oppActions.filter(item => {
    const q = aiSearch.trim().toLowerCase();
    const matchesSearch = !q
      || item.title.toLowerCase().includes(q)
      || item.owner.toLowerCase().includes(q)
      || (item.notes ?? '').toLowerCase().includes(q);
    const matchesStatus = aiStatusFilter === 'all' || item.status === aiStatusFilter;
    const matchesPriority = aiPriorityFilter === 'all' || item.priority === aiPriorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const sortedActions = aiSortField
    ? [...filteredActions].sort((a, b) => compareForSort((a as any)[aiSortField], (b as any)[aiSortField], aiSortDirection))
    : filteredActions;
  const totalActions = sortedActions.length;
  const pagedActions = sortedActions.slice((aiPage - 1) * aiPageSize, aiPage * aiPageSize);

  return (
    <div className="space-y-6">
      {/* Dashboard breadcrumb */}
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />
          {dashboardStageHighlight && (
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-1.5 rounded-lg text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
              <span>Pipeline:</span>
              <span className="font-extrabold text-indigo-700">{dashboardStageHighlight}</span>
            </div>
          )}
        </div>
      )}

      {/* Back to Notifications / Audit Log */}
      {navSource && (
        <BackButton
          label={navSource === 'notifications' ? 'Back to Notifications' : 'Back to Audit Log'}
          onClick={() => setView(navSource === 'notifications' ? 'notifications' : 'audit-log')}
        />
      )}

      {/* Page Header — shared with Account Detail via DetailHeaderCard */}
      <DetailHeaderCard
        onBack={!navSource ? goBackFromOpportunity : undefined}
        backTitle={oppDetailsSourceView === 'account-details' ? 'Back to Account' : 'Back to Opportunities'}
        avatarContent={<TrendingUp className="w-6 h-6" aria-hidden="true" />}
        avatarColorClass="bg-indigo-50 text-indigo-600"
        title={opp.name}
        badges={<StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />}
        actions={
          <>
            {opp.stage !== 'Won' && opp.stage !== 'Lost' && (
              <Button
                variant="danger"
                icon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => {
                  setCloseReasonDraft(opp.closeReason || '');
                  setCloseDialog({ outcome: 'Lost', stage: opp.stage });
                }}
              >
                Mark Lost
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Edit2 className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={openOppEdit}
            >
              Edit Opportunity
            </Button>
            <div className="relative">
              <button
                onClick={() => setShowOppMenu(v => !v)}
                className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showOppMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowOppMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => {
                        setShowOppMenu(false);
                        setDeleteTarget({ type: 'opportunity', id: opp.id, label: opp.name });
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      Deactivate Opportunity
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        }
        attributes={[
          {
            icon: <Briefcase className="w-4 h-4" />,
            label: 'Account',
            value: (
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId(opp.accountId);
                  setView('account-details');
                }}
                title={`View account ${account.name}`}
                className="text-blue-600 hover:underline font-bold cursor-pointer truncate max-w-full text-left"
              >
                {account.name}
              </button>
            ),
          },
          { icon: <DollarSign className="w-4 h-4" />, label: 'CRM Value', mono: true, value: formatCur(opp.crmValue) },
          { icon: <TrendingUp className="w-4 h-4" />, label: 'Probability', mono: true, value: `${opp.probability}%` },
          { icon: <Calendar className="w-4 h-4" />, label: 'Expected Close Date', mono: true, value: opp.closeDate || 'N/A' },
        ]}
        attributesClassName="grid-cols-2 lg:grid-cols-4"
      />

      {/* Closed-deal banner: outcome, when, and the captured win/loss reason.
          Shown regardless of active tab since it's cross-cutting deal status. */}
      {(opp.stage === 'Won' || opp.stage === 'Lost') && (
        <div className={`flex flex-wrap items-start justify-between gap-3 p-4 rounded-xl border ${
          opp.stage === 'Won' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="min-w-0">
            <p className={`text-xs font-extrabold uppercase tracking-wide ${opp.stage === 'Won' ? 'text-emerald-700' : 'text-red-700'}`}>
              Closed as {opp.stage}
              {opp.closedAt && ` on ${new Date(opp.closedAt).toLocaleDateString()}`}
            </p>
            {opp.closeReason && (
              <p className="text-xs text-slate-600 mt-1">
                <span className="font-bold">{opp.stage === 'Won' ? 'Win reason' : 'Loss reason'}:</span> {opp.closeReason}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => updateOpportunity({
              ...opp,
              // A deal cannot stay Won/Lost while reopened — step it back to Negotiation.
              stage: 'Negotiation',
              closeReason: '',
            })}
          >
            Reopen Deal
          </Button>
        </div>
      )}

      {/* Navigation Tabs */}
      <DetailTabBar
        tabs={[
          { id: 'overview', label: 'Overview', icon: Briefcase, count: null },
          { id: 'action-items', label: 'Action Items', icon: CheckSquare, count: oppActions.length },
          { id: 'comments', label: 'Comments', icon: MessageSquare, count: oppComments.length },
          { id: 'documents', label: 'Documents', icon: FileText, count: docCount > 0 ? docCount : null },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as OppTab)}
      />

      {/* Dynamic Tab Contents */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Action Items"
                value={oppActions.length}
                icon={<CheckSquare className="w-4.5 h-4.5" />}
                tone="blue"
                description={oppActions.length === 0
                  ? 'No pending items'
                  : `${oppActions.filter(ai => isOpenActionItemStatus(ai.status)).length} pending`}
                actionLabel="View Details"
                onAction={() => setActiveTab('action-items')}
              />
              <SummaryCard
                label="Comments"
                value={oppComments.length}
                icon={<MessageSquare className="w-4.5 h-4.5" />}
                tone="purple"
                description={oppComments.length === 0 ? 'No comments yet' : 'Latest activity feed'}
                actionLabel="View Details"
                onAction={() => setActiveTab('comments')}
              />
              <SummaryCard
                label="Documents"
                value={docCount}
                icon={<FileText className="w-4.5 h-4.5" />}
                tone="indigo"
                description={docCount === 0 ? 'No documents' : 'Uploaded files'}
                actionLabel="View Details"
                onAction={() => setActiveTab('documents')}
              />
              <SummaryCard
                label="Deal Value"
                value={formatCur(opp.value)}
                icon={<DollarSign className="w-4.5 h-4.5" />}
                tone="emerald"
                description="Total deal value"
              />
            </div>

            {/* Pipeline Progress Card */}
            <Card
              title="Pipeline Progress"
              actions={
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                  {currentStageIdx === -1 ? (
                    <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />
                  ) : (
                    <span className="text-xs font-bold text-indigo-600 whitespace-nowrap">
                      {Math.round(((currentStageIdx + 1) / stages.length) * 100)}% Complete
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-label font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Update Stage:</label>
                    <select
                      value={opp.stage}
                      onChange={(e) => {
                        const stage = e.target.value as OpportunityStage;
                        if (stage === 'Won' || stage === 'Lost') {
                          // Winning/losing the deal captures a win/loss reason in the close-out dialog.
                          setCloseReasonDraft(opp.closeReason || '');
                          setCloseDialog({ outcome: stage, stage });
                        } else if (stage === 'Blocked' || stage === 'Delayed') {
                          // Blocked/Delayed capture an optional reason in a dedicated dialog.
                          setStageReasonDraft((stage === 'Blocked' ? opp.blockedReason : opp.delayedReason) || '');
                          setStageReasonDialog({ stage });
                        } else {
                          updateOpportunity({ ...opp, ...stageChangePatch(stage) });
                        }
                      }}
                      className="text-xs border border-slate-200 rounded-lg p-2 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {OPPORTUNITY_STAGE_OPTIONS.map(stg => (
                        <option key={stg} value={stg}>{stg}</option>
                      ))}
                    </select>
                  </div>
                </div>
              }
              padding="compact"
            >
              <OpportunityPipelineProgress
                stage={opp.stage}
                probability={opp.probability}
                closeReason={opp.closeReason}
                blockedReason={opp.blockedReason}
                delayedReason={opp.delayedReason}
              />
            </Card>

            {/* Opportunity Details & Scope — grouped into clearly separated sections;
                account/value/probability/owner already surface in the header and KPI
                cards above, so this card focuses on the detail that lives only here. */}
              <Card title="Opportunity Details & Scope" bodyClassName="space-y-6">
                <FormSection title="Timeline">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Start Date</span>
                      <span className="text-sm text-slate-800 font-mono font-semibold flex items-center">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" aria-hidden="true" />
                        {opp.startDate || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Expected Close Date</span>
                      <span className="text-sm text-slate-800 font-mono font-semibold flex items-center">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" aria-hidden="true" />
                        {opp.closeDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">SLA Target Value</span>
                      <span className="text-sm text-slate-800 font-mono font-semibold">{formatCur(opp.value)}</span>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Stakeholders">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {([
                      { label: 'Client Stakeholder', id: opp.clientStakeholderId, name: opp.clientStakeholderName, designation: opp.clientStakeholderDesignation },
                      { label: 'Service Provider Stakeholder', id: opp.serviceProviderStakeholderId, name: opp.serviceProviderStakeholderName, designation: opp.serviceProviderStakeholderDesignation },
                    ]).map(sh => (
                      <div key={sh.label} className="rounded-lg border border-slate-100 p-3.5 hover:border-slate-200 transition-colors">
                        <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{sh.label}</span>
                        {sh.id && sh.name ? (
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedRecord({ type: 'stakeholder', id: sh.id! });
                              setView('stakeholders');
                            }}
                            className="text-left cursor-pointer group"
                          >
                            <p className="text-sm text-blue-600 group-hover:underline font-semibold">{sh.name}</p>
                            {sh.designation && <p className="text-xs text-slate-500 font-medium mt-0.5">{sh.designation}</p>}
                          </button>
                        ) : (
                          <p className="text-sm text-slate-400 font-medium italic">Not assigned</p>
                        )}
                      </div>
                    ))}
                  </div>
                </FormSection>

                <FormSection title="Classification">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Opportunity Type</span>
                      <p className="text-sm text-slate-800 font-semibold">{opp.opportunityType}</p>
                    </div>
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Service Line</span>
                      <p className="text-sm text-slate-800 font-semibold">{opp.serviceLine || <span className="text-slate-400 font-medium italic">Not set</span>}</p>
                    </div>
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">AOP Planned</span>
                      <p className="text-sm text-slate-800 font-semibold">
                        {opp.aopAvailable ? `Yes${opp.aopYear ? ` (${opp.aopYear})` : ''}` : 'No'}
                      </p>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Scope & Risk">
                  <div className="space-y-4">
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Scope Description</span>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{opp.description}</p>
                    </div>
                    <div>
                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Risks & Dependencies</span>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">
                        {opp.risksAndDependencies || <span className="text-slate-400 font-medium italic">None noted</span>}
                      </p>
                    </div>
                  </div>
                </FormSection>
              </Card>
          </div>
        )}

        {activeTab === 'action-items' && (
          <div className="space-y-4">
            <FilterBar>
              <SearchBar
                value={aiSearch}
                onChange={(v) => { setAiSearch(v); setAiPage(1); }}
                placeholder="Search action items by title, owner, or notes..."
              />
              <FilterSelect
                label="Status"
                value={aiStatusFilter}
                onChange={(v) => { setAiStatusFilter(v); setAiPage(1); }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  ...ACTION_ITEM_STATUS_OPTIONS.map(s => ({ value: s, label: s })),
                ]}
              />
              <FilterSelect
                label="Priority"
                value={aiPriorityFilter}
                onChange={(v) => { setAiPriorityFilter(v); setAiPage(1); }}
                options={[
                  { value: 'all', label: 'All Priorities' },
                  { value: 'High', label: 'High' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'Low', label: 'Low' },
                ]}
              />
            </FilterBar>

            <Card
              padding="none"
              clip
              title={
                <span className="inline-flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-800 tracking-tight truncate">
                    Action Items ({oppActions.length})
                  </span>
                </span>
              }
              actions={
                <>
                  <Button
                    variant="secondary"
                    icon={<Settings2 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
                    onClick={() => setIsColumnsSidebarOpen(true)}
                  >
                    Customize Columns
                  </Button>
                  <Button
                    icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                    onClick={() => setIsAddTaskOpen(true)}
                  >
                    Add Task
                  </Button>
                </>
              }
            >
              <div className="overflow-x-auto">
                <Table extraColumns={extraActionColCount} resizable storageKey="opportunity-details:action-items">
                  <TableHead>
                    {displayedActionCols.map(col => (
                      <TableHeadCell
                        key={col.key}
                        columnId={col.key}
                        className={col.key === 'title' ? 'px-5' : ''}
                      >
                        {SORTABLE_AI_FIELDS.has(col.key) ? (
                          <SortableHeader
                            label={col.name}
                            field={col.key}
                            sortField={aiSortField}
                            sortDirection={aiSortDirection}
                            onSort={handleAiSort}
                          />
                        ) : (
                          col.name
                        )}
                      </TableHeadCell>
                    ))}
                    <TableHeadCell align="center" sticky="right">Delete</TableHeadCell>
                  </TableHead>
                  <tbody>
                      {pagedActions.length === 0 ? (
                        <EmptyRow
                          colSpan={displayedActionCols.length + 1}
                          message={oppActions.length === 0
                            ? 'No action items linked to this opportunity. Click "Add Task" to create one.'
                            : 'No action items match your search or filters.'}
                        />
                      ) : (
                        pagedActions.map(item => {
                          const itemComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === item.id);
                          return (
                            <React.Fragment key={item.id}>
                              <TableRow className="hover:bg-slate-50/50">
                                {displayedActionCols.map(col => {
                                  if (col.key === 'title') {
                                    return (
                                      <TableCell key={col.key}>
                                        <div className="flex items-center flex-wrap gap-1">
                                          <div className="flex-1">
                                            <p className="font-extrabold text-slate-900 text-sm">{item.title}</p>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedItemId(expandedItemId === item.id ? null : item.id);
                                            }}
                                            aria-expanded={expandedItemId === item.id}
                                            aria-label="Toggle comments"
                                            className={`inline-flex items-center space-x-1 ml-2 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                              expandedItemId === item.id
                                                ? 'bg-blue-100 text-blue-700 font-bold'
                                                : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                                            }`}
                                          >
                                            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span className="text-[10px] font-bold">{itemComments.length}</span>
                                          </button>
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
                                  if (col.key === 'accountId') {
                                    return (
                                      <TableCell key={col.key} className="text-slate-600 font-bold">
                                        {account ? account.name : 'Unknown Account'}
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
                                  <div className="flex items-center justify-center space-x-1">
                                    <RowActionButton
                                      intent="edit"
                                      label={`Edit action item ${item.title}`}
                                      icon={<Pencil className="w-3.5 h-3.5" />}
                                      onClick={() => handleEditClick(item)}
                                    />
                                    <RowActionButton
                                      intent="delete"
                                      label={`Delete action item ${item.title}`}
                                      icon={<Trash2 className="w-3.5 h-3.5" />}
                                      onClick={() => setDeleteTarget({ type: 'actionItem', id: item.id, label: item.title })}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>

                              {expandedItemId === item.id && (
                                <tr className="bg-slate-50/70 border-b border-slate-200">
                                  <td colSpan={displayedActionCols.length + 1} className="p-4">
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
                                          className={`flex-1 ${INPUT_CLS}`}
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
                        })
                      )}
                    </tbody>
                </Table>
              </div>
              <Pagination
                page={aiPage}
                pageSize={aiPageSize}
                totalItems={totalActions}
                onPageChange={setAiPage}
                onPageSizeChange={(size) => { setAiPageSize(size); setAiPage(1); }}
                itemLabel="action items"
              />
            </Card>
          </div>
        )}

        {activeTab === 'comments' && (
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold text-slate-800 tracking-tight truncate">
                  Opportunity Comments ({oppComments.length})
                </span>
              </span>
            }
            bodyClassName="space-y-4"
          >
            <form onSubmit={handlePostComment} className="flex space-x-3 items-end">
              <div className="flex-1 space-y-1">
                <textarea
                  rows={2}
                  required
                  placeholder="Type an executive comment or update..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className={`w-full ${INPUT_CLS} resize-none`}
                />
              </div>
              <Button type="submit" className="shrink-0">
                Post Comment
              </Button>
            </form>

            {/* Fixed height + internal scroll: posting a comment never grows the panel */}
            <div className="h-[360px] overflow-y-auto pr-2 space-y-4 border-t border-slate-100 pt-4">
              {oppComments.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium italic">No comments posted yet. Start the dialogue above.</p>
              ) : (
                oppComments.map(c => (
                  <div key={c.id} className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-2 relative group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-700">{c.user}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.timestamp}</span>
                      </div>
                      <button
                        onClick={() => setDeleteTarget({ type: 'comment', id: c.id, label: c.text.substring(0, 40) })}
                        className="text-slate-300 hover:text-red-500 hidden group-hover:block cursor-pointer transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === 'documents' && (
          <DocumentsPanel
            target={{ opportunityId: opp.id }}
            entityLabel="opportunity"
            currentUser={currentUser}
            onCountChange={setDocCount}
          />
        )}
      </div>

      {/* Edit Opportunity Modal — same InlineEditModal used by the Opportunities
          page and Account Detail view, so all three entry points match. */}
      {isEditOppModalOpen && oppDraft && (
        <InlineEditModal
          mode="opportunities"
          entity={oppDraft}
          displayedConfigs={opportunitiesColumnConfig.filter(c => c.isDisplayed)}
          accounts={accounts}
          opportunities={opportunities}
          stakeholders={stakeholders}
          onChange={(patch) => setOppDraft({ ...oppDraft, ...patch })}
          onSave={handleSaveOpp}
          onCancel={() => { setIsEditOppModalOpen(false); setOppDraft(null); }}
        />
      )}

      {/* Edit Action Item Modal */}
      {isEditModalOpen && editingAi && (
        <InlineEditModal
          mode="actionItems"
          entity={editingAi}
          displayedConfigs={actionItemsColumnConfig.filter(c => c.isDisplayed)}
          accounts={accounts}
          opportunities={opportunities}
          stakeholders={stakeholders}
          onChange={(patch) => setEditingAi({ ...editingAi, ...patch })}
          onSave={handleUpdateActionItem}
          onCancel={() => { setIsEditModalOpen(false); setEditingAi(null); }}
        />
      )}

      {/* Sidebars & Modals */}
      <CustomizeColumnsSidebar
        module="actionItems"
        isOpen={isColumnsSidebarOpen}
        onClose={() => setIsColumnsSidebarOpen(false)}
      />

      {/* New Action Item Modal */}
      <FormModal
        isOpen={isAddTaskOpen}
        title="Create Deliverable Task"
        icon={<CheckSquare className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        onClose={() => setIsAddTaskOpen(false)}
        onSubmit={handleCreateAddTask}
        submitLabel="Create Task"
        maxWidth="max-w-4xl"
      >
        <FormGrid columns={3}>
          <FormField label="Task Title" required>
            <input
              type="text"
              required
              value={newAi.title}
              onChange={(e) => setNewAi({ ...newAi, title: e.target.value })}
              placeholder="e.g., Deliver SLA Agreement Draft"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Task Owner">
            <input
              type="text"
              value={newAi.owner}
              onChange={(e) => setNewAi({ ...newAi, owner: e.target.value })}
              placeholder="e.g., John Smith"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Priority">
            <select
              value={newAi.priority}
              onChange={(e) => setNewAi({ ...newAi, priority: e.target.value as PriorityLevel })}
              className={SELECT_CLS}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </FormField>

          <FormField label="Status">
            <select
              value={newAi.status}
              onChange={(e) => setNewAi({ ...newAi, status: e.target.value as ActionItemStatus })}
              className={SELECT_CLS}
            >
              {ACTION_ITEM_STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Open Date" required>
            <input
              type="date"
              required
              value={newAi.openDate}
              onChange={(e) => setNewAi({ ...newAi, openDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>

          <FormField label="Due Date" required>
            <input
              type="date"
              required
              value={newAi.dueDate}
              onChange={(e) => setNewAi({ ...newAi, dueDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>

          <FormField label="Task Details" wide>
            <textarea
              rows={2}
              value={newAi.notes}
              onChange={(e) => setNewAi({ ...newAi, notes: e.target.value })}
              placeholder="Additional operational context..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>

          <FormField label="Risks & Dependencies" wide>
            <textarea
              rows={2}
              value={newAi.risksAndDependencies}
              onChange={(e) => setNewAi({ ...newAi, risksAndDependencies: e.target.value })}
              placeholder="e.g., Pending budget approval, dependent on vendor SOW sign-off"
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </FormGrid>

        <CustomColumnFields
          columns={actionItemColumns}
          config={actionItemsColumnConfig}
          values={newAi}
          onChange={(key, value) => setNewAi({ ...newAi, [key]: value })}
        />
      </FormModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.type === 'comment' ? 'Delete Comment' :
          deleteTarget?.type === 'opportunity' ? 'Delete Opportunity' :
          'Delete Action Item'
        }
        message={
          deleteTarget?.type === 'opportunity'
            ? <>Deactivate opportunity <span className="font-bold">"{deleteTarget.label}"</span>? It will move to the Deactivated section.</>
            : deleteTarget
              ? <>Delete <span className="font-bold">"{deleteTarget.label}"</span>? This cannot be undone.</>
              : undefined
        }
        confirmLabel={deleteTarget?.type === 'opportunity' ? 'Deactivate' : 'Delete'}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'actionItem') await deleteActionItem(deleteTarget.id);
          else if (deleteTarget.type === 'opportunity') {
            await deleteOpportunity(deleteTarget.id);
            setDeleteTarget(null);
            goBackFromOpportunity();
            return;
          } else await deleteComment(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Close-out dialog — a Won/Lost transition always captures its reason */}
      <FormModal
        isOpen={!!closeDialog}
        title={closeDialog?.outcome === 'Won' ? 'Close Opportunity as Won' : 'Close Opportunity as Lost'}
        onClose={() => setCloseDialog(null)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!closeDialog) return;
          // The win/loss reason is optional — captured when provided.
          setIsClosingOpp(true);
          try {
            await updateOpportunity({
              ...opp,
              // The close target is the chosen outcome (Won/Lost) regardless of
              // entry point; deriving the stage + default probability from it
              // keeps the header "Mark Lost" and the stage dropdown consistent.
              ...stageChangePatch(closeDialog.outcome),
              closeReason: closeReasonDraft.trim(),
            });
            setCloseDialog(null);
          } finally {
            setIsClosingOpp(false);
          }
        }}
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

      {/* Blocked/Delayed reason dialog — optional reason, kept independent of
          Risks & Dependencies. Same UX pattern as the Won/Lost close-out. */}
      <FormModal
        isOpen={!!stageReasonDialog}
        title={stageReasonDialog?.stage === 'Blocked' ? 'Mark Opportunity as Blocked' : 'Mark Opportunity as Delayed'}
        onClose={() => setStageReasonDialog(null)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!stageReasonDialog) return;
          setIsSavingStageReason(true);
          try {
            await updateOpportunity({
              ...opp,
              stage: stageReasonDialog.stage,
              ...(stageReasonDialog.stage === 'Blocked'
                ? { blockedReason: stageReasonDraft.trim() }
                : { delayedReason: stageReasonDraft.trim() }),
            });
            setStageReasonDialog(null);
          } finally {
            setIsSavingStageReason(false);
          }
        }}
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
    </div>
  );
};
