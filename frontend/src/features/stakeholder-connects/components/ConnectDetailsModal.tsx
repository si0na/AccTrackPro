/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type {
  StakeholderConnect,
  Stakeholder,
  ActionItem,
  StakeholderConnectDraftFollowUp,
  PriorityLevel,
} from '@/types';
import { stakeholderConnectsApi } from '@/api/crm.api';
import {
  Modal,
  Button,
  StatusBadge,
  CONNECT_STATUS_COLORS,
  PRIORITY_COLORS,
  ACTION_STATUS_COLORS,
  ErrorBanner,
  EmptyState,
} from '@/components/ui';
import { showToast } from '@/components/common/ToastHost';
import {
  CalendarCheck,
  Calendar,
  Clock,
  User,
  Building2,
  Users,
  FileText,
  ListTodo,
  History,
  Plus,
  Trash2,
  Pencil,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  CalendarClock,
  Ban,
  CheckSquare,
} from 'lucide-react';
import { ConvertDraftModal } from './ConvertDraftModal';
import { RescheduleModal } from './RescheduleModal';
import { CancelModal } from './CancelModal';
import { ConnectFormModal } from './ConnectFormModal';

export interface ConnectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectId: string | null;
  accounts: any[];
  stakeholders: Stakeholder[];
  serviceProviders: any[];
  actionItems: ActionItem[];
  canEdit: boolean;
  canDelete: boolean;
  currentUserId?: string;
  onConnectChanged: () => void;
}

