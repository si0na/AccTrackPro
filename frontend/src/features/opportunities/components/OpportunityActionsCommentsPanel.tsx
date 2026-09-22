/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionItemQuickPanel } from '@/features/action-items/components/ActionItemQuickPanel';
import { ActionItemOwnerField } from '@/components/ActionItemOwnerField';
import { ActionItemCommentToggle, ActionItemCommentsExpandedRow } from '@/components/ActionItemComments';
import { CommentCard } from '@/components/CommentCard';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import {
  Opportunity,
  ActionItem,
  Comment,
  PriorityLevel,
  ActionItemStatus,
  ActionItemType,
} from '@/types';
import { ACTION_ITEM_STATUS_OPTIONS, ACTION_ITEM_TYPE_OPTIONS } from '@/constants';
import { getTodayISODate, cleanOwnerName } from '@/utils';
import {
  AlertTriangle,
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  AlertCircle,
  ListTodo,
  ShieldAlert,
  Link2,
  FileText,
  Edit,
  Save,
  Building2,
  Pencil,
  Check,
} from 'lucide-react';
import {
  ConfirmDialog,
  PRIORITY_COLORS,
  ACTION_STATUS_COLORS,
  STAGE_COLORS,
  StatusBadge,
  RowActionButton,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';

interface PanelProps {
  opportunityId: string;
  onClose?: () => void;
}

const RISK_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  Mitigated: 'bg-blue-100 text-blue-700',
  Closed: 'bg-green-100 text-green-700',
  Accepted: 'bg-slate-100 text-slate-600',
};

const DEPENDENCY_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
};



