/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Flag } from 'lucide-react';
import type { MilestoneStatus, ProjectMilestone } from '@/types';
import { NumberInput } from '@/components/NumberInput';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';

export type MilestoneDraft = Omit<ProjectMilestone, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;

export const emptyMilestoneDraft: MilestoneDraft = {
  name: '',
  sprints: '',
  plannedStart: '',
  plannedEnd: '',
  actualStart: '',
  actualEnd: '',
  status: 'Not Started',
  remarks: '',
  effortPlanned: 0,
  effortSpent: 0,
  costPlanned: 0,
  costSpent: 0,
  completionPct: 0,
};

export interface MilestoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel: string;
  submitVariant?: 'primary' | 'warning';
  value: MilestoneDraft;
  onChange: (patch: Partial<MilestoneDraft>) => void;
}

/** Add/edit dialog for a Project's Milestones tab. */
export const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel,
  submitVariant = 'primary',
  value,
  onChange,
}) => (
  <FormModal
    isOpen={isOpen}
    title={submitVariant === 'warning' ? 'Edit Milestone' : 'Add Milestone'}
    icon={<Flag className="w-5 h-5 text-blue-600" aria-hidden="true" />}
    onClose={onClose}
    onSubmit={onSubmit}
    submitLabel={isSubmitting ? 'Saving…' : submitLabel}
    isSubmitting={isSubmitting}
    submitVariant={submitVariant}
    maxWidth="max-w-3xl"
  >
    <div className="space-y-5">
      <FormSection title="Milestone Details">
        <FormGrid columns={3}>
          <FormField label="Milestone Name" required wide>
            <input
              type="text"
              required
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g., UAT Sign-off"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Sprints">
            <input
              type="text"
              value={value.sprints ?? ''}
              onChange={(e) => onChange({ sprints: e.target.value })}
              placeholder="e.g., Sprint 3-4"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Status">
            <select
              value={value.status}
              onChange={(e) => onChange({ status: e.target.value as MilestoneStatus })}
              className={SELECT_CLS}
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
            </select>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Timeline">
        <FormGrid>
          <FormField label="Planned Start">
            <input
              type="date"
              value={value.plannedStart ?? ''}
              onChange={(e) => onChange({ plannedStart: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Planned End">
            <input
              type="date"
              value={value.plannedEnd ?? ''}
              onChange={(e) => onChange({ plannedEnd: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Actual Start">
            <input
              type="date"
              value={value.actualStart ?? ''}
              onChange={(e) => onChange({ actualStart: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Actual End">
            <input
              type="date"
              value={value.actualEnd ?? ''}
              onChange={(e) => onChange({ actualEnd: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Effort, Cost & Completion">
        <FormGrid columns={3}>
          <FormField label="Effort Planned (Hours)">
            <NumberInput min={0} value={value.effortPlanned} onValueChange={(v) => onChange({ effortPlanned: v })} className={INPUT_CLS} />
          </FormField>
          <FormField label="Effort Spent (Hours)">
            <NumberInput min={0} value={value.effortSpent} onValueChange={(v) => onChange({ effortSpent: v })} className={INPUT_CLS} />
          </FormField>
          <FormField label="Completion (%)">
            <NumberInput min={0} max={100} value={value.completionPct} onValueChange={(v) => onChange({ completionPct: v })} placeholder="0–100" className={INPUT_CLS} />
          </FormField>
          <FormField label="Cost Planned ($)">
            <NumberInput min={0} step="0.01" value={value.costPlanned} onValueChange={(v) => onChange({ costPlanned: v })} className={INPUT_CLS} />
          </FormField>
          <FormField label="Cost Spent ($)">
            <NumberInput min={0} step="0.01" value={value.costSpent} onValueChange={(v) => onChange({ costSpent: v })} className={INPUT_CLS} />
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
