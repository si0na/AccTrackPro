import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { NormalizedRisk, PriorityLevel } from '@/types';
import { accountRisksApi, projectRisksApi, projectIssuesApi } from '@/api/crm.api';
import { calculateRiskSeverity, serviceProviderOptionLabel } from '@/utils';
import {
  RISK_RAG_OPTIONS,
  RISK_CLASSIFICATION_OPTIONS,
  RISK_IMPACT_OPTIONS,
  RISK_LIKELIHOOD_OPTIONS,
  PRIORITY_OPTIONS,
} from '@/constants';
import {
  X,
  ShieldAlert,
  AlertCircle,
  Building2,
  FolderGit2,
  User,
  Calendar,
  MessageSquare,
  Send,
  Edit,
  Save,
  AlertTriangle,
  FileText,
  Clock,
  Tag,
  Layers,
  Check,
} from 'lucide-react';
import {
  HEALTH_COLORS,
  PRIORITY_COLORS,
  StatusBadge,
  AutoResizeTextarea,
} from '@/components/ui';
import { CommentCard } from '@/components/CommentCard';

interface RiskQuickPanelProps {
  item: NormalizedRisk;
  onClose: () => void;
  onEdit?: (item: NormalizedRisk) => void;
  onDelete?: (item: NormalizedRisk) => void;
  onOpenDetail?: (item: NormalizedRisk) => void;
  onSave?: () => Promise<void> | void;
}

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 border-amber-200',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  Mitigated: 'bg-blue-100 text-blue-800 border-blue-200',
  Closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Accepted: 'bg-slate-100 text-slate-700 border-slate-200',
  Resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const RISK_STATUS_OPTIONS = ['Accepted', 'Closed', 'In Progress', 'Mitigated', 'Open'];
const ISSUE_STATUS_OPTIONS = ['Closed', 'In Progress', 'Open', 'Resolved'];

