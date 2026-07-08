/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { OpportunityStage, PriorityLevel, ActionItem, ActionItemStatus } from '@/types';
import {
  Calendar,
  TrendingUp,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  Settings2,
  X,
  Pencil,
  Edit2,
  Save
} from 'lucide-react';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { InlineEditModal } from '@/components/InlineEditModal';
import { NumberInput } from '@/components/NumberInput';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import {
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  ConfirmDialog,
  EmptyRow,
  FormField,
  FormGrid,
  FormModal,
  INPUT_CLS,
  OPPORTUNITY_STATUS_COLORS,
  PRIORITY_COLORS,
  RowActionButton,
  SELECT_CLS,
  STAGE_COLORS,
  StatusBadge,
} from '@/components/ui';

export const OpportunityDetailsView: React.FC = () => {
  const {
    opportunities,
    accounts,
    actionItems,
    comments,
    selectedOpportunityId,
    setView,
    setSelectedOpportunityId,
    updateOpportunity,
    addComment,
    deleteComment,
    actionItemColumns,
    actionItemsColumnConfig,
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

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'comments'>('overview');
  const [commentText, setCommentText] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'actionItem' | 'comment'; id: string; label: string } | null>(null);

  // Customizable column sidebar & comment states for action items
  const [isColumnsSidebarOpen, setIsColumnsSidebarOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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

  // Opportunity inline edit state
  const [isEditingOpp, setIsEditingOpp] = useState(false);
  const [isSavingOpp, setIsSavingOpp] = useState(false);
  const [oppDraft, setOppDraft] = useState({
    name: '', stage: 'Lead' as OpportunityStage, value: 0, probability: 0,
    owner: '', startDate: '', closeDate: '', description: '',
  });

  const openOppEdit = () => {
    if (!opp) return;
    setOppDraft({
      name: opp.name,
      stage: opp.stage,
      value: opp.value,
      probability: opp.probability,
      owner: opp.owner,
      startDate: opp.startDate || '',
      closeDate: opp.closeDate || '',
      description: opp.description || '',
    });
    setIsEditingOpp(true);
  };

  const handleSaveOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opp) return;
    setIsSavingOpp(true);
    try {
      await updateOpportunity({ ...opp, ...oppDraft });
    } finally {
      setIsSavingOpp(false);
      setIsEditingOpp(false);
    }
  };

  // New action item modal state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const emptyTask: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
    dueDate: '',
    priority: 'Medium' as PriorityLevel,
    status: 'Not Started' as ActionItemStatus,
    notes: ''
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

  if (!opp || !account) {
    return (
      <div className="bg-white p-8 text-center rounded-xl border border-slate-200">
        <p className="text-slate-400 font-medium">No opportunity selected.</p>
        <button
          onClick={() => {
            if (oppDetailsSourceView === 'account-details') {
              setAccountDetailsActiveTab('opportunities');
              setView('account-details');
              setOppDetailsSourceView(null);
            } else {
              setView('opportunities');
            }
          }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Back
        </button>
      </div>
    );
  }

  // Filter actions & comments
  const oppActions = actionItems.filter(ai => ai.opportunityId === opp.id);
  const oppComments = comments.filter(c => c.targetType === 'opportunity' && c.targetId === opp.id);

  const stages: OpportunityStage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
  const currentStageIdx = stages.indexOf(opp.stage);

  const formatCur = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment('opportunity', opp.id, commentText);
    setCommentText('');
  };

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

      {/* Header Card: identity, quick actions, and pipeline progress */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            {!navSource && (
              <BackButton
                label={oppDetailsSourceView === 'account-details' ? 'Back to Account' : 'Back'}
                onClick={() => {
                  if (oppDetailsSourceView === 'account-details') {
                    setAccountDetailsActiveTab('opportunities');
                    setView('account-details');
                    setOppDetailsSourceView(null);
                  } else {
                    setView('opportunities');
                  }
                }}
              />
            )}
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight border-l-4 border-blue-600 pl-3">{opp.name}</h2>
                <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} />
                <StatusBadge value={opp.status ?? 'Open'} colorMap={OPPORTUNITY_STATUS_COLORS} />
              </div>
              <p className="text-xs text-slate-400 font-semibold font-mono uppercase tracking-widest">
                Associated Account:{' '}
                <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => setView('account-details')}>
                  {account.name}
                </span>
              </p>
            </div>
          </div>

          {/* Stage quick transitions + Edit */}
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-500 mr-2 uppercase tracking-wide">Update Stage:</label>
              <select
                value={opp.stage}
                onChange={(e) => {
                  const stage = e.target.value as OpportunityStage;
                  if (stage === 'Won' && opp.status !== 'Won') {
                    // Winning the deal requires a win reason — captured in the close-out dialog.
                    setCloseReasonDraft(opp.closeReason || '');
                    setCloseDialog({ outcome: 'Won', stage });
                  } else {
                    updateOpportunity({ ...opp, stage });
                  }
                }}
                className="text-xs border border-slate-200 rounded-lg p-2 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {stages.map(stg => (
                  <option key={stg} value={stg}>{stg}</option>
                ))}
              </select>
            </div>
            {opp.status === 'Open' && (
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
              variant={isEditingOpp ? 'secondary' : 'primary'}
              icon={<Edit2 className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={isEditingOpp ? () => setIsEditingOpp(false) : openOppEdit}
            >
              {isEditingOpp ? 'Cancel' : 'Edit Opportunity'}
            </Button>
          </div>
        </div>

        {/* Pipeline progress stepper */}
        <div className="pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pipeline Progress</span>
            <span className="text-xs font-bold text-indigo-600">
              {Math.round(((currentStageIdx + 1) / stages.length) * 100)}% Complete
            </span>
          </div>
          <div className="overflow-hidden h-2 rounded-full bg-slate-100">
            <div
              style={{ width: `${((currentStageIdx + 1) / stages.length) * 100}%` }}
              className="h-full bg-indigo-600 transition-all duration-300"
            />
          </div>
          <div className="grid grid-cols-5 mt-2 text-center text-[10px] font-bold text-slate-400 select-none">
            {stages.map((stg, i) => {
              const isPastOrCurrent = i <= currentStageIdx;
              return (
                <span key={stg} className={isPastOrCurrent ? 'text-indigo-600 font-bold' : 'font-medium'}>
                  {stg}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Closed-deal banner: outcome, when, and the captured win/loss reason */}
      {(opp.status === 'Won' || opp.status === 'Lost') && (
        <div className={`flex flex-wrap items-start justify-between gap-3 p-4 rounded-xl border ${
          opp.status === 'Won' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="min-w-0">
            <p className={`text-xs font-extrabold uppercase tracking-wide ${opp.status === 'Won' ? 'text-emerald-700' : 'text-red-700'}`}>
              Closed as {opp.status}
              {opp.closedAt && ` on ${new Date(opp.closedAt).toLocaleDateString()}`}
            </p>
            {opp.closeReason && (
              <p className="text-xs text-slate-600 mt-1">
                <span className="font-bold">{opp.status === 'Won' ? 'Win reason' : 'Loss reason'}:</span> {opp.closeReason}
              </p>
            )}
          </div>
          <button
            onClick={() => updateOpportunity({
              ...opp,
              status: 'Open',
              // A deal cannot sit in the Won stage while open — step it back.
              stage: opp.stage === 'Won' ? 'Negotiation' : opp.stage,
              closeReason: '',
            })}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            Reopen Deal
          </button>
        </div>
      )}

      {/* 1. Details & Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
        {isEditingOpp ? (
          <form onSubmit={handleSaveOpp} className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                Edit Opportunity
              </h4>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Opportunity Name</label>
              <input
                type="text"
                required
                value={oppDraft.name}
                onChange={(e) => setOppDraft({ ...oppDraft, name: e.target.value })}
                className={INPUT_CLS}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stage</label>
                <select
                  value={oppDraft.stage}
                  onChange={(e) => setOppDraft({ ...oppDraft, stage: e.target.value as OpportunityStage })}
                  className={SELECT_CLS}
                >
                  <option value="Lead">Lead</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Won">Won</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Probability (%)</label>
                <NumberInput
                  min={0}
                  max={100}
                  value={oppDraft.probability}
                  onValueChange={(v) => setOppDraft({ ...oppDraft, probability: v })}
                  placeholder="0–100"
                  className={`${INPUT_CLS} font-mono`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Owner</label>
                <input
                  type="text"
                  value={oppDraft.owner}
                  onChange={(e) => setOppDraft({ ...oppDraft, owner: e.target.value })}
                  placeholder="e.g., John Smith"
                  className={INPUT_CLS}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deal Value ($)</label>
                <NumberInput
                  min={0}
                  required
                  value={oppDraft.value}
                  onValueChange={(v) => setOppDraft({ ...oppDraft, value: v })}
                  placeholder="e.g. 50000"
                  className={`${INPUT_CLS} font-mono`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={oppDraft.startDate}
                  onChange={(e) => setOppDraft({ ...oppDraft, startDate: e.target.value })}
                  className={`${INPUT_CLS} font-mono`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Close Date</label>
                <input
                  type="date"
                  value={oppDraft.closeDate}
                  onChange={(e) => setOppDraft({ ...oppDraft, closeDate: e.target.value })}
                  className={`${INPUT_CLS} font-mono`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Scope Description</label>
              <textarea
                rows={3}
                value={oppDraft.description}
                onChange={(e) => setOppDraft({ ...oppDraft, description: e.target.value })}
                className={`${INPUT_CLS} resize-none`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <Button variant="secondary" type="button" onClick={() => setIsEditingOpp(false)}>
                Cancel
              </Button>
              <Button
                variant="warning"
                type="submit"
                disabled={isSavingOpp}
                icon={<Save className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {isSavingOpp ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h4 className="font-extrabold text-slate-800 text-sm tracking-tight border-b border-slate-100 pb-2">
              Opportunity Details & Scope
            </h4>

            {/* Financial stats summary card integrated */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 shadow-inner">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Client</p>
                <p className="text-xs font-extrabold text-slate-800 truncate">{account.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deal Value</p>
                <p className="text-xs font-extrabold text-slate-900 font-mono">{formatCur(opp.value)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CRM Value</p>
                <p className="text-xs font-extrabold text-slate-700 font-mono">{formatCur(opp.crmValue)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Probability</p>
                <p className="text-xs font-extrabold text-indigo-600 font-mono">{opp.probability}%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Owner</p>
                <p className="text-xs font-extrabold text-slate-800">{opp.owner}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 px-1">
              <div className="space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">Start Date</span>
                <span className="text-slate-800 font-mono font-bold flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" aria-hidden="true" />
                  {opp.startDate || 'N/A'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">Expected Close Date</span>
                <span className="text-slate-800 font-mono font-bold flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" aria-hidden="true" />
                  {opp.closeDate}
                </span>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">SLA Target Value</span>
                <span className="text-slate-800 font-mono font-bold">{formatCur(opp.value)}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block mb-1">Scope Description</span>
              <p className="text-slate-600 leading-relaxed font-medium">{opp.description}</p>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <DocumentsPanel
          target={{ opportunityId: opp.id }}
          entityLabel="opportunity"
          currentUser={currentUser}
        />
      </div>
      </div>

      {/* 2. Action Item Table (Full Width) */}
      <div className="w-full bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-blue-600" aria-hidden="true" />
            <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">
              Action Items ({oppActions.length})
            </h4>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
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
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200/80 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  {actionItemsColumnConfig.filter(col => col.isDisplayed).map(col => (
                    <th
                      key={col.key}
                      className={`py-2.5 px-4 font-bold uppercase tracking-wider ${col.key === 'title' ? 'px-5' : ''}`}
                    >
                      {col.name}
                    </th>
                  ))}
                  <th className="py-2.5 px-5 text-center">Delete</th>
                </tr>
              </thead>
              <tbody>
                {oppActions.length === 0 ? (
                  <EmptyRow
                    colSpan={actionItemsColumnConfig.filter(col => col.isDisplayed).length + 1}
                    message='No action items linked to this opportunity. Click "Add Task" to create one.'
                  />
                ) : (
                  oppActions.map(item => {
                    const itemComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <tr className="border-b last:border-0 hover:bg-slate-50/50 text-slate-800 font-medium">
                          {actionItemsColumnConfig.filter(col => col.isDisplayed).map(col => {
                            if (col.key === 'title') {
                              return (
                                <td key={col.key} className="py-3 px-5">
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
                                </td>
                              );
                            }
                            if (col.key === 'notes') {
                              return (
                                <td key={col.key} className="py-3 px-4 text-slate-600 font-medium">
                                  {item.notes || '—'}
                                </td>
                              );
                            }
                            if (col.key === 'accountId') {
                              return (
                                <td key={col.key} className="py-3 px-4 text-slate-600 font-bold">
                                  {account ? account.name : 'Unknown Account'}
                                </td>
                              );
                            }
                            if (col.key === 'owner') {
                              return (
                                <td key={col.key} className="py-3 px-4 text-slate-600 font-semibold">
                                  {item.owner}
                                </td>
                              );
                            }
                            if (col.key === 'priority') {
                              return (
                                <td key={col.key} className="py-3 px-4">
                                  <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                                </td>
                              );
                            }
                            if (col.key === 'status') {
                              return (
                                <td key={col.key} className="py-3 px-4">
                                  <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
                                </td>
                              );
                            }
                            if (col.key === 'dueDate') {
                              return (
                                <td key={col.key} className="py-3 px-4 font-mono font-medium text-slate-500">
                                  {item.dueDate}
                                </td>
                              );
                            }

                            const rawVal = item[col.key] ?? (col.type === 'boolean' ? false : '');
                            return (
                              <td key={col.key} className="py-3 px-4">
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
                          <td className="py-3 px-5 text-center">
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
                          </td>
                        </tr>

                        {expandedItemId === item.id && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={actionItemsColumnConfig.filter(col => col.isDisplayed).length + 1} className="p-4">
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
                                  <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0 shadow-sm"
                                  >
                                    Add Comment
                                  </button>
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
            </table>
          </div>
        </div>
      </div>

      {/* 3. Comments (fixed-height panel, full width) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h4 className="font-extrabold text-slate-800 text-sm tracking-tight border-b border-slate-100 pb-2 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" aria-hidden="true" />
          <span>Corporate Governance Comments ({oppComments.length})</span>
        </h4>

        <form onSubmit={handlePostComment} className="flex space-x-3 items-end">
          <div className="flex-1 space-y-1">
            <textarea
              rows={2}
              required
              placeholder="Type an executive comment, update, or governance alert..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className={`w-full ${INPUT_CLS} resize-none`}
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 transition-all shadow-md"
          >
            Post Comment
          </button>
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
      </div>

      {/* Edit Action Item Modal */}
      {isEditModalOpen && editingAi && (
        <InlineEditModal
          mode="actionItems"
          entity={editingAi}
          displayedConfigs={actionItemsColumnConfig.filter(c => c.isDisplayed)}
          accounts={accounts}
          opportunities={opportunities}
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
        maxWidth="max-w-md"
      >
        <FormGrid>
          <FormField label="Task Title" required wide>
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

          <FormField label="Due Date" required wide>
            <input
              type="date"
              required
              value={newAi.dueDate}
              onChange={(e) => setNewAi({ ...newAi, dueDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>

          <FormField label="Task Notes" wide>
            <textarea
              rows={2}
              value={newAi.notes}
              onChange={(e) => setNewAi({ ...newAi, notes: e.target.value })}
              placeholder="Additional operational context..."
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
        title={deleteTarget?.type === 'comment' ? 'Delete Comment' : 'Delete Action Item'}
        message={deleteTarget ? <>Delete <span className="font-bold">"{deleteTarget.label}"</span>? This cannot be undone.</> : undefined}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'actionItem') await deleteActionItem(deleteTarget.id);
          else await deleteComment(deleteTarget.id);
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
          if (!closeReasonDraft.trim() || !closeDialog) return;
          setIsClosingOpp(true);
          try {
            await updateOpportunity({
              ...opp,
              stage: closeDialog.stage,
              status: closeDialog.outcome,
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
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
            {closeDialog?.outcome === 'Won' ? 'Win Reason' : 'Loss Reason'} <span className="text-red-500">*</span>
          </label>
          <textarea
            autoFocus
            required
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
    </div>
  );
};
