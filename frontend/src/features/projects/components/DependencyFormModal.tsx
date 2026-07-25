/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link2 } from 'lucide-react';
import type { AdminUser, DependencyStatus, PriorityLevel, ProjectDependency } from '@/types';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';

export type DependencyDraft = Omit<ProjectDependency, 'id' | 'projectId' | 'ownerName' | 'createdAt' | 'updatedAt'>;

export const emptyDependencyDraft: DependencyDraft = {
  priority: 'Medium',
  description: '',
  dependencyType: '',
  dependentTask: '',
  ownerId: '',
  externalParty: '',
  status: 'Open',
  targetResolutionDate: '',
  remarks: '',
};

export interface DependencyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel: string;
  submitVariant?: 'primary' | 'warning';
  value: DependencyDraft;
  onChange: (patch: Partial<DependencyDraft>) => void;
  users: AdminUser[];
}

/** Add/edit dialog for a Project's Dependencies tab. */
export const DependencyFormModal: React.FC<DependencyFormModalProps> = ({
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
    title={submitVariant === 'warning' ? 'Edit Dependency' : 'Add Dependency'}
    icon={<Link2 className="w-5 h-5 text-teal-600" aria-hidden="true" />}
    onClose={onClose}
    onSubmit={onSubmit}
    submitLabel={isSubmitting ? 'Saving…' : submitLabel}
    isSubmitting={isSubmitting}
    submitVariant={submitVariant}
    maxWidth="max-w-3xl"
  >
    <div className="space-y-5">
      <FormSection title="Dependency Details">
        <FormGrid columns={3}>
          <FormField label="Description" required wide>
            <textarea
              rows={2}
              required
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe the dependency..."
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
              onChange={(e) => onChange({ status: e.target.value as DependencyStatus })}
              className={SELECT_CLS}
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </FormField>
          <FormField label="Dependency Type">
            <input
              type="text"
              value={value.dependencyType ?? ''}
              onChange={(e) => onChange({ dependencyType: e.target.value })}
              placeholder="e.g., Internal, External, Technical"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Dependent Task">
            <input
              type="text"
              value={value.dependentTask ?? ''}
              onChange={(e) => onChange({ dependentTask: e.target.value })}
              className={INPUT_CLS}
            />
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
          <FormField label="External Party">
            <input
              type="text"
              value={value.externalParty ?? ''}
              onChange={(e) => onChange({ externalParty: e.target.value })}
              className={INPUT_CLS}
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

      <FormSection title="Remarks">
        <FormField label="Remarks" wide>
          <textarea
            rows={2}
            value={value.remarks}
            onChange={(e) => onChange({ remarks: e.target.value })}
            placeholder="Additional context..."
            className={`${INPUT_CLS} resize-none`}
          />
        </FormField>
      </FormSection>
    </div>
  </FormModal>
);