export const ConnectDetailsModal: React.FC<ConnectDetailsModalProps> = ({
  isOpen,
  onClose,
  connectId,
  accounts,
  stakeholders,
  serviceProviders,
  actionItems,
  canEdit,
  canDelete,
  currentUserId,
  onConnectChanged,
}) => {
  const [connect, setConnect] = useState<StakeholderConnect | null>(null);
  const [activeTab, setActiveTab] = useState<'mom' | 'attendees' | 'drafts' | 'actionItems' | 'history'>('mom');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [convertTargetDraft, setConvertTargetDraft] = useState<StakeholderConnectDraftFollowUp | null>(null);

  // MoM edit state
  const [isEditingMom, setIsEditingMom] = useState(false);
  const [momText, setMomText] = useState('');
  const [isSavingMom, setIsSavingMom] = useState(false);

  // New Draft inline state
  const [showAddDraft, setShowAddDraft] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAssigneeId, setDraftAssigneeId] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftPriority, setDraftPriority] = useState<PriorityLevel>('Medium');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Add Attendee inline state
  const [selectedNewAttendeeId, setSelectedNewAttendeeId] = useState('');
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);

  // Link Action Item inline state
  const [selectedLinkActionItemId, setSelectedLinkActionItemId] = useState('');
  const [isLinkingActionItem, setIsLinkingActionItem] = useState(false);

  const fetchConnect = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await stakeholderConnectsApi.getById(id);
      setConnect(data);
      setMomText(data.mom || data.momNotes || '');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load connect details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && connectId) {
      fetchConnect(connectId);
      setIsEditingMom(false);
      setShowAddDraft(false);
    } else {
      setConnect(null);
    }
  }, [isOpen, connectId]);

  // Account stakeholders available for attendee addition
  const availableAttendees = useMemo(() => {
    if (!connect) return [];
    const currentAttendeeIds = new Set(
      connect.attendees?.map((a: any) => a.stakeholderId || a.id) || []
    );
    return stakeholders.filter(
      (s) =>
        (s.accountId === connect.accountId || (s.stakeholderType === 'SERVICE_PROVIDER' && !s.accountId)) &&
        !currentAttendeeIds.has(s.id)
    );
  }, [connect, stakeholders]);

  // Account action items available for linking (exclude already linked items and cross-account items)
  const availableActionItems = useMemo(() => {
    if (!connect) return [];
    const linkedIds = new Set(
      connect.linkedActionItems?.map((lai: any) => lai.actionItemId || lai.id).filter(Boolean) || []
    );
    return actionItems.filter(
      (ai) => ai.accountId === connect.accountId && !linkedIds.has(ai.id) && !ai.isDeleted
    );
  }, [connect, actionItems]);

  const handleSaveMom = async () => {
    if (!connect) return;
    setIsSavingMom(true);
    setError(null);
    try {
      const updated = await stakeholderConnectsApi.update(connect.id, {
        mom: momText.trim() || undefined,
        momNotes: momText.trim() || undefined,
      });
      setConnect(updated);
      setMomText(updated.mom || updated.momNotes || '');
      setIsEditingMom(false);
      showToast({ kind: 'success', message: 'Minutes of Meeting saved successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save Minutes of Meeting.');
    } finally {
      setIsSavingMom(false);
    }
  };

  const handlePromptComplete = () => {
    if (!connect) return;
    setError(null);

    // Frontend validation: Check if meeting date/time is in the future
    const [y, m, d] = (connect.meetingDate || '').split('-').map(Number);
    const [hh, mm] = (connect.meetingTime || '00:00').slice(0, 5).split(':').map(Number);
    const meetingDt = new Date(y, m - 1, d, hh || 0, mm || 0, 0);

    if (meetingDt.getTime() > Date.now()) {
      setError('A future meeting cannot be marked as completed. Update the meeting date/time after it has taken place.');
      return;
    }

    setIsCompleteConfirmOpen(true);
  };

  const handleConfirmComplete = async () => {
    if (!connect) return;
    setIsCompleting(true);
    setError(null);
    try {
      const updated = await stakeholderConnectsApi.complete(connect.id);
      setConnect(updated);
      setIsCompleteConfirmOpen(false);
      showToast({ kind: 'success', message: 'Meeting marked as completed successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to complete meeting.');
      setIsCompleteConfirmOpen(false);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAddAttendee = async () => {
    if (!connect || !selectedNewAttendeeId) return;
    setIsAddingAttendee(true);
    setError(null);
    try {
      await stakeholderConnectsApi.addAttendee(connect.id, selectedNewAttendeeId);
      setSelectedNewAttendeeId('');
      await fetchConnect(connect.id);
      showToast({ kind: 'success', message: 'Attendee added successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to add attendee.');
    } finally {
      setIsAddingAttendee(false);
    }
  };

  const handleRemoveAttendee = async (stakeholderId: string) => {
    if (!connect) return;
    if ((connect.attendees?.length || 0) <= 1) {
      setError('Cannot remove attendee: A meeting must have at least one attendee.');
      return;
    }
    setError(null);
    try {
      await stakeholderConnectsApi.removeAttendee(connect.id, stakeholderId);
      await fetchConnect(connect.id);
      showToast({ kind: 'success', message: 'Attendee removed successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to remove attendee.');
    }
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connect || !draftTitle.trim()) return;
    setIsSavingDraft(true);
    setError(null);
    try {
      await stakeholderConnectsApi.createDraft(connect.id, {
        title: draftTitle.trim(),
        description: draftDescription.trim() || undefined,
        suggestedAssigneeStakeholderId: draftAssigneeId || undefined,
        suggestedDueDate: draftDueDate || undefined,
        suggestedPriority: draftPriority,
      });
      setDraftTitle('');
      setDraftDescription('');
      setDraftAssigneeId('');
      setDraftDueDate('');
      setDraftPriority('Medium');
      setShowAddDraft(false);
      await fetchConnect(connect.id);
      showToast({ kind: 'success', message: 'Draft follow-up created successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create draft follow-up.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!connect) return;
    setError(null);
    try {
      await stakeholderConnectsApi.deleteDraft(connect.id, draftId);
      await fetchConnect(connect.id);
      showToast({ kind: 'success', message: 'Draft follow-up deleted successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete draft follow-up.');
    }
  };

  const handleLinkActionItem = async () => {
    if (!connect || !selectedLinkActionItemId) return;
    setIsLinkingActionItem(true);
    setError(null);
    try {
      await stakeholderConnectsApi.linkActionItem(connect.id, selectedLinkActionItemId);
      setSelectedLinkActionItemId('');
      await fetchConnect(connect.id);
      showToast({ kind: 'success', message: 'Action item linked successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to link Action Item.');
    } finally {
      setIsLinkingActionItem(false);
    }
  };

  const handleUnlinkActionItem = async (actionItemId: string) => {
    if (!connect) return;
    setError(null);
    try {
      await stakeholderConnectsApi.unlinkActionItem(connect.id, actionItemId);
      await fetchConnect(connect.id);
      showToast({ kind: 'success', message: 'Action item unlinked successfully.' });
      onConnectChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to unlink Action Item.');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={connect?.title || 'Connect Details'} maxWidth="max-w-4xl">
      <div className="flex flex-col max-h-[88vh]">
        {/* Header / Summary Card */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-[280px]">
              <div className="flex items-center gap-2.5">
                <StatusBadge
                  value={connect?.status || 'Scheduled'}
                  colorMap={CONNECT_STATUS_COLORS}
                />
                <span className="text-xs text-slate-400 font-mono">
                  ID: {connect?.id.slice(0, 8)}…
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {connect?.title || 'Loading…'}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {connect?.accountName || 'Account'}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  {connect?.meetingDate}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  {connect?.meetingTime?.slice(0, 5)}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  Host: {connect?.ownerName || 'Unknown Host'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            {connect && (
              <div className="flex items-center gap-2">
                {connect.status === 'Completed' && (
                  <span className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Completed (View Only)</span>
                  </span>
                )}

                {connect.status === 'Cancelled' && (
                  <span className="text-xs px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium flex items-center gap-1.5">
                    <Ban className="w-4 h-4 text-rose-600" />
                    <span>Cancelled (View Only)</span>
                  </span>
                )}

                {canEdit && (connect.status === 'Scheduled' || connect.status === 'Rescheduled') && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditOpen(true)}
                      className="gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsRescheduleOpen(true)}
                      className="gap-1.5 text-purple-700 hover:bg-purple-50 border-purple-200"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                      <span>Reschedule</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePromptComplete}
                      className="gap-1.5 text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mark as Completed</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsCancelOpen(true)}
                      className="gap-1.5 text-rose-600 hover:bg-rose-50 border-rose-200"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {connect?.cancellationReason && (
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Cancellation Reason:</span> {connect.cancellationReason}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 border-b border-slate-200">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 px-6 bg-slate-50/60 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('mom')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'mom'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Minutes of Meeting (MoM)</span>
          </button>
          <button
            onClick={() => setActiveTab('attendees')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'attendees'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Attendees ({connect?.attendees?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'drafts'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Draft Follow-ups ({connect?.draftFollowUps?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('actionItems')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'actionItems'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Linked Action Items ({connect?.linkedActionItems?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Reschedule History ({connect?.rescheduleHistory?.length || 0})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB: MoM */}
          {activeTab === 'mom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Minutes of Meeting</h3>
                  <p className="text-xs text-slate-500">
                    Discussion notes, key decisions, client feedback, and agreed objectives.
                  </p>
                </div>
                {!isEditingMom && canEdit && connect?.status !== 'Cancelled' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMomText(connect?.mom || connect?.momNotes || '');
                      setIsEditingMom(true);
                    }}
                    className="gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit MoM</span>
                  </Button>
                )}
              </div>

              {isEditingMom ? (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Minutes of Meeting (MoM) Editor
                    </label>
                    <textarea
                      rows={8}
                      className="w-full text-xs font-normal text-slate-800 bg-white border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                      placeholder="Enter detailed discussion points, action takeaways, and meeting minutes…"
                      value={momText}
                      onChange={(e) => setMomText(e.target.value)}
                    />
                  </div>

                  {/* Reference of previously saved MoM */}
                  {(connect?.mom || connect?.momNotes) && (
                    <div className="bg-white/90 border border-slate-200 rounded-lg p-3 text-xs">
                      <span className="font-semibold text-slate-600 block mb-1">
                        Currently Saved MoM (Reference):
                      </span>
                      <p className="text-slate-500 whitespace-pre-wrap text-[11px] max-h-36 overflow-y-auto leading-relaxed">
                        {connect.mom || connect.momNotes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMomText(connect?.mom || connect?.momNotes || '');
                        setIsEditingMom(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isSavingMom}
                      onClick={handleSaveMom}
                    >
                      {isSavingMom ? 'Saving…' : 'Save MoM'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 min-h-[140px] text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {(connect?.mom || connect?.momNotes) ? (
                    connect.mom || connect.momNotes
                  ) : (
                    <span className="text-slate-400 italic">
                      No Minutes of Meeting recorded yet. Click &quot;Edit MoM&quot; to add notes.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: Attendees */}
          {activeTab === 'attendees' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Meeting Attendees</h3>
                  <p className="text-xs text-slate-500">
                    Stakeholders participating in this connect. All attendees belong to {connect?.accountName}.
                  </p>
                </div>

                {canEdit && availableAttendees.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={selectedNewAttendeeId}
                      onChange={(e) => setSelectedNewAttendeeId(e.target.value)}
                    >
                      <option value="">Select stakeholder to add…</option>
                      {availableAttendees.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.designation ? `(${s.designation})` : ''} - {s.stakeholderType}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!selectedNewAttendeeId || isAddingAttendee}
                      onClick={handleAddAttendee}
                      className="gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {connect?.attendees?.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {att.name || 'Unnamed Stakeholder'}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold ${
                            att.stakeholderType === 'SERVICE_PROVIDER'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {att.stakeholderType === 'SERVICE_PROVIDER' ? 'Service Provider' : 'Client'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {att.designation || 'No designation'} {att.department ? `• ${att.department}` : ''}
                      </p>
                      {att.email && (
                        <p className="text-[10px] text-slate-400 font-mono">{att.email}</p>
                      )}
                    </div>

                    {canEdit && (connect.attendees?.length || 0) > 1 && (
                      <button
                        type="button"
                        title="Remove attendee"
                        onClick={() => handleRemoveAttendee(att.stakeholderId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Draft Follow-ups */}
          {activeTab === 'drafts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Draft Follow-ups</h3>
                  <p className="text-xs text-slate-500">
                    Potential tasks and action points identified during the meeting. Convert them atomically into formal Action Items when ready.
                  </p>
                </div>
                {canEdit && !showAddDraft && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAddDraft(true)}
                    className="gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Follow-up</span>
                  </Button>
                )}
              </div>

              {/* Add Draft Form */}
              {showAddDraft && (
                <form
                  onSubmit={handleCreateDraft}
                  className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-blue-600" /> New Draft Follow-up
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddDraft(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Follow-up title (required)…"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                    />
                    <textarea
                      rows={2}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                      placeholder="Optional details or context…"
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={draftAssigneeId}
                      onChange={(e) => setDraftAssigneeId(e.target.value)}
                    >
                      <option value="">Suggested Stakeholder…</option>
                      {stakeholders
                        .filter((s) => s.accountId === connect?.accountId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.stakeholderType})
                          </option>
                        ))}
                    </select>

                    <input
                      type="date"
                      className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={draftDueDate}
                      onChange={(e) => setDraftDueDate(e.target.value)}
                      placeholder="Suggested due date"
                    />

                    <select
                      className="text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={draftPriority}
                      onChange={(e) => setDraftPriority(e.target.value as PriorityLevel)}
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isSavingDraft || !draftTitle.trim()}
                      type="submit"
                    >
                      {isSavingDraft ? 'Saving…' : 'Save Draft'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Draft List */}
              {connect?.draftFollowUps && connect.draftFollowUps.length > 0 ? (
                <div className="space-y-2.5">
                  {connect.draftFollowUps.map((draft) => {
                    const isConverted = !!draft.convertedAt;
                    return (
                      <div
                        key={draft.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isConverted
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">{draft.title}</span>
                              {isConverted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" /> Converted to Action Item
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                  Draft Follow-up
                                </span>
                              )}
                              {draft.suggestedPriority && (
                                <StatusBadge
                                  value={draft.suggestedPriority}
                                  colorMap={PRIORITY_COLORS}
                                />
                              )}
                            </div>

                            {draft.description && (
                              <p className="text-xs text-slate-600">{draft.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                              {draft.suggestedAssigneeName && (
                                <span>Suggested: <strong className="text-slate-600">{draft.suggestedAssigneeName}</strong></span>
                              )}
                              {draft.suggestedDueDate && (
                                <span>Target: <strong className="text-slate-600">{draft.suggestedDueDate}</strong></span>
                              )}
                              {isConverted && draft.convertedAt && (
                                <span className="text-emerald-700">
                                  Converted on {new Date(draft.convertedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isConverted && canEdit && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setConvertTargetDraft(draft)}
                                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                  <span>Convert</span>
                                </Button>
                                <button
                                  type="button"
                                  title="Delete draft"
                                  onClick={() => handleDeleteDraft(draft.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No follow-ups recorded"
                  hint="Capture actionable takeaways from the meeting as lightweight draft follow-ups."
                />
              )}
            </div>
          )}

          {/* TAB: Linked Action Items */}
          {activeTab === 'actionItems' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Linked Action Items</h3>
                  <p className="text-xs text-slate-500">
                    Formal Action Items connected to this meeting. Shows live status and assignee from the Action Items module.
                  </p>
                </div>

                {canEdit && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor="link-existing-action-item" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Link an existing Action Item:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="link-existing-action-item"
                        aria-label="Link an existing Action Item"
                        disabled={availableActionItems.length === 0 || isLinkingActionItem}
                        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[280px] disabled:bg-slate-100 disabled:text-slate-400"
                        value={selectedLinkActionItemId}
                        onChange={(e) => setSelectedLinkActionItemId(e.target.value)}
                      >
                        <option value="">
                          {availableActionItems.length === 0
                            ? 'No further Action Items available to link'
                            : 'Select an Action Item to link…'}
                        </option>
                        {availableActionItems.map((ai) => (
                          <option key={ai.id} value={ai.id}>
                            {ai.actionItemNumber ? `${ai.actionItemNumber} - ` : ''}{ai.title} ({ai.status})
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!selectedLinkActionItemId || isLinkingActionItem || availableActionItems.length === 0}
                        onClick={handleLinkActionItem}
                        className="gap-1 shrink-0"
                        title="Link selected Action Item to this meeting"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>{isLinkingActionItem ? 'Linking…' : 'Link'}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {connect?.linkedActionItems && connect.linkedActionItems.length > 0 ? (
                <div className="space-y-2.5">
                  {connect.linkedActionItems.map((item) => (
                    <div
                      key={item.id || item.actionItemId}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.actionItemNumber && (
                            <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {item.actionItemNumber}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-800">
                            {item.title || 'Action Item'}
                          </span>
                          {item.status && (
                            <StatusBadge
                              value={item.status}
                              colorMap={ACTION_STATUS_COLORS}
                            />
                          )}
                          {item.priority && (
                            <StatusBadge
                              value={item.priority}
                              colorMap={PRIORITY_COLORS}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                          <span>Owner: <strong className="text-slate-700">{item.ownerStakeholderName || item.ownerName || 'Unassigned'}</strong></span>
                          {item.dueDate && <span>Due: <strong className="text-slate-700">{item.dueDate}</strong></span>}
                          {item.isDeleted && (
                            <span className="text-red-500 font-semibold">[Soft-deleted]</span>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkActionItem(item.actionItemId || item.id)}
                          className="gap-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Unlink Action Item"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Unlink</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No Action Items linked"
                  hint="Link existing Action Items from this account or convert draft follow-ups above."
                />
              )}
            </div>
          )}

          {/* TAB: Reschedule History */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Rescheduling History</h3>
                <p className="text-xs text-slate-500">
                  Audit log of date and time changes made to this meeting.
                </p>
              </div>

              {connect?.rescheduleHistory && connect.rescheduleHistory.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Previous Schedule</th>
                        <th className="py-2.5 px-4">New Schedule</th>
                        <th className="py-2.5 px-4">Reason</th>
                        <th className="py-2.5 px-4">Rescheduled By</th>
                        <th className="py-2.5 px-4">Changed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {connect.rescheduleHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                            {item.previousDate} {item.previousTime?.slice(0, 5)}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-purple-700">
                            {item.newDate} {item.newTime?.slice(0, 5)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 italic">
                            {item.reason || '—'}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {item.rescheduledByName || 'System'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No rescheduling history"
                  hint="This meeting has remained on its original scheduled date and time."
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals */}
      {connect && isEditOpen && (
        <ConnectFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={async (updated) => {
            setConnect(updated);
            onConnectChanged();
          }}
          accounts={accounts}
          stakeholders={stakeholders}
          serviceProviders={serviceProviders}
          currentUserId={currentUserId}
          editConnect={connect}
        />
      )}

      {connect && isRescheduleOpen && (
        <RescheduleModal
          isOpen={isRescheduleOpen}
          onClose={() => setIsRescheduleOpen(false)}
          connect={connect}
          onSuccess={async () => {
            await fetchConnect(connect.id);
            onConnectChanged();
          }}
        />
      )}

      {connect && isCancelOpen && (
        <CancelModal
          isOpen={isCancelOpen}
          onClose={() => setIsCancelOpen(false)}
          connect={connect}
          onSuccess={async () => {
            await fetchConnect(connect.id);
            onConnectChanged();
          }}
        />
      )}

      {connect && convertTargetDraft && (
        <ConvertDraftModal
          isOpen={!!convertTargetDraft}
          onClose={() => setConvertTargetDraft(null)}
          connect={connect}
          draft={convertTargetDraft}
          accountStakeholders={stakeholders.filter((s) => s.accountId === connect.accountId)}
          onSuccess={async () => {
            await fetchConnect(connect.id);
            onConnectChanged();
          }}
        />
      )}

      {/* Confirmation modal for Mark as Completed */}
      {connect && isCompleteConfirmOpen && (
        <Modal
          isOpen={isCompleteConfirmOpen}
          onClose={() => setIsCompleteConfirmOpen(false)}
          title="Mark Meeting as Completed"
          maxWidth="max-w-md"
        >
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Confirm Completion</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to mark <span className="font-semibold text-slate-900">"{connect.title}"</span> as Completed?
                </p>
                <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2">
                  <p>• Meeting Date: <span className="font-medium text-slate-700">{connect.meetingDate} at {connect.meetingTime?.slice(0, 5)}</span></p>
                  <p className="mt-0.5">• Completed meetings are read-only and cannot be rescheduled or cancelled.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCompleteConfirmOpen(false)}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isCompleting}
                onClick={handleConfirmComplete}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isCompleting ? 'Completing…' : 'Confirm & Complete'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

