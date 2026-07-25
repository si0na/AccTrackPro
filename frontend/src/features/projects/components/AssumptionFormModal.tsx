/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { AdminUser, AssumptionValidationStatus, PriorityLevel, ProjectAssumption } from '@/types';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';

export type AssumptionDraft = Omit<ProjectAssumption, 'id' | 'projectId' | 'ownerName' | 'createdAt' | 'updatedAt'>;

export const emptyAssumptionDraft: AssumptionDraft = {
  priority: 'Medium',
  description: '',
  impactIfFalse: '',
  validationStatus: 'Unvalidated',
  ownerId: '',
  dateIdentified: '',
  targetValidationDate: '',
  remarks: '',
};

export interface AssumptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel: string;
  submitVariant?: 'primary' | 'warning';
  value: AssumptionDraft;
  onChange: (patch: Partial<AssumptionDraft>) => void;
  users: AdminUser[];
}

/** Add/edit dialog for a Project's Assumptions tab. */
export const AssumptionFormModal: React.FC<AssumptionFormModalProps> = ({
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
    title={submitVariant === 'warning' ? 'Edit Assumption' : 'Add Assumption'}
    icon={<HelpCircle className="w-5 h-5 text-purple-600" aria-hidden="true" />}
    onClose={onClose}
    onSubmit={onSubmit}
    submitLabel={isSubmitting ? 'Saving…' : submitLabel}
    isSubmitting={isSubmitting}
    submitVariant={submitVariant}
    maxWidth="max-w-3xl"
  >
    <div className="space-y-5">
      <FormSection title="Assumption Details">
        <FormGrid columns={3}>
          <FormField label="Description" required wide>
            <textarea
              rows={2}
              required
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe the assumption..."
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
          <FormField label="Validation Status">
            <select
              value={value.validationStatus}
              onChange={(e) => onChange({ validationStatus: e.target.value as AssumptionValidationStatus })}
              className={SELECT_CLS}
            >
              <option value="Unvalidated">Unvalidated</option>
              <option value="Validated">Validated</option>
              <option value="Invalidated">Invalidated</option>
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
          <FormField label="Impact If False">
            <input
              type="text"
              value={value.impactIfFalse ?? ''}
              onChange={(e) => onChange({ impactIfFalse: e.target.value })}
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
          <FormField label="Target Validation Date">
            <input
              type="date"
              value={value.targetValidationDate ?? ''}
              onChange={(e) => onChange({ targetValidationDate: e.target.value || undefined })}
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