export const RiskQuickPanel: React.FC<RiskQuickPanelProps> = ({
  item: initialItem,
  onClose,
  onSave,
}) => {
  const {
    comments,
    addComment,
    updateComment,
    deleteComment,
    serviceProviders,
  } = useCRM();

  const [item, setItem] = useState<NormalizedRisk>(initialItem);

  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  const isIssue = item.riskType === 'Issue';
  const targetType = isIssue ? 'issue' : 'risk';

  // ── Quick Panel Inline Edit State ──────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    description: item.description || '',
    status: item.status || 'Open',
    priority: item.priority || 'Medium',
    rag: item.rag || '',
    classification: item.classification || '',
    ownerId: item.ownerId || '',
    riskOpenDate: item.riskOpenDate || '',
    targetResolutionDate: item.targetResolutionDate || '',
    impact: item.impact || '',
    likelihood: item.likelihood || '',
  });

  const handleStartEdit = () => {
    setEditForm({
      description: item.description || '',
      status: item.status || 'Open',
      priority: item.priority || 'Medium',
      rag: item.rag || '',
      classification: item.classification || '',
      ownerId: item.ownerId || '',
      riskOpenDate: item.riskOpenDate || '',
      targetResolutionDate: item.targetResolutionDate || '',
      impact: item.impact || '',
      likelihood: item.likelihood || '',
    });
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const computedSeverity = useMemo(() => {
    if (isIssue) return editForm.priority;
    return calculateRiskSeverity(editForm.impact, editForm.likelihood) || editForm.priority;
  }, [isIssue, editForm.impact, editForm.likelihood, editForm.priority]);

  const handleSaveDetails = async () => {
    if (!editForm.description.trim()) {
      setSaveError('Description cannot be empty.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const rawId = item.sourceId || item.id.replace(/^acc-/, '').replace(/^proj-issue-/, '').replace(/^proj-/, '');

      if (item.sourceType === 'Account') {
        await accountRisksApi.update(rawId, {
          description: editForm.description.trim(),
          status: editForm.status as any,
          priority: editForm.priority,
          rag: editForm.rag ? (editForm.rag as any) : undefined,
          classification: editForm.classification || undefined,
          ownerId: editForm.ownerId || undefined,
          riskOpenDate: editForm.riskOpenDate || undefined,
          targetResolutionDate: editForm.targetResolutionDate || undefined,
          impact: editForm.impact || undefined,
          likelihood: editForm.likelihood || undefined,
          severity: computedSeverity,
        });
      } else if (item.sourceType === 'Project') {
        const projId = item.projectId;
        if (!projId) throw new Error('Project ID missing for project record.');
        if (isIssue) {
          await projectIssuesApi.update(projId, rawId, {
            description: editForm.description.trim(),
            status: editForm.status as any,
            priority: editForm.priority,
            ownerId: editForm.ownerId || undefined,
            dateIdentified: editForm.riskOpenDate || undefined,
            targetResolutionDate: editForm.targetResolutionDate || undefined,
            impact: editForm.impact || undefined,
            resolutionPlan: item.mitigationPlan || '',
            remarks: item.contingencyPlan || '',
          });
        } else {
          await projectRisksApi.update(projId, rawId, {
            description: editForm.description.trim(),
            status: editForm.status as any,
            priority: editForm.priority,
            rag: editForm.rag ? (editForm.rag as any) : undefined,
            classification: editForm.classification || undefined,
            ownerId: editForm.ownerId || undefined,
            riskOpenDate: editForm.riskOpenDate || undefined,
            targetResolutionDate: editForm.targetResolutionDate || undefined,
            impact: editForm.impact || undefined,
            likelihood: editForm.likelihood || undefined,
            severity: computedSeverity,
            mitigationPlan: item.mitigationPlan || '',
            contingencyPlan: item.contingencyPlan || undefined,
            impactDescription: item.impactDescription || undefined,
          });
        }
      }

      // Update local item display
      const updatedOwner = serviceProviders.find((u) => u.id === editForm.ownerId);
      setItem((prev) => ({
        ...prev,
        ...editForm,
        rag: (editForm.rag as 'Red' | 'Amber' | 'Green') || undefined,
        description: editForm.description.trim(),
        severity: computedSeverity,
        ownerName: updatedOwner ? updatedOwner.name : editForm.ownerId ? prev.ownerName : 'Unassigned',
      }));

      setIsEditing(false);
      if (onSave) {
        await onSave();
      }
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err?.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Comments State ────────────────────────────────────────────────────────
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Comments for this specific risk/issue
  const itemComments = comments.filter(
    (c) =>
      (c.targetType === targetType || c.targetType === 'risk' || c.targetType === 'issue') &&
      (c.targetId === item.sourceId || c.targetId === item.id)
  );

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await addComment(targetType, item.sourceId || item.id, commentText.trim());
      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const inputFieldClass =
    'w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
  const selectFieldClass =
    'w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer';

  return (
    <div className="bg-white h-screen max-h-screen flex flex-col space-y-0" id="risk-quick-panel">
      {/* ── 1. Top Panel Header ── */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="space-y-1 min-w-0 pr-4">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                isIssue
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30'
                  : 'bg-red-500/25 text-red-300 border border-red-500/30'
              }`}
            >
              {item.riskType}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-300 font-semibold truncate">{item.accountName || 'General'}</span>
            {item.projectName && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400 truncate">{item.projectName}</span>
              </>
            )}
          </div>
          <h2 className="text-base font-extrabold text-slate-100 truncate max-w-lg" title={item.description}>
            {item.description}
          </h2>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close Quick Panel"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── 2. Scrollable Body Divided into Clean Sections ── */}
      <div className="flex flex-col divide-y divide-slate-200 flex-1 overflow-y-auto">
        {/* ── SECTION 1: Details & Structured Attributes ── */}
        <div className="p-6 space-y-4 bg-slate-50/40">
          {/* Section Sub-Header with Edit / Save / Cancel Buttons */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">
                {isIssue ? 'Issue Details' : 'Risk Details'}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    disabled={isSaving}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Details</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Details</span>
                </button>
              )}
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Status, Priority, RAG & Scope Badges Row (View Mode) */}
          {!isEditing && (
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge value={item.status} colorMap={STATUS_COLORS} shape="rounded" />
              <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
              {item.rag && <StatusBadge value={item.rag} colorMap={HEALTH_COLORS} shape="rounded" />}

              {item.sourceType === 'Project' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  <FolderGit2 className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Project Scope</span>
                </span>
              ) : item.sourceType === 'Opportunity' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                  <span>Opportunity Scope</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Account Scope</span>
                </span>
              )}

              {item.classification && (
                <span className="text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                  {item.classification}
                </span>
              )}
            </div>
          )}

          {/* Structured Attributes Grid (View vs Edit Mode) */}
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-xs">
              {/* Account (Scope) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" /> Account
                </label>
                <div className="px-2.5 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 truncate">
                  {item.accountName || '—'}
                </div>
              </div>

              {/* Scope / Project */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FolderGit2 className="w-3 h-3 text-slate-400" /> Project / Scope
                </label>
                <div className="px-2.5 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 truncate">
                  {item.projectName || `${item.sourceType} Level`}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Status*</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className={selectFieldClass}
                >
                  {(isIssue ? ISSUE_STATUS_OPTIONS : RISK_STATUS_OPTIONS).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Priority*</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as PriorityLevel })}
                  className={selectFieldClass}
                >
                  {PRIORITY_OPTIONS.map((pr) => (
                    <option key={pr} value={pr}>
                      {pr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Owner */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" /> Assigned Owner
                </label>
                <select
                  value={editForm.ownerId}
                  onChange={(e) => setEditForm({ ...editForm, ownerId: e.target.value })}
                  className={selectFieldClass}
                >
                  <option value="">— Unassigned —</option>
                  {[...serviceProviders]
                    .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {serviceProviderOptionLabel(u)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Risk Open Date / Date Identified */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> {isIssue ? 'Date Identified' : 'Risk Open Date'}
                </label>
                <input
                  type="date"
                  value={editForm.riskOpenDate}
                  onChange={(e) => setEditForm({ ...editForm, riskOpenDate: e.target.value })}
                  className={`${inputFieldClass} font-mono`}
                />
              </div>

              {/* Target Resolution Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Target Resolution Date
                </label>
                <input
                  type="date"
                  value={editForm.targetResolutionDate}
                  onChange={(e) => setEditForm({ ...editForm, targetResolutionDate: e.target.value })}
                  className={`${inputFieldClass} font-mono`}
                />
              </div>

              {/* Impact Level */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-slate-400" /> Impact Level
                </label>
                <select
                  value={editForm.impact}
                  onChange={(e) => setEditForm({ ...editForm, impact: e.target.value })}
                  className={selectFieldClass}
                >
                  <option value="">— Select —</option>
                  {RISK_IMPACT_OPTIONS.map((imp) => (
                    <option key={imp} value={imp}>
                      {imp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Risk specific attributes */}
              {!isIssue && (
                <>
                  {/* Likelihood */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" /> Likelihood
                    </label>
                    <select
                      value={editForm.likelihood}
                      onChange={(e) => setEditForm({ ...editForm, likelihood: e.target.value })}
                      className={selectFieldClass}
                    >
                      <option value="">— Select —</option>
                      {RISK_LIKELIHOOD_OPTIONS.map((lik) => (
                        <option key={lik} value={lik}>
                          {lik}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Calculated Severity */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-slate-400" /> Severity (Calculated)
                    </label>
                    <div className="px-2.5 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                      {computedSeverity ? (
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            computedSeverity === 'High' || computedSeverity === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : computedSeverity === 'Medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {computedSeverity}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">—</span>
                      )}
                    </div>
                  </div>

                  {/* RAG Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">RAG Status</label>
                    <select
                      value={editForm.rag}
                      onChange={(e) => setEditForm({ ...editForm, rag: e.target.value })}
                      className={selectFieldClass}
                    >
                      <option value="">— None —</option>
                      {RISK_RAG_OPTIONS.map((ragOpt) => (
                        <option key={ragOpt} value={ragOpt}>
                          {ragOpt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Classification */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" /> Classification
                    </label>
                    <select
                      value={editForm.classification}
                      onChange={(e) => setEditForm({ ...editForm, classification: e.target.value })}
                      className={selectFieldClass}
                    >
                      <option value="">— Select —</option>
                      {RISK_CLASSIFICATION_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" /> Account
                </span>
                <p className="font-extrabold text-slate-800 truncate" title={item.accountName || '—'}>
                  {item.accountName || '—'}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FolderGit2 className="w-3 h-3 text-slate-400" /> Project / Scope
                </span>
                <p className="font-extrabold text-slate-800 truncate" title={item.projectName || `${item.sourceType} Level`}>
                  {item.projectName || `${item.sourceType} Level`}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" /> Assigned Owner
                </span>
                <p className="font-semibold text-slate-800 truncate" title={item.ownerName || 'Unassigned'}>
                  {item.ownerName || 'Unassigned'}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> {isIssue ? 'Date Identified' : 'Risk Open Date'}
                </span>
                <p className="font-mono font-semibold text-slate-700">{item.riskOpenDate || '—'}</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Target Resolution Date
                </span>
                <p className="font-mono font-semibold text-slate-700">{item.targetResolutionDate || '—'}</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-slate-400" /> Impact Level
                </span>
                <p className="font-semibold text-slate-800">{item.impact || '—'}</p>
              </div>

              {!isIssue && (
                <>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" /> Likelihood
                    </span>
                    <p className="font-semibold text-slate-800">{item.likelihood || '—'}</p>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-slate-400" /> Severity (Calculated)
                    </span>
                    <div>
                      {item.severity ? (
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-xs ${
                            item.severity === 'High' || item.severity === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : item.severity === 'Medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.severity}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" /> Classification
                    </span>
                    <p className="font-semibold text-slate-800">{item.classification || '—'}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Description & Summary Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" /> Description & Summary
            </span>
            {isEditing ? (
              <AutoResizeTextarea
                minRows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Enter description and summary..."
                className={inputFieldClass}
              />
            ) : (
              <p className="text-xs text-slate-800 font-medium leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200/60 whitespace-pre-wrap">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* ── SECTION 2: Comments & Discussion ── */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4.5 h-4.5 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm tracking-tight">Comments & Discussion</h4>
              <span className="text-[11px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded-full border border-blue-200/60">
                {itemComments.length}
              </span>
            </div>
          </div>

          {/* New Comment Input Form with Auto-Adjusting Height */}
          <form onSubmit={handlePostComment} className="flex gap-2 items-start">
            <AutoResizeTextarea
              minRows={2}
              maxHeight="250px"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={`Add a comment or update on this ${isIssue ? 'issue' : 'risk'}...`}
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

          {/* Comments Feed List using CommentCard */}
          <div className="space-y-3">
            {itemComments.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
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
      </div>
    </div>
  );
};
