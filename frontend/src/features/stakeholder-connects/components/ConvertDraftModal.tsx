/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { StakeholderConnect, StakeholderConnectDraftFollowUp, Stakeholder, PriorityLevel } from '@/types';
import { stakeholderConnectsApi, type ConvertDraftInput } from '@/api/crm.api';
import { getTodayISODate } from '@/utils';
import {
  FormModal,
  FormField,
  FormGrid,
  INPUT_CLS,
  SELECT_CLS,
  ErrorBanner,
} from '@/components/ui';
import { CheckSquare, AlertCircle } from 'lucide-react';
import { showToast } from '@/components/common/ToastHost';

export interface ConvertDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  connect: StakeholderConnect;
  draft: StakeholderConnectDraftFollowUp;
  accountStakeholders: Stakeholder[];
  onSuccess: () => void;
}

export const ConvertDraftModal: React.FC<ConvertDraftModalProps> = ({
  isOpen,
  onClose,
  connect,
  draft,
  accountStakeholders,
  onSuccess,
}) => {
  const [title, setTitle] = useState(draft.title || '');
  const [description, setDescription] = useState(draft.description || '');
  const [priority, setPriority] = useState<PriorityLevel>(draft.suggestedPriority || 'Medium');
  const [openDate, setOpenDate] = useState(getTodayISODate());
  const [dueDate, setDueDate] = useState(draft.suggestedDueDate || getTodayISODate());
  const [ownerStakeholderId, setOwnerStakeholderId] = useState('');
  const [type, setType] = useState('Client Action');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Eligible stakeholders must strictly belong to the meeting's account
  const eligibleStakeholders = useMemo(() => {
    return accountStakeholders.filter((s) => s.accountId === connect.accountId);
  }, [accountStakeholders, connect.accountId]);

  useEffect(() => {
    setTitle(draft.title || '');
    setDescription(draft.description || '');
    setPriority(draft.suggestedPriority || 'Medium');
    setOpenDate(getTodayISODate());
    setDueDate(draft.suggestedDueDate || getTodayISODate());
    setError(null);

    // If draft has a suggestedAssigneeStakeholderId and it exists in account stakeholders, prefill it
    if (draft.suggestedAssigneeStakeholderId && eligibleStakeholders.some((s) => s.id === draft.suggestedAssigneeStakeholderId)) {
      setOwnerStakeholderId(draft.suggestedAssigneeStakeholderId);
    } else if (eligibleStakeholders.length > 0) {
      setOwnerStakeholderId(eligibleStakeholders[0].id);
    } else {
      setOwnerStakeholderId('');
    }
  }, [draft, eligibleStakeholders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required for the Action Item.');
      return;
    }
    if (!ownerStakeholderId) {
      setError('A client stakeholder owner from this account must be selected.');
      return;
    }
    if (dueDate < openDate) {
      setError('Due date cannot precede open date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: ConvertDraftInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        ownerStakeholderId,
        priority,
        openDate,
        dueDate,
        type,
        comments: comments.trim() || undefined,
      };

      await stakeholderConnectsApi.convertDraft(connect.id, draft.id, payload);
      showToast({ kind: 'success', message: 'Draft follow-up converted to action item successfully.' });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to convert draft follow-up to Action Item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Convert Follow-up to Action Item"
      icon={<CheckSquare className="w-5 h-5 text-blue-600" />}
      submitLabel={isSubmitting ? 'Converting…' : 'Create Action Item'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-800">Fixed Account:</span> {connect.accountName || 'Selected Account'}
            <p className="mt-0.5 text-slate-500 text-[11px]">
              The converted Action Item is permanently bound to this account. Once converted, this draft cannot be converted again.
            </p>
          </div>
        </div>

        <FormField label="Action Item Title" required>
          <input
            type="text"
            required
            className={INPUT_CLS}
            placeholder="e.g. Provide updated SOW draft"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>

        <FormField label="Description">
          <textarea
            className={`${INPUT_CLS} resize-none`}
            rows={3}
            placeholder="Additional context or requirements from the meeting…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <FormGrid columns={2}>
          <FormField label="Owner Stakeholder" required hint="Must be an active client stakeholder in this account.">
            <select
              required
              className={SELECT_CLS}
              value={ownerStakeholderId}
              onChange={(e) => setOwnerStakeholderId(e.target.value)}
            >
              <option value="" disabled>Select stakeholder…</option>
              {eligibleStakeholders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.designation ? `(${s.designation})` : ''} - {s.stakeholderType}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Priority" required>
            <select
              className={SELECT_CLS}
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </FormField>
        </FormGrid>

        <FormGrid columns={2}>
          <FormField label="Open Date" required>
            <input
              type="date"
              required
              className={INPUT_CLS}
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
            />
          </FormField>

          <FormField label="Due Date" required>
            <input
              type="date"
              required
              className={INPUT_CLS}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormField label="Action Item Type">
          <select
            className={SELECT_CLS}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="Client Action">Client Action</option>
            <option value="Internal Task">Internal Task</option>
            <option value="Deliverable">Deliverable</option>
            <option value="Follow-up">Follow-up</option>
          </select>
        </FormField>

        <FormField label="Notes / Comments">
          <input
            type="text"
            className={INPUT_CLS}
            placeholder="Initial comment or reference note (optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </FormField>
      </div>
    </FormModal>
  );
};
