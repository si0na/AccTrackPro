/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckSquare } from 'lucide-react';
import type { Account, ActionItem, ActionItemStatus, ColumnConfig, CustomColumn, Opportunity, PriorityLevel, Stakeholder } from '@/types';
import { ACTION_ITEM_STATUS_OPTIONS } from '@/constants';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { ActionItemOwnerField } from '@/components/ActionItemOwnerField';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';

export type ActionItemDraft = Omit<ActionItem, 'id'>;

export interface ActionItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  value: ActionItemDraft;
  onChange: (patch: Partial<ActionItemDraft>) => void;
  accounts: Account[];
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  actionItemColumns: CustomColumn[];
  actionItemsColumnConfig: ColumnConfig[];
  /** Fixes the account association (used inside Account Details, where the account is already known). */
  lockedAccount?: { id: string; name: string };
  /** Fixes the project association (used inside Project Details, where the project — and its account — are already known). */
  lockedProject?: { id: string; name: string };
}

/**
 * Shared Create dialog for action items — used by both the Action Items
 * page and the Account Details "Add Action Item" flow so the two entry
 * points render an identical field order and section grouping.
 */
export const ActionItemFormModal: React.FC<ActionItemFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Create Task',
  value,
  onChange,
  accounts,
  opportunities,
  stakeholders,
  actionItemColumns,
  actionItemsColumnConfig,
  lockedAccount,
  lockedProject,
}) => (
  <FormModal
    isOpen={isOpen}
    title="Create Action Item"
    icon={<CheckSquare className="w-5 h-5 text-blue-600" aria-hidden="true" />}
    onClose={onClose}
    onSubmit={onSubmit}
    submitLabel={isSubmitting ? 'Adding…' : submitLabel}
    isSubmitting={isSubmitting}
    maxWidth="max-w-4xl"
  >
    <div className="space-y-5">
      <FormSection title="Task Details">
        <FormGrid columns={3}>
          <FormField label="Task Title" required>
            <input
              type="text"
              required
              value={value.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g., Share Technical SLA Draft"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Task Owner" required>
            <ActionItemOwnerField
              accountId={lockedAccount?.id ?? value.accountId}
              stakeholders={stakeholders}
              value={value.ownerStakeholderId}
              onChange={(ownerStakeholderId) => onChange({ ownerStakeholderId })}
            />
          </FormField>

          {lockedAccount ? (
            <FormField label="Target Account">
              <input
                type="text"
                value={lockedAccount.name}
                disabled
                aria-readonly="true"
                className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`}
              />
            </FormField>
          ) : (
            <FormField label="Target Account" required>
              <select
                required
                value={value.accountId}
                onChange={(e) => onChange({ accountId: e.target.value, opportunityId: '' })}
                className={SELECT_CLS}
              >
                <option value="" disabled>Select an account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Associated Opportunity">
            <select
              value={value.opportunityId || ''}
              onChange={(e) => onChange({ opportunityId: e.target.value })}
              className={SELECT_CLS}
            >
              <option value="">None / General Task</option>
              {opportunities
                .filter((opp) => opp.accountId === value.accountId)
                .map((opp) => (
                  <option key={opp.id} value={opp.id}>{opp.name}</option>
                ))}
            </select>
          </FormField>

          {lockedProject && (
            <FormField label="Linked Project">
              <input
                type="text"
                value={lockedProject.name}
                disabled
                aria-readonly="true"
                className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`}
              />
            </FormField>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Scheduling & Priority">
        <FormGrid columns={3}>
          <FormField label="Priority">
            <select
              required
              value={value.priority}
              onChange={(e) => onChange({ priority: e.target.value as PriorityLevel })}
              className={SELECT_CLS}
            >
              <option value="" disabled>Select priority…</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </FormField>

          <FormField label="Status">
            <select
              value={value.status}
              onChange={(e) => onChange({ status: e.target.value as ActionItemStatus })}
              className={SELECT_CLS}
            >
              {ACTION_ITEM_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Open Date" required>
            <input
              type="date"
              required
              value={value.openDate}
              onChange={(e) => onChange({ openDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>

          <FormField label="Due Date" required>
            <input
              type="date"
              required
              value={value.dueDate}
              onChange={(e) => onChange({ dueDate: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Notes">
        <FormField label="Task Details / Notes" wide>
          <textarea
            rows={2}
            value={value.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Additional context or requirements..."
            className={`${INPUT_CLS} resize-none`}
          />
        </FormField>

        <FormField label="Risks & Dependencies" wide>
          <textarea
            rows={2}
            value={value.risksAndDependencies}
            onChange={(e) => onChange({ risksAndDependencies: e.target.value })}
            placeholder="e.g., Pending budget approval, dependent on vendor SOW sign-off"
            className={`${INPUT_CLS} resize-none`}
          />
        </FormField>
      </FormSection>

      {/* Active custom columns (hidden ones excluded) */}
      <CustomColumnFields
        columns={actionItemColumns}
        config={actionItemsColumnConfig}
        values={value}
        onChange={(key, colValue) => onChange({ [key]: colValue } as Partial<ActionItemDraft>)}
      />
    </div>
  </FormModal>
);
