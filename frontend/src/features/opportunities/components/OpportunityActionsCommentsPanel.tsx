/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { Opportunity, ActionItem, Comment, PriorityLevel, ActionItemStatus } from '@/types';
import {
  CheckSquare,
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  AlertCircle,
  ListTodo
} from 'lucide-react';
import { ConfirmDialog, PRIORITY_COLORS, ACTION_STATUS_COLORS, StatusBadge, RowActionButton } from '@/components/ui';

interface PanelProps {
  opportunityId: string;
  onClose?: () => void;
}

// Sub-component to manage individual comments (handling long comments gracefully)
const CommentCard: React.FC<{ comment: Comment; onDelete: (id: string) => void }> = ({ comment, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isLong = comment.text.length > 220;
  const displayedText = isLong && !isExpanded ? `${comment.text.substring(0, 220)}...` : comment.text;

  return (
    <div className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl p-4 space-y-2.5 relative group transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-[11px] shadow-sm select-none">
            {comment.user.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-700 text-xs block leading-tight">{comment.user}</span>
            <span className="text-[9px] text-slate-400 font-semibold font-mono block mt-0.5">{comment.timestamp}</span>
          </div>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer transition-all p-1 hover:bg-red-50 rounded text-[10px] font-bold"
          title="Delete comment"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Comment"
        onConfirm={() => { onDelete(comment.id); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
      <div className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-wrap break-words">
        {displayedText}
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-700 font-extrabold ml-1.5 inline-flex items-center gap-0.5 focus:outline-none cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <>
                <span className="underline">Show Less</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span className="underline">Read More</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export const OpportunityActionsCommentsPanel: React.FC<PanelProps> = ({ opportunityId, onClose }) => {
  const {
    opportunities,
    actionItems,
    comments,
    accounts,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    addComment,
    deleteComment,
    actionItemColumns,
    actionItemsColumnConfig,
  } = useCRM();

  // Find target opportunity
  const opp = opportunities.find(o => o.id === opportunityId);
  const account = opp ? accounts.find(a => a.id === opp.accountId) : null;

  // Delete action item confirmation state
  const [deleteActionTarget, setDeleteActionTarget] = useState<{ id: string; label: string } | null>(null);

  // Form states
  const [commentText, setCommentText] = useState('');
  const [showAddAction, setShowAddAction] = useState(false);
  
  // New Action Item state — no prefilled values; the user enters everything.
  const emptyAction: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
    dueDate: '',
    priority: 'Medium' as PriorityLevel,
    status: 'Not Started' as ActionItemStatus,
    notes: ''
  };
  const [newAction, setNewAction] = useState<Omit<ActionItem, 'id'>>(emptyAction);

  if (!opp || !account) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Select an opportunity to view its corresponding action items and comments.</span>
      </div>
    );
  }

  // Filter corresponding items
  const oppActions = actionItems.filter(ai => ai.opportunityId === opp.id);
  const oppComments = comments.filter(c => c.targetType === 'opportunity' && c.targetId === opp.id);

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
    if (!newAction.title.trim()) return;

    addActionItem({
      ...newAction,
      accountId: opp.accountId,
      opportunityId: opp.id,
    });

    // Reset action form
    setNewAction(emptyAction);
    setShowAddAction(false);
  };

  return (
    <div className="bg-white h-screen max-h-screen flex flex-col space-y-0" id="opp-actions-comments-panel">
      {/* Panel Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
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

      {/* Main Panel Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 flex-1 overflow-y-auto">
        {/* Left Side: Deliverables & Action Table (3/5 width) */}
        <div className="lg:col-span-3 p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Corresponding Action Items</h4>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {oppActions.length}
              </span>
            </div>
            {!showAddAction && (
              <button
                onClick={() => setShowAddAction(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer shadow-md shadow-blue-500/10 transition-all"
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
                    <input
                      type="text"
                      value={newAction.owner}
                      onChange={(e) => setNewAction({ ...newAction, owner: e.target.value })}
                      placeholder="e.g., John Smith"
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500/25"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Initial Status</label>
                    <select
                      value={newAction.status}
                      onChange={(e) => setNewAction({ ...newAction, status: e.target.value as ActionItemStatus })}
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Completed">Completed</option>
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

                {/* Active custom columns (hidden ones excluded) */}
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
          <div className="flex-1 overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider select-none">
                  <th className="py-2.5 px-4">Task Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Owner</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {oppActions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 font-medium bg-white">
                      No active deliverables logged for this opportunity. Click "Create Task" to add one.
                    </td>
                  </tr>
                ) : (
                  oppActions.map(action => (
                    <tr key={action.id} className="border-b last:border-0 hover:bg-slate-50/50 bg-white font-medium text-slate-800 transition-colors">
                      <td className="py-3 px-4 max-w-[160px]">
                        <p className="font-extrabold text-slate-900 truncate" title={action.title}>
                          {action.title}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-normal max-w-[240px]">
                        {action.notes || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-semibold">{action.owner}</td>
                      <td className="py-3 px-3">
                        <StatusBadge value={action.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={action.status}
                          onChange={(e) => updateActionItem({ ...action, status: e.target.value as ActionItemStatus })}
                          className={`text-[10px] font-extrabold border rounded-md p-1 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/20 ${
                            action.status === 'Completed' ? 'text-green-700 border-green-200 bg-green-50/40' :
                            action.status === 'Blocked' ? 'text-red-700 border-red-200 bg-red-50/40' :
                            action.status === 'In Progress' ? 'text-blue-700 border-blue-200 bg-blue-50/40' :
                            'text-slate-600 border-slate-200'
                          }`}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Blocked">Blocked</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-500 whitespace-nowrap">{action.dueDate}</td>
                      <td className="py-3 px-3 text-center">
                        <RowActionButton
                          intent="delete"
                          label={`Delete task ${action.title}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => setDeleteActionTarget({ id: action.id, label: action.title })}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Governance Comments (2/5 width) */}
        <div className="lg:col-span-2 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4 flex flex-col flex-1 min-h-[300px]">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 shrink-0">
              <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Governance Comments Feed</h4>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                {oppComments.length}
              </span>
            </div>

            {/* Scrollable Container for multiple large comments */}
            <div className="flex-1 overflow-y-auto lg:max-h-[500px] pr-1.5 space-y-3 custom-scrollbar">
              {oppComments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
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
                  />
                ))
              )}
            </div>
          </div>

          {/* Comment input form */}
          <form onSubmit={handlePostComment} className="border-t border-slate-100 pt-4 mt-3 shrink-0">
            <div className="flex gap-2.5 items-end">
              <div className="flex-1 space-y-1">
                <textarea
                  rows={2}
                  required
                  placeholder="Type comment or governance update..."
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
      </div>

      <ConfirmDialog
        isOpen={!!deleteActionTarget}
        title="Delete Action Item"
        onConfirm={async () => {
          if (deleteActionTarget) {
            await deleteActionItem(deleteActionTarget.id);
            setDeleteActionTarget(null);
          }
        }}
        onCancel={() => setDeleteActionTarget(null)}
      />
    </div>
  );
};
