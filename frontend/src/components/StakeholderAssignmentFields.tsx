import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineCreateField, INPUT_CLS_AMBER, SELECT_CLS } from '@/components/ui';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { useCRM } from '@/contexts/CRMContext';
import type { Stakeholder, StakeholderType } from '@/types';

export interface StakeholderAssignmentValue {
  clientStakeholderId?: string;
  serviceProviderStakeholderId?: string;
}

export interface StakeholderAssignmentFieldsProps {
  accountId: string;
  stakeholders: Stakeholder[];
  value: StakeholderAssignmentValue;
  onChange: (patch: Partial<StakeholderAssignmentValue>) => void;
  /**
   * Focus accent for the select controls. Defaults to the blue create-form
   * treatment; pass `'amber'` inside edit dialogs so these fields match the
   * surrounding amber-themed inputs. The inline create workflow is identical
   * either way — only the select's focus ring changes.
   */
  tone?: 'blue' | 'amber';
}

/** Amber-focused select variant, mirroring SELECT_CLS for edit contexts. */
const SELECT_CLS_AMBER = `${INPUT_CLS_AMBER} bg-white cursor-pointer`;

/** Shown on the "+ New" button (tooltip + hint) until an account is chosen. */
const NO_ACCOUNT_MSG = 'Please select an Account before creating a Stakeholder.';

/**
 * Client/Service Provider stakeholder assignment — options are scoped to the
 * selected account and the matching stakeholder type. Shared across every
 * Opportunity create AND edit entry point (the Create dialog, plus the
 * InlineEditModal used by the Opportunities table, Account Details, and
 * Opportunity Details) so the filtering logic and the inline "+ New Stakeholder"
 * workflow can't drift between them.
 *
 * Each field carries a "+ New" action that opens the shared Create Stakeholder
 * dialog inline (account + type pre-filled and locked), so a missing contact can
 * be added without leaving — or losing — the Opportunity form. The dialog is
 * portaled to `document.body` so it stacks above the Opportunity form and never
 * nests one `<form>` inside another. On success the new record is auto-selected;
 * the option lists refresh automatically because `addStakeholder` updates the
 * shared context that feeds the `stakeholders` prop above.
 */
export const StakeholderAssignmentFields: React.FC<StakeholderAssignmentFieldsProps> = ({
  accountId,
  stakeholders,
  value,
  onChange,
  tone = 'blue',
}) => {
  const { accounts, addStakeholder } = useCRM();
  // Which stakeholder type is being created inline (null = no dialog open).
  const [creatingType, setCreatingType] = useState<StakeholderType | null>(null);

  const selectCls = tone === 'amber' ? SELECT_CLS_AMBER : SELECT_CLS;
  const account = accounts.find((a) => a.id === accountId);
  // Creation needs a resolvable account — gate on the found record, not just the id.
  const createDisabledReason = account ? undefined : NO_ACCOUNT_MSG;

  const handleCreated = async (draft: Omit<Stakeholder, 'id'>) => {
    // Awaited by StakeholderFormModal — a throw keeps its dialog open. On
    // success the created record is auto-selected into the matching field.
    const created = await addStakeholder(draft);
    if (created.stakeholderType === 'SERVICE_PROVIDER') {
      onChange({ serviceProviderStakeholderId: created.id });
    } else {
      onChange({ clientStakeholderId: created.id });
    }
  };

  return (
    <>
      <InlineCreateField
        label="Client Stakeholder"
        createLabel="client stakeholder"
        createDisabledReason={createDisabledReason}
        onCreate={() => setCreatingType('CLIENT')}
      >
        <select
          value={value.clientStakeholderId ?? ''}
          onChange={(e) => onChange({ clientStakeholderId: e.target.value })}
          disabled={!accountId}
          className={selectCls}
        >
          <option value="">— None —</option>
          {stakeholders
            .filter((s) => s.accountId === accountId && s.stakeholderType === 'CLIENT')
            .map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
            ))}
        </select>
      </InlineCreateField>

      <InlineCreateField
        label="Service Provider Stakeholder"
        createLabel="service provider stakeholder"
        createDisabledReason={createDisabledReason}
        onCreate={() => setCreatingType('SERVICE_PROVIDER')}
      >
        <select
          value={value.serviceProviderStakeholderId ?? ''}
          onChange={(e) => onChange({ serviceProviderStakeholderId: e.target.value })}
          disabled={!accountId}
          className={selectCls}
        >
          <option value="">— None —</option>
          {stakeholders
            .filter((s) => s.accountId === accountId && s.stakeholderType === 'SERVICE_PROVIDER')
            .map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
            ))}
        </select>
      </InlineCreateField>

      {creatingType && account &&
        createPortal(
          <StakeholderFormModal
            isOpen
            mode="create"
            accounts={accounts}
            lockedAccount={{ id: account.id, name: account.name }}
            lockedType={creatingType}
            onClose={() => setCreatingType(null)}
            onSubmit={handleCreated}
          />,
          document.body,
        )}
    </>
  );
};
