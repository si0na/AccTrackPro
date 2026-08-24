/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ActionItem, PriorityLevel, ActionItemStatus } from '@/types';
import { ACTION_ITEM_STATUS_OPTIONS } from '@/constants';
import {
  X,
  FileText,
  MessageSquare,
  Send,
  Trash2,
  Edit,
  Save,
  AlertCircle,
  Building2,
  Briefcase,
  FolderKanban,
  User,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  ConfirmDialog,
  PRIORITY_COLORS,
  ACTION_STATUS_COLORS,
  StatusBadge,
} from '@/components/ui';

interface ActionItemQuickPanelProps {
  actionItemId: string;
  onClose: () => void;
}

export const ActionItemQuickPanel: React.FC<ActionItemQuickPanelProps> = ({
  actionItemId,
  onClose,
}) => {
  const {
    actionItems,
    accounts,
    opportunities,
    projects,
    stakeholders,
    updateActionItem,
    comments,
    addComment,
    deleteComment,
  } = useCRM();

  // Selected Action Item
  const item = actionItems.find(ai => ai.id === actionItemId);
  const account = item?.accountId ? accounts.find(a => a.id === item.accountId) : null;
  const opp = item?.opportunityId ? opportunities.find(o => o.id === item.opportunityId) : null;
  const proj = item?.projectId ? projects.find(p => p.id === item.projectId) : null;
  const ownerName = item
    ? stakeholders.find(s => s.id === item.ownerStakeholderId)?.name || item.ownerName || item.owner || 'Unassigned'
    : 'Unassigned';

  // Details Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ActionItem>>({});

  // Comment State
  const [commentText, setCommentText] = useState('');
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<{ id: string; text: string } | null>(null);

  if (!item) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2 m-4">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Select a valid action item to view its corresponding quick panel.</span>
      </div>
    );
  }

  // Action item comments
  const itemComments = comments.filter(
    c => c.targetType === 'actionItem' && c.targetId === item.id
  );

  const handleSaveDetails = () => {
    updateActionItem({ ...item, ...editForm });
    setIsEditing(false);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment('actionItem', item.id, commentText);
    setCommentText('');
  };

  const uniqueStakeholders = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof stakeholders = [];
    const selectedId = editForm.ownerStakeholderId ?? item?.ownerStakeholderId;

    if (selectedId) {
      const current = stakeholders.find(s => s.id === selectedId);
      if (current && (current.name || current.email)) {
        seen.add((current.name || current.email).toLowerCase().trim());
        list.push(current);
      }
    }

    for (const s of stakeholders) {
      const nameStr = s.name || s.email;
      const key = (nameStr || '').toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(s);
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [stakeholders, editForm.ownerStakeholderId, item?.ownerStakeholderId]);

  return (
    <div className="bg-white h-screen max-h-screen flex flex-col space-y-0" id="action-item-quick-panel">
      {/* Panel Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="space-y-1 min-w-0 pr-4">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Action Item
            </span>
            {account && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-300 font-semibold truncate">{account.name}</span>
              </>
            )}
            {opp && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400 font-medium truncate">{opp.name}</span>
              </>
            )}
          </div>
          <h3 className="text-base font-extrabold tracking-tight truncate">{item.title}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Panel Scrollable Content */}
      <div className="flex flex-col divide-y divide-slate-200 flex-1 overflow-y-auto">
        
        {/* SECTION 1: Action Item Details */}
        <div className="p-5 space-y-4 bg-slate-50/40">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Action Item Details</h4>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleSaveDetails();
                } else {
                  setEditForm({
                    title: item.title,
                    status: item.status,
                    priority: item.priority,
                    ownerStakeholderId: item.ownerStakeholderId,
                    openDate: item.openDate,
                    dueDate: item.dueDate,
                    notes: item.notes,
                    risksAndDependencies: item.risksAndDependencies,
                  });
                  setIsEditing(true);
                }
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
            >
              {isEditing ? (
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

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Title</label>
                <input
                  type="text"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-semibold text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                <select
                  value={editForm.status || item.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ActionItemStatus })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-semibold text-slate-800"
                >
                  {ACTION_ITEM_STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Priority</label>
                <select
                  value={editForm.priority || item.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as PriorityLevel })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-semibold text-slate-800"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Owner</label>
                <select
                  value={editForm.ownerStakeholderId || ''}
                  onChange={(e) => setEditForm({ ...editForm, ownerStakeholderId: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">— Unassigned —</option>
                  {uniqueStakeholders.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.designation ? ` (${s.designation})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Open Date</label>
                <input
                  type="date"
                  value={editForm.openDate || ''}
                  onChange={(e) => setEditForm({ ...editForm, openDate: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                <input
                  type="date"
                  value={editForm.dueDate || ''}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Notes / Description</label>
                <textarea
                  rows={2}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Risks & Dependencies</label>
                <textarea
                  rows={2}
                  value={editForm.risksAndDependencies || ''}
                  onChange={(e) => setEditForm({ ...editForm, risksAndDependencies: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
                <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Owner
                  </span>
                  <p className="font-semibold text-slate-800 truncate">{ownerName}</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Due Date
                  </span>
                  <p className="font-mono font-semibold text-slate-800">{item.dueDate || '—'}</p>
                </div>

                {account && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" /> Account
                    </span>
                    <p className="font-semibold text-slate-800 truncate">{account.name}</p>
                  </div>
                )}

                {opp && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-slate-400" /> Opportunity
                    </span>
                    <p className="font-semibold text-slate-800 truncate">{opp.name}</p>
                  </div>
                )}

                {proj && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <FolderKanban className="w-3 h-3 text-slate-400" /> Project
                    </span>
                    <p className="font-semibold text-slate-800 truncate">{proj.name}</p>
                  </div>
                )}

                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Open Date
                  </span>
                  <p className="font-mono font-semibold text-slate-800">{item.openDate || '—'}</p>
                </div>
              </div>

              {item.notes && (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes / Details</span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{item.notes}</p>
                </div>
              )}

              {item.risksAndDependencies && (
                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" /> Risks & Dependencies
                  </span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{item.risksAndDependencies}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: Comments */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Comments</h4>
              <span className="text-[11px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded-full border border-blue-200/60">
                {itemComments.length}
              </span>
            </div>
          </div>

          {/* List of Comments */}
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {itemComments.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No comments posted yet.</p>
                <p className="text-[11px] text-slate-400">Be the first to add a comment below.</p>
              </div>
            ) : (
              itemComments.map(comment => (
                <div key={comment.id} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-extrabold">
                        {(comment.user || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{comment.user || 'User'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {comment.timestamp || ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteCommentTarget({ id: comment.id, text: comment.text.substring(0, 40) })}
                      className="text-slate-300 hover:text-red-500 p-1 rounded cursor-pointer transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed pl-8">
                    {comment.text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handlePostComment} className="pt-2">
            <div className="flex items-end space-x-2">
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none shadow-xs"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-3 rounded-xl cursor-pointer shadow-md shadow-blue-500/10 transition-all shrink-0 flex items-center justify-center"
                title="Send comment"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteCommentTarget}
        title="Delete Comment"
        message={`Are you sure you want to delete comment "${deleteCommentTarget?.text}..."?`}
        onConfirm={async () => {
          if (!deleteCommentTarget) return;
          await deleteComment(deleteCommentTarget.id);
          setDeleteCommentTarget(null);
        }}
        onCancel={() => setDeleteCommentTarget(null)}
      />
    </div>
  );
};
