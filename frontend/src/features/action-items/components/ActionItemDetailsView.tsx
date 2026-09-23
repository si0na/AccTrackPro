import React, { useState, useMemo, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { ActionItem, ActionItemStatus } from '@/types';
import {
  CheckSquare,
  Building2,
  FolderKanban,
  Target,
  User,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  FileText,
  AlertTriangle,
  Send,
  Layers,
  Sparkles,
  ExternalLink,
  Tag,
} from 'lucide-react';
import {
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DetailHeaderCard,
  DetailTabBar,
  PRIORITY_COLORS,
  ACTION_STATUS_COLORS,
  StatusBadge,
  AutoResizeTextarea,
  ErrorBanner,
} from '@/components/ui';
import { CommentCard } from '@/components/CommentCard';
import { InlineEditModal } from '@/components/InlineEditModal';
import { showToast } from '@/components/common/ToastHost';

type ActionItemDetailTab = 'overview' | 'comments' | 'activity';

export const ActionItemDetailsView: React.FC = () => {
  const {
    selectedActionItemId,
    setSelectedActionItemId,
    actionItemDetailsSourceView,
    setView,
    setSelectedAccountId,
    setSelectedProjectId,
    setSelectedOpportunityId,
    actionItems,
    updateActionItem,
    deleteActionItem,
    accounts,
    projects,
    opportunities,
    stakeholders,
    comments,
    addComment,
    updateComment,
    deleteComment,
    activities,
    can,
    actionItemColumns,
    actionItemsColumnConfig,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<ActionItemDetailTab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Find the selected Action Item
  const item = useMemo(() => {
    if (!selectedActionItemId) return null;
    return actionItems.find((ai) => ai.id === selectedActionItemId) || null;
  }, [actionItems, selectedActionItemId]);

  const isProjectItem = !!item?.projectId;
  const moduleKey = isProjectItem ? 'project-action-items' : 'action-items';

  const canEdit = can(moduleKey, 'update');
  const canDelete = can(moduleKey, 'delete');

  // Related comments
  const itemComments = useMemo(() => {
    if (!item) return [];
    return comments.filter((c) => c.targetType === 'actionItem' && c.targetId === item.id);
  }, [comments, item]);

  // Related activities
  const itemActivities = useMemo(() => {
    if (!item) return [];
    return activities.filter(
      (a) =>
        a.type === 'actionItem' ||
        (a.accountId === item.accountId && a.text.toLowerCase().includes(item.title.toLowerCase()))
    );
  }, [activities, item]);

  // Back button title & handler
  const backTitle = useMemo(() => {
    if (actionItemDetailsSourceView === 'project-details') return 'Back to Project Details';
    if (actionItemDetailsSourceView === 'account-details') return 'Back to Account Details';
    if (actionItemDetailsSourceView === 'opportunity-details') return 'Back to Opportunity Details';
    if (actionItemDetailsSourceView === 'projectActionItems') return 'Back to Project Action Items';
    return 'Back to Action Items';
  }, [actionItemDetailsSourceView]);

  const handleBack = useCallback(() => {
    if (actionItemDetailsSourceView) {
      setView(actionItemDetailsSourceView);
    } else if (isProjectItem) {
      setView('projectActionItems');
    } else {
      setView('actionItems');
    }
  }, [actionItemDetailsSourceView, isProjectItem, setView]);

  // Quick Status Toggle (Complete / Reopen)
  const handleToggleStatus = async () => {
    if (!item || !canEdit || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const nextStatus: ActionItemStatus = item.status === 'Completed' ? 'In Progress' : 'Completed';
      const completedDate = nextStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined;
      await updateActionItem({
        ...item,
        status: nextStatus,
        completedDate,
      });
      showToast({
        kind: 'success',
        message: `Action item marked as ${nextStatus.toLowerCase()}.`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update status.';
      showToast({ kind: 'error', message: typeof msg === 'string' ? msg : 'Failed to update status.' });
    } finally {
      setStatusUpdating(false);
    }
  };

  // Delete Action Item
  const handleDeleteConfirm = async () => {
    if (!item) return;
    try {
      await deleteActionItem(item.id);
      showToast({ kind: 'success', message: `Action item "${item.title}" deleted.` });
      setIsDeleteModalOpen(false);
      handleBack();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete action item.';
      showToast({ kind: 'error', message: typeof msg === 'string' ? msg : 'Failed to delete action item.' });
    }
  };

  const handleOpenEdit = () => {
    if (item) {
      setEditingItem({ ...item });
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateActionItem(editingItem);
      showToast({ kind: 'success', message: 'Action item updated successfully.' });
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch {
      showToast({ kind: 'error', message: 'Failed to update action item.' });
    }
  };

  // Submit Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      await addComment(
        'actionItem',
        item.id,
        commentText.trim(),
      );
      setCommentText('');
      showToast({ kind: 'success', message: 'Comment posted.' });
    } catch {
      showToast({ kind: 'error', message: 'Failed to post comment.' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!item) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-slate-500 italic text-sm">Action item not found or may have been deleted.</p>
        <Button variant="secondary" size="sm" onClick={handleBack}>
          {backTitle}
        </Button>
      </div>
    );
  }

  // Linked entity objects
  const linkedAccount = accounts.find((a) => a.id === item.accountId);
  const linkedProject = projects.find((p) => p.id === item.projectId);
  const linkedOpp = opportunities.find((o) => o.id === item.opportunityId);
  const linkedStakeholder = stakeholders.find((s) => s.id === item.ownerStakeholderId);

  const isCompleted = item.status === 'Completed';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText, count: null },
    { id: 'comments', label: 'Comments', icon: MessageSquare, count: itemComments.length > 0 ? itemComments.length : null },
    { id: 'activity', label: 'Activity Log', icon: Clock, count: itemActivities.length > 0 ? itemActivities.length : null },
  ];

  return (
    <div className="space-y-6">
      {/* Detail Header Card */}
      <DetailHeaderCard
        onBack={handleBack}
        backTitle={backTitle}
        avatarContent={<CheckSquare className="w-6 h-6" aria-hidden="true" />}
        avatarColorClass="bg-blue-50 text-blue-600"
        title={item.title}
        badges={
          <>
            {item.actionItemNumber && (
              <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                {item.actionItemNumber}
              </span>
            )}
            <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
            <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
            <StatusBadge
              value={item.actionItemType || (isProjectItem ? 'Project Action Item' : 'Action Item')}
              colorMap={{
                'Project Action Item': 'bg-purple-100 text-purple-800 border-purple-200',
                'Action Item': 'bg-blue-100 text-blue-800 border-blue-200',
              }}
              shape="rounded"
            />
          </>
        }
        description={
          item.notes ? (
            <span className="line-clamp-1 italic text-slate-500">{item.notes}</span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant={isCompleted ? 'secondary' : 'success'}
                size="sm"
                icon={isCompleted ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                onClick={handleToggleStatus}
                disabled={statusUpdating}
              >
                {isCompleted ? 'Reopen Task' : 'Mark Completed'}
              </Button>
            )}
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                icon={<Edit2 className="w-4 h-4" />}
                onClick={handleOpenEdit}
              >
                Edit Task
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        }
        attributes={[
          ...(item.actionItemNumber ? [{
            icon: <Tag className="w-4 h-4" />,
            label: 'Action Item #',
            value: <span className="font-mono font-bold text-slate-800">{item.actionItemNumber}</span>,
          }] : []),
          {
            icon: <Building2 className="w-4 h-4" />,
            label: 'Account',
            value: (
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId(item.accountId);
                  setView('account-details');
                }}
                className="text-blue-600 hover:underline font-semibold cursor-pointer text-left"
              >
                {item.accountName || linkedAccount?.name || 'View Account'}
              </button>
            ),
          },
          ...(item.projectId
            ? [
                {
                  icon: <FolderKanban className="w-4 h-4" />,
                  label: 'Project',
                  value: (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(item.projectId!);
                        setView('project-details');
                      }}
                      className="text-indigo-600 hover:underline font-semibold cursor-pointer text-left"
                    >
                      {item.projectName || linkedProject?.name || 'View Project'}
                    </button>
                  ),
                },
              ]
            : []),
          ...(item.opportunityId
            ? [
                {
                  icon: <Target className="w-4 h-4" />,
                  label: 'Opportunity',
                  value: (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOpportunityId(item.opportunityId!);
                        setView('opportunity-details');
                      }}
                      className="text-blue-600 hover:underline font-semibold cursor-pointer text-left"
                    >
                      {item.opportunityName || linkedOpp?.name || 'View Opportunity'}
                    </button>
                  ),
                },
              ]
            : []),
          {
            icon: <User className="w-4 h-4" />,
            label: 'Owner',
            value: item.ownerName || item.owner || linkedStakeholder?.name || 'Unassigned',
          },
          {
            icon: <Calendar className="w-4 h-4" />,
            label: 'Due Date',
            value: item.dueDate || 'No Due Date',
            mono: true,
          },
        ]}
      />

      {/* Tab Bar Navigation */}
      <DetailTabBar tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as ActionItemDetailTab)} />

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Specifications */}
            <Card title="Task Specifications">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Priority Level
                  </label>
                  <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Current Status
                  </label>
                  <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Open Date
                  </label>
                  <span className="font-mono font-semibold text-slate-700">{item.openDate || '—'}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Due Date
                  </label>
                  <span className="font-mono font-semibold text-slate-700">{item.dueDate || '—'}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Completed Date
                  </label>
                  <span className="font-mono font-semibold text-slate-700">{item.completedDate || '—'}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Reporting FY / Quarter
                  </label>
                  <span className="font-mono font-semibold text-slate-700">
                    {item.financialYear ? `${item.financialYear} ${item.quarter || ''}` : '—'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Notes & Description */}
            <Card
              title={
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Notes &amp; Instructions
                </span>
              }
            >
              {item.notes ? (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  {item.notes}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No notes provided for this action item.</p>
              )}
            </Card>

            {/* Risks & Dependencies */}
            <Card
              title={
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Risks &amp; Dependencies
                </span>
              }
            >
              {item.risksAndDependencies ? (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60 text-amber-900">
                  {item.risksAndDependencies}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No linked risks or dependencies specified.</p>
              )}
            </Card>

            {/* Next Action */}
            <Card title="Next Action">
              {item.nextAction ? (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-blue-50/50 p-3.5 rounded-xl border border-blue-200/60 text-blue-900">
                  {item.nextAction}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No next action specified.</p>
              )}
            </Card>

            {/* Impediments */}
            <Card title="Impediments">
              {item.impediments ? (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-rose-50/50 p-3.5 rounded-xl border border-rose-200/60 text-rose-900">
                  {item.impediments}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No current impediments specified.</p>
              )}
            </Card>
          </div>

          {/* Context & Relationships Column (1 col) */}
          <div className="space-y-6">
            {/* Linked Entities */}
            <Card title="Relational Context">
              <div className="space-y-4 text-xs">
                {/* Account */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      Account
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(item.accountId);
                      setView('account-details');
                    }}
                    className="font-bold text-sm text-blue-600 hover:underline text-left block"
                  >
                    {item.accountName || linkedAccount?.name || 'View Account'}
                  </button>
                </div>

                {/* Project */}
                {item.projectId && (
                  <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                        Project
                      </span>
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(item.projectId!);
                        setView('project-details');
                      }}
                      className="font-bold text-sm text-indigo-700 hover:underline text-left block"
                    >
                      {item.projectName || linkedProject?.name || 'View Project'}
                    </button>
                  </div>
                )}

                {/* Opportunity */}
                {item.opportunityId && (
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                        <Target className="w-3.5 h-3.5 text-blue-500" />
                        Opportunity
                      </span>
                      <ExternalLink className="w-3 h-3 text-blue-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOpportunityId(item.opportunityId!);
                        setView('opportunity-details');
                      }}
                      className="font-bold text-sm text-blue-700 hover:underline text-left block"
                    >
                      {item.opportunityName || linkedOpp?.name || 'View Opportunity'}
                    </button>
                  </div>
                )}
              </div>
            </Card>

            {/* Ownership & Stakeholder Details */}
            <Card title="Assignment & Ownership">
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Assigned Owner
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {item.ownerName || item.owner || linkedStakeholder?.name || 'Unassigned'}
                  </span>
                </div>
                {item.ownerDesignation && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Designation
                    </span>
                    <span className="text-slate-600 font-medium">{item.ownerDesignation}</span>
                  </div>
                )}
                {item.ownerStakeholderType && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Stakeholder Type
                    </span>
                    <StatusBadge
                      value={item.ownerStakeholderType}
                      colorMap={{
                        'Client Stakeholder': 'bg-purple-100 text-purple-700',
                        'Service Provider Stakeholder': 'bg-blue-100 text-blue-700',
                      }}
                      shape="rounded"
                    />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Comments Tab ── */}
      {activeTab === 'comments' && (
        <Card title={`Comments (${itemComments.length})`}>
          <div className="space-y-6">
            {/* Post Comment Form */}
            <form onSubmit={handlePostComment} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <AutoResizeTextarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment or update on this action item..."
                className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white"
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  icon={<Send className="w-3.5 h-3.5" />}
                  disabled={!commentText.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>
            </form>

            {/* Comment List */}
            {itemComments.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">No comments posted yet.</p>
            ) : (
              <div className="space-y-4">
                {itemComments.map((c) => (
                  <CommentCard
                    key={c.id}
                    comment={c}
                    onEdit={(id, text) => updateComment(id, text)}
                    onDelete={(id) => deleteComment(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Activity Log Tab ── */}
      {activeTab === 'activity' && (
        <Card title={`Activity Log (${itemActivities.length})`}>
          {itemActivities.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No activity recorded yet for this action item.</p>
          ) : (
            <div className="space-y-3">
              {itemActivities.map((act) => (
                <div key={act.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 font-medium">{act.text}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                      <span>{act.user || 'System'}</span>
                      <span>•</span>
                      <span>{new Date(act.timestamp || Date.now()).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Edit Action Item Modal */}
      {isEditModalOpen && editingItem && (
        <InlineEditModal
          mode="actionItems"
          entity={editingItem}
          displayedConfigs={actionItemsColumnConfig}
          accounts={accounts}
          opportunities={opportunities}
          projects={projects}
          stakeholders={stakeholders}
          onChange={(patch) => setEditingItem({ ...editingItem, ...patch } as ActionItem)}
          onSave={handleSaveEdit}
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        title="Delete Action Item"
        tone="danger"
        confirmLabel="Delete"
        message={
          <>
            Are you sure you want to delete action item <span className="font-bold">"{item.title}"</span>? This action cannot be undone.
          </>
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