export const OpportunityActionsCommentsPanel: React.FC<PanelProps> = ({ opportunityId, onClose }) => {
  const {
    opportunities,
    actionItems,
    comments,
    accounts,
    stakeholders,
    projects,
    updateOpportunity,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    addComment,
    updateComment,
    deleteComment,
    actionItemColumns,
    actionItemsColumnConfig,
    currentUser,
  } = useCRM();

  // Target opportunity & account
  const opp = opportunities.find(o => o.id === opportunityId);
  const isWon = false;
  const account = opp ? accounts.find(a => a.id === opp.accountId) : null;
  const linkedProject = opp ? projects.find(p => p.opportunityId === opp.id) : null;

  // Expanded Action Item row for inline comments
  const [expandedActionItemId, setExpandedActionItemId] = useState<string | null>(null);

  // Opportunity details edit state
  const [isEditingOppDetails, setIsEditingOppDetails] = useState(false);
  const [oppEditForm, setOppEditForm] = useState<Partial<Opportunity>>({});

  // Delete confirmation state — covers action items and comments
  const [deleteActionTarget, setDeleteActionTarget] = useState<{ type: 'actionItem' | 'comment'; id: string; label: string } | null>(null);

  // Selected Action Item for Quick Panel
  const [selectedActionItemId, setSelectedActionItemId] = useState<string | null>(null);

  // Risks & Dependencies editable state
  const [risksValue, setRisksValue] = useState(opp?.risksAndDependencies || '');

  React.useEffect(() => {
    setRisksValue(opp?.risksAndDependencies || '');
  }, [opp?.risksAndDependencies]);

  const handleRisksBlur = async () => {
    if (opp && risksValue !== (opp.risksAndDependencies || '')) {
      await updateOpportunity({
        ...opp,
        risksAndDependencies: risksValue,
      });
    }
  };

  // Form states
  const [commentText, setCommentText] = useState('');
  const [showAddAction, setShowAddAction] = useState(false);
  
  // New Action Item state
  const emptyAction: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    ownerStakeholderId: '',
    openDate: getTodayISODate(),
    dueDate: '',
    priority: 'Medium' as PriorityLevel,
    status: 'To Do' as ActionItemStatus,
    notes: '',
    risksAndDependencies: ''
  };
  const [newAction, setNewAction] = useState<Omit<ActionItem, 'id'>>(emptyAction);

  if (!opp || !account) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Select an opportunity to view its corresponding quick panel.</span>
      </div>
    );
  }

  // Filter corresponding items
  const oppActions = actionItems.filter(ai => ai.opportunityId === opp.id);
  const oppComments = comments.filter(c => c.targetType === 'opportunity' && c.targetId === opp.id);

  const ownerName = stakeholders.find(s => s.id === opp.serviceProviderStakeholderId)?.name || 'Unassigned';

  // Add Comment Handler
  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment('opportunity', opp.id, commentText);
    setCommentText('');
  };

  // Add Action Item Handler
  const handleCreateAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.title.trim() || !newAction.ownerStakeholderId) return;

    addActionItem({
      ...newAction,
      accountId: opp.accountId,
      opportunityId: opp.id,
    });

    setNewAction(emptyAction);
    setShowAddAction(false);
  };



  return (
    <div className="bg-white h-screen max-h-screen flex flex-col space-y-0" id="opp-actions-comments-panel">
      {/* Panel Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Selected Deal
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-300 font-semibold">{account.name}</span>
          </div>
          <h3 className="text-base font-extrabold tracking-tight">{opp.name}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Panel Scrollable Content — Consolidated View:
          1. Opportunity Details
          2. Action Items
          3. Comments
          4. Risks
          5. Dependencies
      */}
      <div className="flex flex-col divide-y divide-slate-200 flex-1 overflow-y-auto">
        
        {/* SECTION 1: Opportunity Details */}
        <div className="p-5 space-y-4 bg-slate-50/40">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Opportunity Details</h4>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isEditingOppDetails) {
                  updateOpportunity({ ...opp, ...oppEditForm });
                } else {
                  setOppEditForm({
                    stage: opp.stage,
                    probability: opp.probability,
                    value: opp.value,
                    serviceLine: opp.serviceLine,
                    allocationStartDate: opp.allocationStartDate,
                    allocationEndDate: opp.allocationEndDate,
                    description: opp.description,
                  });
                }
                setIsEditingOppDetails(!isEditingOppDetails);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
            >
              {isEditingOppDetails ? (
                <>
                  <Save className="w-3.5 h-3.5 text-green-600" />
                  <span>Save Details</span>
                </>
              ) : (
                <>
                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Details</span>
                </>
              )}
            </button>
          </div>

          {isEditingOppDetails ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Stage</label>
                <select
                  value={oppEditForm.stage}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, stage: e.target.value as any })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-semibold text-slate-800"
                >
                  {Object.keys(STAGE_COLORS).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Probability (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={oppEditForm.probability ?? 0}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, probability: Number(e.target.value) })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Deal Size ($)</label>
                <input
                  type="number"
                  value={oppEditForm.value ?? 0}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, value: Number(e.target.value) })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Service Line</label>
                <input
                  type="text"
                  value={oppEditForm.serviceLine || ''}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, serviceLine: e.target.value as any })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Expected Project Start Date</label>
                <input
                  type="date"
                  value={oppEditForm.allocationStartDate || ''}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, allocationStartDate: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Expected Project End Date</label>
                <input
                  type="date"
                  value={oppEditForm.allocationEndDate || ''}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, allocationEndDate: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                <textarea
                  rows={2}
                  value={oppEditForm.description || ''}
                  onChange={(e) => setOppEditForm({ ...oppEditForm, description: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account</span>
                <span className="text-xs font-extrabold text-slate-800 truncate block" title={account.name}>{account.name}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stage</span>
                <div>
                  <StatusBadge value={opp.stage} colorMap={STAGE_COLORS} shape="rounded" />
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deal Size</span>
                <span className="text-xs font-mono font-extrabold text-slate-900 block">${(opp.value || 0).toLocaleString()}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Probability</span>
                <span className="text-xs font-mono font-bold text-blue-700 block">{opp.probability}%</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                <span className="text-xs font-semibold text-slate-700 block">{opp.opportunityType || '—'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Line</span>
                <span className="text-xs font-semibold text-slate-700 block">{opp.serviceLine || '—'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expected Project Start</span>
                <span className="text-xs font-mono font-semibold text-slate-600 block">{opp.allocationStartDate || '—'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expected Project End</span>
                <span className="text-xs font-mono font-semibold text-slate-600 block">{opp.allocationEndDate || '—'}</span>
              </div>
              {opp.description && (
                <div className="col-span-2 md:col-span-4 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Description</span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{opp.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: Action Items */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Action Items</h4>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {oppActions.length}
              </span>
            </div>
            {!showAddAction && (
              <button
                onClick={() => setShowAddAction(true)}
                disabled={isWon}
                title={isWon ? "This opportunity has been converted to a project and is now read-only. No further actions can be performed." : undefined}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer shadow-md shadow-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Action Item</span>
              </button>
            )}
          </div>

          {/* Form to Add Action Item inline */}
          {showAddAction && (
            <form onSubmit={handleCreateAction} className="bg-slate-50/75 p-4 rounded-xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-blue-600" /> New Action Item
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddAction(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-200 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Schedule commercial pricing call"
                      value={newAction.title}
                      onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/25"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Owner</label>
                    <ActionItemOwnerField
                      accountId={opp.accountId}
                      stakeholders={stakeholders}
                      value={newAction.ownerStakeholderId}
                      onChange={(ownerStakeholderId) => setNewAction({ ...newAction, ownerStakeholderId })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Open Date</label>
                    <input
                      type="date"
                      required
                      value={newAction.openDate}
                      onChange={(e) => setNewAction({ ...newAction, openDate: e.target.value })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                    <input
                      type="date"
                      required
                      value={newAction.dueDate}
                      onChange={(e) => setNewAction({ ...newAction, dueDate: e.target.value })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Priority</label>
                    <select
                      value={newAction.priority}
                      onChange={(e) => setNewAction({ ...newAction, priority: e.target.value as PriorityLevel })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="High">High</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Initial Status</label>
                    <select
                      value={newAction.status}
                      onChange={(e) => setNewAction({ ...newAction, status: e.target.value as ActionItemStatus })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                    >
                      {ACTION_ITEM_STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                    <select
                      value={newAction.actionItemType || ''}
                      onChange={(e) => setNewAction({ ...newAction, actionItemType: (e.target.value || undefined) as ActionItemType })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">— None —</option>
                      {ACTION_ITEM_TYPE_OPTIONS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Deliverable Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Provide description or context regarding this deliverable..."
                    value={newAction.notes}
                    onChange={(e) => setNewAction({ ...newAction, notes: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Risks & Dependencies</label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Pending budget approval, dependent on vendor SOW sign-off"
                    value={newAction.risksAndDependencies}
                    onChange={(e) => setNewAction({ ...newAction, risksAndDependencies: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                <CustomColumnFields
                  columns={actionItemColumns}
                  config={actionItemsColumnConfig}
                  values={newAction}
                  onChange={(key, value) => setNewAction({ ...newAction, [key]: value })}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddAction(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-md shadow-green-500/10 transition-colors"
                >
                  Create Action Item
                </button>
              </div>
            </form>
          )}

          {/* Action Items List Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/30">
            <Table>
              <TableHead>
                <TableHeadCell>Task Name</TableHeadCell>
                <TableHeadCell>Description</TableHeadCell>
                <TableHeadCell>Account</TableHeadCell>
                <TableHeadCell>Opportunity</TableHeadCell>
                <TableHeadCell>Owner</TableHeadCell>
                <TableHeadCell>Priority</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Open Date</TableHeadCell>
                <TableHeadCell>Due Date</TableHeadCell>
                <TableHeadCell>Risks & Dependencies</TableHeadCell>
                <TableHeadCell align="center">Action</TableHeadCell>
              </TableHead>
              <tbody>
                {oppActions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-slate-400 font-medium bg-white">
                      No active deliverables logged for this opportunity. Click "Create Action Item" to add one.
                    </td>
                  </tr>
                ) : (
                  oppActions.map(action => {
                    const actionComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === action.id);
                    return (
                      <React.Fragment key={action.id}>
                        <TableRow className="hover:bg-slate-50/50 bg-white">
                          <TableCell className="max-w-[180px]">
                            <div className="flex items-center gap-1">
                              <p className="font-extrabold text-slate-900 truncate min-w-0 flex-1" title={action.title}>
                                {action.title}
                              </p>
                              <ActionItemCommentToggle
                                itemTitle={action.title}
                                commentCount={actionComments.length}
                                isExpanded={expandedActionItemId === action.id}
                                onToggle={() => setExpandedActionItemId(expandedActionItemId === action.id ? null : action.id)}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 font-normal max-w-[200px]">
                            <span className="block line-clamp-2" title={action.notes || undefined}>
                              {action.notes || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-700 font-semibold max-w-[140px] truncate" title={account.name}>
                            {account.name}
                          </TableCell>
                          <TableCell className="text-slate-700 font-semibold max-w-[140px] truncate" title={opp.name}>
                            {opp.name}
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <ActionItemOwnerField
                              accountId={opp?.accountId || ''}
                              stakeholders={stakeholders}
                              value={action.ownerStakeholderId}
                              fallbackName={cleanOwnerName(action.ownerName || action.owner)}
                              disabled={isWon}
                              title={isWon ? "This opportunity has been converted to a project and is now read-only. No further actions can be performed." : undefined}
                              onChange={(ownerStakeholderId) => {
                                if (isWon) return;
                                const sh = stakeholders.find((s) => s.id === ownerStakeholderId);
                                updateActionItem({
                                  ...action,
                                  ownerStakeholderId,
                                  ownerName: cleanOwnerName(sh?.name || action.ownerName),
                                  owner: cleanOwnerName(sh?.name || action.owner),
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={action.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                          </TableCell>
                          <TableCell>
                            <select
                              value={action.status}
                              disabled={isWon}
                              title={isWon ? "This opportunity has been converted to a project and is now read-only. No further actions can be performed." : undefined}
                              onChange={(e) => updateActionItem({ ...action, status: e.target.value as ActionItemStatus })}
                              className={`text-xs font-bold border rounded-lg p-1.5 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${
                                action.status === 'Completed' ? 'text-green-700 border-green-200 bg-green-50/60 font-extrabold' :
                                action.status === 'Blocked' ? 'text-red-700 border-red-200 bg-red-50/60 font-extrabold' :
                                action.status === 'In Progress' ? 'text-blue-700 border-blue-200 bg-blue-50/60 font-extrabold' :
                                action.status === 'Cancelled' ? 'text-zinc-600 border-zinc-200 bg-zinc-100/60 font-extrabold' :
                                'text-slate-700 border-slate-200 font-bold'
                              }`}
                            >
                              {ACTION_ITEM_STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-slate-500 whitespace-nowrap">{action.openDate}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <input
                              type="date"
                              value={action.dueDate || ''}
                              disabled={isWon}
                              title={isWon ? "This opportunity has been converted to a project and is now read-only. No further actions can be performed." : undefined}
                              onChange={(e) => updateActionItem({ ...action, dueDate: e.target.value })}
                              className="text-xs font-mono font-bold border border-slate-200 rounded-lg p-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </TableCell>
                          <TableCell className="text-slate-600 font-normal max-w-[180px]">
                            <span className="block line-clamp-2" title={action.risksAndDependencies || undefined}>
                              {action.risksAndDependencies || '—'}
                            </span>
                          </TableCell>
                          <TableCell align="center">
                            <RowActionButton
                              intent="delete"
                              label={`Delete task ${action.title}`}
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              disabled={isWon}
                              title={isWon ? "This opportunity has been converted to a project and is now read-only. No further actions can be performed." : `Delete task ${action.title}`}
                              onClick={() => setDeleteActionTarget({ type: 'actionItem', id: action.id, label: action.title })}
                            />
                          </TableCell>
                        </TableRow>
                        {expandedActionItemId === action.id && (
                          <ActionItemCommentsExpandedRow
                            colSpan={11}
                            comments={actionComments}
                            risksAndDependencies={action.risksAndDependencies}
                            onAddComment={async (text) => {
                              await addComment('actionItem', action.id, text);
                            }}
                            onUpdateComment={async (id, text) => {
                              await updateComment(id, text);
                            }}
                            onDeleteComment={async (c) => {
                              await deleteComment(c.id);
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </div>

        {/* SECTION 3: Comments */}
        <div className="p-5 space-y-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Comments</h4>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {oppComments.length}
              </span>
            </div>

            {/* Scrollable Container for comments */}
            <div className="overflow-y-auto max-h-[300px] pr-1.5 space-y-3 custom-scrollbar">
              {oppComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No comments logged for this deal yet.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Start the dialogue below with executive updates.</p>
                </div>
              ) : (
                oppComments.map(comment => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onDelete={deleteComment}
                    onEdit={updateComment}
                  />
                ))
              )}
            </div>
          </div>

          {/* Comment input form */}
          <form onSubmit={handlePostComment} className="border-t border-slate-100 pt-4">
            <div className="flex gap-2.5 items-end">
              <div className="flex-1 space-y-1">
                <textarea
                  rows={2}
                  required
                  placeholder="Type a comment or update..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-slate-50 focus:bg-white transition-all resize-none"
                />
                {commentText.length > 0 && (
                  <div className="text-[9px] text-slate-400 font-bold text-right pr-1">
                    {commentText.length} characters
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white p-3 rounded-xl cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/15 transition-all shrink-0 flex items-center justify-center"
                title="Send comment"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 4: Risks & Dependencies */}
        <div className="p-5 space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
            <h4 className="font-bold text-slate-800 text-sm tracking-tight">Risks & Dependencies</h4>
          </div>

          <div>
            <textarea
              rows={3}
              value={risksValue}
              onChange={(e) => setRisksValue(e.target.value)}
              onBlur={handleRisksBlur}
              placeholder="Type risks & dependencies for this opportunity..."
              className="w-full text-xs p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-slate-50 focus:bg-white transition-all leading-relaxed font-medium resize-y"
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteActionTarget}
        title={deleteActionTarget?.type === 'comment' ? 'Delete Comment' : 'Delete Action Item'}
        onConfirm={async () => {
          if (!deleteActionTarget) return;
          if (deleteActionTarget.type === 'comment') await deleteComment(deleteActionTarget.id);
          else await deleteActionItem(deleteActionTarget.id);
          setDeleteActionTarget(null);
        }}
        onCancel={() => setDeleteActionTarget(null)}
      />

      {/* Action Item Quick Panel Drawer */}
      <AnimatePresence>
        {selectedActionItemId && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedActionItemId(null)}
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
              <ActionItemQuickPanel
                actionItemId={selectedActionItemId}
                onClose={() => setSelectedActionItemId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

