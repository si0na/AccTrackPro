import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { NormalizedRisk } from '@/types';
import { centralRisksApi, accountRisksApi, projectRisksApi, projectIssuesApi } from '@/api/crm.api';
import {
  ShieldAlert,
  AlertCircle,
  Building2,
  FolderGit2,
  User,
  Calendar,
  AlertTriangle,
  Edit2,
  Trash2,
  MessageSquare,
  Send,
  Layers,
  FileText,
  CheckCircle2,
  Tag,
  Clock,
  Briefcase,
} from 'lucide-react';
import {
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DetailHeaderCard,
  DetailTabBar,
  HEALTH_COLORS,
  PRIORITY_COLORS,
  StatusBadge,
  AutoResizeTextarea,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { CommentCard } from '@/components/CommentCard';
import { RiskFormModal } from './RiskFormModal';
import { IssueFormModal } from './IssueFormModal';

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 border-amber-200',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  Mitigated: 'bg-blue-100 text-blue-800 border-blue-200',
  Closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Accepted: 'bg-slate-100 text-slate-700 border-slate-200',
  Resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

type RiskDetailTab = 'overview' | 'comments';

export const RiskDetailsView: React.FC = () => {
  const {
    selectedRiskId,
    setSelectedRiskId,
    setView,
    setSelectedAccountId,
    setSelectedProjectId,
    comments,
    addComment,
    updateComment,
    deleteComment,
    can,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<RiskDetailTab>('overview');
  const [items, setItems] = useState<NormalizedRisk[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Delete Modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const canCreate = can('risks', 'create');

  // Load all risks to find selected item (or match route parameter)
  const effectiveId = useMemo(() => {
    if (selectedRiskId) return selectedRiskId;
    const match = window.location.pathname.match(/^\/risks\/([^/]+)/);
    return match ? match[1] : null;
  }, [selectedRiskId]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await centralRisksApi.getAll();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentItem = useMemo(() => {
    if (!effectiveId) return null;
    return items.find((i) => i.id === effectiveId || i.sourceId === effectiveId);
  }, [items, effectiveId]);

  const isIssue = currentItem?.riskType === 'Issue';
  const targetType = isIssue ? 'issue' : 'risk';

  // Comments for this specific risk/issue
  const itemComments = useMemo(() => {
    if (!currentItem) return [];
    return comments.filter(
      (c) =>
        (c.targetType === targetType || c.targetType === 'risk' || c.targetType === 'issue') &&
        (c.targetId === currentItem.sourceId || c.targetId === currentItem.id)
    );
  }, [comments, targetType, currentItem]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentItem) return;
    setIsSubmittingComment(true);
    try {
      await addComment(targetType, currentItem.sourceId || currentItem.id, commentText.trim());
      setCommentText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!currentItem) return;
    try {
      if (currentItem.sourceType === 'Account') {
        await accountRisksApi.delete(currentItem.sourceId);
      } else if (currentItem.sourceType === 'Project') {
        if (currentItem.riskType === 'Issue') {
          await projectIssuesApi.delete(currentItem.projectId!, currentItem.sourceId);
        } else {
          await projectRisksApi.delete(currentItem.projectId!, currentItem.sourceId);
        }
      }
      setSelectedRiskId(null);
      setView('risks');
    } catch (err) {
      console.error('Failed to delete item', err);
    } finally {
      setIsDeleteOpen(false);
    }
  };

  if (loading && items.length === 0) {
    return <LoadingState label="Loading details..." />;
  }

  if (!currentItem) {
    return (
      <div className="space-y-6">
        <BackButton label="Back to Risks & Issues" onClick={() => setView('risks')} />
        <Card padding="none">
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Record Not Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                The requested {isIssue ? 'issue' : 'risk'} does not exist or has been removed.
              </p>
            </div>
            <Button variant="primary" onClick={() => setView('risks')}>
              Return to Risks & Issues
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Back Button */}
      <BackButton label="Back to Risks & Issues" onClick={() => setView('risks')} />

      {/* Main Detail Header Card */}
      <DetailHeaderCard
        avatarContent={
          isIssue ? (
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          )
        }
        avatarColorClass={
          isIssue
            ? 'bg-amber-50 text-amber-600 border border-amber-200'
            : 'bg-red-50 text-red-600 border border-red-200'
        }
        title={currentItem.description}
        badges={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                isIssue
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {currentItem.riskType}
            </span>

            {/* Scope Badge */}
            {currentItem.sourceType === 'Project' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <FolderGit2 className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Project Scope</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                <span>Account Scope</span>
              </span>
            )}

            <StatusBadge value={currentItem.status} colorMap={STATUS_COLORS} shape="rounded" />
            <StatusBadge value={currentItem.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
            {currentItem.rag && (
              <StatusBadge value={currentItem.rag} colorMap={HEALTH_COLORS} shape="rounded" />
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button
                variant="secondary"
                icon={<Edit2 className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => setIsEditOpen(true)}
              >
                Edit {currentItem.riskType}
              </Button>
            )}
            {canCreate && (
              <Button
                variant="danger"
                icon={<Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => setIsDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        }
        attributes={[
          {
            icon: <Building2 className="w-4 h-4" />,
            label: 'Account',
            value: (
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId(currentItem.accountId);
                  setView('account-details');
                }}
                className="text-blue-600 hover:underline font-bold cursor-pointer truncate max-w-full text-left"
                title="View Account Details"
              >
                {currentItem.accountName || '—'}
              </button>
            ),
          },
          {
            icon: <FolderGit2 className="w-4 h-4" />,
            label: 'Project',
            value: currentItem.projectId ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(currentItem.projectId!);
                  setView('project-details');
                }}
                className="text-blue-600 hover:underline font-bold cursor-pointer truncate max-w-full text-left"
                title="View Project Details"
              >
                {currentItem.projectName || 'View Project'}
              </button>
            ) : (
              <span className="text-slate-400 font-medium">Account Level</span>
            ),
          },
          {
            icon: <User className="w-4 h-4" />,
            label: 'Assigned Owner',
            value: currentItem.ownerName || 'Unassigned',
          },
          {
            icon: <Calendar className="w-4 h-4" />,
            label: isIssue ? 'Date Identified' : 'Risk Open Date',
            mono: true,
            value: currentItem.riskOpenDate || '—',
          },
          {
            icon: <Clock className="w-4 h-4" />,
            label: 'Target Resolution Date',
            mono: true,
            value: currentItem.targetResolutionDate || '—',
          },
          {
            icon: <AlertTriangle className="w-4 h-4" />,
            label: 'Impact',
            value: currentItem.impact || '—',
          },
          ...(!isIssue
            ? [
                {
                  icon: <Tag className="w-4 h-4" />,
                  label: 'Likelihood',
                  value: currentItem.likelihood || '—',
                },
                {
                  icon: <AlertTriangle className="w-4 h-4" />,
                  label: 'Severity',
                  value: currentItem.severity ? (
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-xs ${
                        currentItem.severity === 'High' || currentItem.severity === 'Critical'
                          ? 'bg-red-100 text-red-700'
                          : currentItem.severity === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {currentItem.severity}
                    </span>
                  ) : (
                    '—'
                  ),
                },
                {
                  icon: <Layers className="w-4 h-4" />,
                  label: 'Classification',
                  value: currentItem.classification || '—',
                },
              ]
            : []),
        ]}
        attributesClassName="grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      />

      {/* Tab Navigation */}
      <DetailTabBar
        tabs={[
          { id: 'overview', label: 'Overview', icon: FileText },
          { id: 'comments', label: 'Comments', icon: MessageSquare, count: itemComments.length },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as RiskDetailTab)}
      />

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Description & Core Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Detailed Description */}
              <Card>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {isIssue ? 'Issue Details & Description' : 'Risk Description'}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-800 font-medium leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-200/60">
                    {currentItem.description}
                  </p>
                </div>
              </Card>

              {/* Impact Description (Risks only) */}
              {!isIssue && (
                <Card>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Impact Description
                      </h3>
                    </div>
                    {currentItem.impactDescription ? (
                      <p className="text-xs text-slate-700 font-medium leading-relaxed bg-amber-50/40 p-4 rounded-xl border border-amber-200/60">
                        {currentItem.impactDescription}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2">No impact description provided.</p>
                    )}
                  </div>
                </Card>
              )}

              {/* Mitigation Plan (Risks) / Resolution Plan (Issues) */}
              <Card>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {isIssue ? 'Resolution Plan' : 'Mitigation Plan'}
                    </h3>
                  </div>
                  {currentItem.mitigationPlan ? (
                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-200/60">
                      {currentItem.mitigationPlan}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">
                      No {isIssue ? 'resolution' : 'mitigation'} plan specified.
                    </p>
                  )}
                </div>
              </Card>

              {/* Contingency Plan (Risks) / Remarks (Issues) */}
              <Card>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {isIssue ? 'Remarks / Notes' : 'Contingency Plan'}
                    </h3>
                  </div>
                  {currentItem.contingencyPlan ? (
                    <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-200/60">
                      {currentItem.contingencyPlan}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-2">
                      No {isIssue ? 'remarks' : 'contingency plan'} specified.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Context Sidebar */}
            <div className="space-y-6">
              {/* Scope & Relationships Card */}
              <Card>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <Briefcase className="w-4 h-4 text-slate-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Scope & Context
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> Associated Account
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAccountId(currentItem.accountId);
                          setView('account-details');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer block text-left"
                      >
                        {currentItem.accountName || '—'}
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FolderGit2 className="w-3 h-3 text-slate-400" /> Associated Project
                      </span>
                      {currentItem.projectId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(currentItem.projectId!);
                            setView('project-details');
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer block text-left"
                        >
                          {currentItem.projectName || 'View Project'}
                        </button>
                      ) : (
                        <span className="text-slate-500 font-semibold block">Account-level scope</span>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> Assigned Owner
                      </span>
                      <span className="text-xs font-bold text-slate-800 block">
                        {currentItem.ownerName || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Assessment Breakdown Card */}
              <Card>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <Tag className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Assessment Breakdown
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
                      <span className="font-bold text-slate-800">{currentItem.status}</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Priority</span>
                      <span className="font-bold text-slate-800">{currentItem.priority}</span>
                    </div>

                    {currentItem.rag && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">RAG Status</span>
                        <span className="font-bold text-slate-800">{currentItem.rag}</span>
                      </div>
                    )}

                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Impact</span>
                      <span className="font-bold text-slate-800">{currentItem.impact || '—'}</span>
                    </div>

                    {!isIssue && (
                      <>
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Likelihood</span>
                          <span className="font-bold text-slate-800">{currentItem.likelihood || '—'}</span>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Severity</span>
                          <span className="font-bold text-slate-800">{currentItem.severity || '—'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: COMMENTS ── */}
      {activeTab === 'comments' && (
        <Card>
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Discussion & Comments ({itemComments.length})
                </h3>
              </div>
            </div>

            {/* Add Comment Input Form */}
            <form onSubmit={handlePostComment} className="flex gap-2 items-start">
              <AutoResizeTextarea
                minRows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={`Add a comment on this ${isIssue ? 'issue' : 'risk'}...`}
                className="flex-1 px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handlePostComment(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || isSubmittingComment}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>

            {/* List of Comments using CommentCard */}
            <div className="space-y-3">
              {itemComments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No comments posted yet.</p>
                  <p className="text-[11px] text-slate-400">Be the first to share an update or note.</p>
                </div>
              ) : (
                itemComments.map((comment) => (
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
        </Card>
      )}

      {/* Edit Risk Form Modal */}
      {isEditOpen && !isIssue && (
        <RiskFormModal
          isOpen={isEditOpen}
          mode="edit"
          risk={currentItem}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* Edit Issue Form Modal */}
      {isEditOpen && isIssue && (
        <IssueFormModal
          isOpen={isEditOpen}
          mode="edit"
          issue={currentItem}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title={`Delete ${currentItem.riskType}`}
        message={`Are you sure you want to delete this ${currentItem.riskType.toLowerCase()}? This action cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
};
