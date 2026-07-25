/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FolderKanban } from 'lucide-react';
import type { AdminUser, Project, ProjectMethodology, ProjectStatus, Stakeholder } from '@/types';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SearchableSelect,
  SELECT_CLS,
} from '@/components/ui';

export interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  value: Project;
  onChange: (patch: Partial<Project>) => void;
  /** Users list (Administration) — backs the Service Provider PM / Practice Lead selects (both FK users). */
  users: AdminUser[];
  /** Full stakeholders list — filtered here to the project's account + CLIENT type for the Client Name / Client PM selects. */
  stakeholders: Stakeholder[];
}

/**
 * Edit dialog for a Project's Overview fields only — Health, As On Date, and
 * the Overall Progress metrics have their own independent inline edit on the
 * "Overall Progress" tab (see ProjectDetailsView) so the two sections can be
 * edited without affecting one another. Projects are never created manually
 * (they're derived from a Won Opportunity), so this modal is edit-only —
 * opened from the "Edit Project" header action.
 */
export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  value,
  onChange,
  users,
  stakeholders,
}) => {
  const clientStakeholders = stakeholders.filter(
    (s) => s.accountId === value.accountId && s.stakeholderType === 'CLIENT',
  );

  return (
    <FormModal
      isOpen={isOpen}
      title="Edit Project"
      icon={<FolderKanban className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={isSubmitting ? 'Saving…' : 'Save Changes'}
      isSubmitting={isSubmitting}
      submitVariant="warning"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5">
        <FormSection title="Project Information">
          <FormGrid>
            <FormField label="Project Name" required wide>
              <input
                type="text"
                required
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className={INPUT_CLS}
              />
            </FormField>
            <FormField label="Project Description" wide>
              <textarea
                rows={2}
                value={value.description}
                onChange={(e) => onChange({ description: e.target.value })}
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Timeline & Methodology">
          <FormGrid columns={3}>
            <FormField label="Start Date">
              <input
                type="date"
                value={value.startDate ?? ''}
                onChange={(e) => onChange({ startDate: e.target.value || undefined })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>
            <FormField label="End Date">
              <input
                type="date"
                value={value.endDate ?? ''}
                onChange={(e) => onChange({ endDate: e.target.value || undefined })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>
            <FormField label="Methodology">
              <select
                value={value.methodology}
                onChange={(e) => onChange({ methodology: e.target.value as ProjectMethodology })}
                className={SELECT_CLS}
              >
                <option value="Agile">Agile</option>
                <option value="Waterfall">Waterfall</option>
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Assignments">
          <FormGrid>
            <FormField label="Service Provider Project Manager">
              <SearchableSelect
                value={value.serviceProviderPmId ?? ''}
                onChange={(id) => onChange({ serviceProviderPmId: id || undefined })}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                placeholder="Search employees…"
                aria-label="Service Provider Project Manager"
                tone="amber"
              />
            </FormField>
            <FormField label="Practice Lead">
              <select
                value={value.practiceLeadId ?? ''}
                onChange={(e) => onChange({ practiceLeadId: e.target.value || undefined })}
                className={SELECT_CLS}
              >
                <option value="">Not assigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Client Name">
              <select
                value={value.clientStakeholderId ?? ''}
                onChange={(e) => onChange({ clientStakeholderId: e.target.value || undefined })}
                className={SELECT_CLS}
              >
                <option value="">Not assigned</option>
                {clientStakeholders.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Client Project Manager">
              <select
                value={value.clientPmStakeholderId ?? ''}
                onChange={(e) => onChange({ clientPmStakeholderId: e.target.value || undefined })}
                className={SELECT_CLS}
              >
                <option value="">Not assigned</option>
                {clientStakeholders.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Status">
          <FormGrid>
            <FormField label="Status">
              <select
                value={value.status}
                onChange={(e) => onChange({ status: e.target.value as ProjectStatus })}
                className={SELECT_CLS}
              >
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </FormField>
          </FormGrid>
        </FormSection>
      </div>
    </FormModal>
  );
};
