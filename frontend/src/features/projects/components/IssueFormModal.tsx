/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertOctagon } from 'lucide-react';
import type { AdminUser, IssueStatus, PriorityLevel, ProjectIssue } from '@/types';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';

export type IssueDraft = Omit<ProjectIssue, 'id' | 'projectId' | 'ownerName' | 'createdAt' | 'updatedAt'>;

export const emptyIssueDraft: IssueDraft = {
  priority: 'Medium',
  description: '',
  impact: '',
  ownerId: '',
  dateIdentified: '',
  status: 'Open',
  resolutionPlan: '',
  targetResolutionDate: '',
  remarks: '',
};

export interface IssueFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel: string;
  submitVariant?: 'primary' | 'warning';
  value: IssueDraft;
  onChange: (patch: Partial<IssueDraft>) => void;
  users: AdminUser[];
}

/** Add/edit dialog for a Project's Issues tab. */
export const IssueFormModal: React.FC<IssueFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel,
  submitVariant = 'primary',
  value,
  onChange,
  users,
}) => (
  <FormModal
    isOpen={isOpen}
    title={submitVariant === 'warning' ? 'Edit Issue' : 'Add Issue'}
    icon={<AlertOctagon className="w-5 h-5 text-amber-600" aria-hidden="true" />}
    onClose={onClose}
    onSubmit={onSubmit}
    submitLabel={isSubmitting ? 'Saving…' : submitLabel}
    isSubmitting={isSubmitting}
    submitVariant={submitVariant}
    maxWidth="max-w-3xl"
  >
    <div className="space-y-5">
      <FormSection title="Issue Details">
        <FormGrid columns={3}>
          <FormField label="Description" required wide>
            <textarea
              rows={2}
              required
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe the issue..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
          <FormField label="Priority" required>
            <select
              required
              value={value.priority}
              onChange={(e) => onChange({ priority: e.target.value as PriorityLevel })}
              className={SELECT_CLS}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select
              value={value.status}
              onChange={(e) => onChange({ status: e.target.value as IssueStatus })}
              className={SELECT_CLS}
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </FormField>
          <FormField label="Owner">
            <select
              value={value.ownerId ?? ''}
              onChange={(e) => onChange({ ownerId: e.target.value || undefined })}
              className={SELECT_CLS}
            >
              <option value="">Not assigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Impact">
            <input
              type="text"
              value={value.impact ?? ''}
              onChange={(e) => onChange({ impact: e.target.value })}
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Date Identified">
            <input
              type="date"
              value={value.dateIdentified ?? ''}
              onChange={(e) => onChange({ dateIdentified: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Target Resolution Date">
            <input
              type="date"
              value={value.targetResolutionDate ?? ''}
              onChange={(e) => onChange({ targetResolutionDate: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Resolution">
        <FormGrid>
          <FormField label="Resolution Plan">
            <textarea
              rows={2}
              value={value.resolutionPlan}
              onChange={(e) => onChange({ resolutionPlan: e.target.value })}
              placeholder="How will this issue be resolved..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
          <FormField label="Remarks">
            <textarea
              rows={2}
              value={value.remarks}
              onChange={(e) => onChange({ remarks: e.target.value })}
              placeholder="Additional context..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </FormGrid>
      </FormSection>
    </div>
  </FormModal>
);
