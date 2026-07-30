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
  // Essential planning fields (Create form)
  milestoneNo: '',
  activities: '',
  deliverables: '',
  acceptanceCriteria: '',
  paymentTrigger: '',
  paymentPct: 0,
  paymentAmount: 0,
  targetDate: '',
  // Advanced execution fields (Edit/Detail only)
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
  /**
   * 'create' → lightweight form: only the essential planning fields.
   * 'edit'   → full milestone management: every field (planning + execution).
   */
  mode?: 'create' | 'edit';
}

/**
 * Add/edit dialog for a Project's Milestones tab.
 *
 * Creation is intentionally lightweight — only essential planning information is
 * requested (Basic Information, Scope, Quality, Payment, Schedule). Every other
 * milestone field (Sprints, actual dates, status, effort, cost, completion,
 * remarks) is still fully supported and becomes editable once the milestone
 * exists, via this same dialog in `edit` mode.
 */
export const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel,
  submitVariant = 'primary',
  value,
  onChange,
  mode = 'create',
}) => {
  const isEdit = mode === 'edit';
  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? 'Edit Milestone' : 'Add Milestone'}
      icon={<Flag className="w-5 h-5 text-blue-600" aria-hidden="true" />}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={isSubmitting ? 'Saving…' : submitLabel}
      isSubmitting={isSubmitting}
      submitVariant={submitVariant}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* ── Essential planning fields — always shown ── */}
        <FormSection title="Basic Information">
          <FormGrid>
            <FormField label="Milestone No.">
              <input
                type="text"
                value={value.milestoneNo ?? ''}
                onChange={(e) => onChange({ milestoneNo: e.target.value })}
                placeholder="e.g., M1"
                className={INPUT_CLS}
              />
            </FormField>
            <FormField label="Milestone Name" required>
              <input
                type="text"
                required
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g., UAT Sign-off"
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Scope">
          <FormField label="Activities" wide>
            <textarea
              rows={2}
              value={value.activities ?? ''}
              onChange={(e) => onChange({ activities: e.target.value })}
              placeholder="Work performed to reach this milestone..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
          <FormField label="Deliverables" wide>
            <textarea
              rows={2}
              value={value.deliverables ?? ''}
              onChange={(e) => onChange({ deliverables: e.target.value })}
              placeholder="Tangible outputs of this milestone..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </FormSection>

        <FormSection title="Quality">
          <FormField label="Acceptance Criteria" wide>
            <textarea
              rows={2}
              value={value.acceptanceCriteria ?? ''}
              onChange={(e) => onChange({ acceptanceCriteria: e.target.value })}
              placeholder="Conditions that must be met for sign-off..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </FormSection>

        <FormSection title="Payment">
          <FormGrid columns={3}>
            <FormField label="Payment Trigger">
              <input
                type="text"
                value={value.paymentTrigger ?? ''}
                onChange={(e) => onChange({ paymentTrigger: e.target.value })}
                placeholder="e.g., On UAT sign-off"
                className={INPUT_CLS}
              />
            </FormField>
            <FormField label="Payment %">
              <NumberInput min={0} max={100} value={value.paymentPct} onValueChange={(v) => onChange({ paymentPct: v })} placeholder="0–100" className={INPUT_CLS} />
            </FormField>
            <FormField label="Payment Amount ($)">
              <NumberInput min={0} step="0.01" value={value.paymentAmount} onValueChange={(v) => onChange({ paymentAmount: v })} className={INPUT_CLS} />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Schedule">
          <FormGrid>
            <FormField label="Target Date">
              <input
                type="date"
                value={value.targetDate ?? ''}
                onChange={(e) => onChange({ targetDate: e.target.value || undefined })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>
            {/* Existing scheduling fields (edit only) */}
            {isEdit && (
              <FormField label="Sprints">
                <input
                  type="text"
                  value={value.sprints ?? ''}
                  onChange={(e) => onChange({ sprints: e.target.value })}
                  placeholder="e.g., Sprint 3-4"
                  className={INPUT_CLS}
                />
              </FormField>
            )}
          </FormGrid>
          {isEdit && (
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
          )}
        </FormSection>

        {/* ── Execution fields — edit/detail only ── */}
        {isEdit && (
          <>
            <FormSection title="Execution">
              <FormGrid columns={3}>
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
                <FormField label="Completion (%)">
                  <NumberInput min={0} max={100} value={value.completionPct} onValueChange={(v) => onChange({ completionPct: v })} placeholder="0–100" className={INPUT_CLS} />
                </FormField>
              </FormGrid>
            </FormSection>

            <FormSection title="Effort & Cost">
              <FormGrid columns={3}>
                <FormField label="Effort Planned (Hours)">
                  <NumberInput min={0} value={value.effortPlanned} onValueChange={(v) => onChange({ effortPlanned: v })} className={INPUT_CLS} />
                </FormField>
                <FormField label="Effort Spent (Hours)">
                  <NumberInput min={0} value={value.effortSpent} onValueChange={(v) => onChange({ effortSpent: v })} className={INPUT_CLS} />
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
          </>
        )}
      </div>
    </FormModal>
  );
};
