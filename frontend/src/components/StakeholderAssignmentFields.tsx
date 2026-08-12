import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineCreateField, INPUT_CLS_AMBER, SELECT_CLS } from '@/components/ui';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { useCRM } from '@/contexts/CRMContext';
import type { Stakeholder, StakeholderType } from '@/types';

export interface StakeholderAssignmentValue {
  clientStakeholderId?: string;
  /**
   * New user-based selection: the user id of the chosen Service Provider.
   * The backend resolves this to a SERVICE_PROVIDER stakeholder FK on save.
   */
  serviceProviderUserId?: string;
  /** Legacy FK kept for backward-compat read (existing saved records). */
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

/** Shown on the "+" button (tooltip + hint) until an account is chosen. */
const NO_ACCOUNT_MSG = 'Please select an Account before creating a Stakeholder.';

/**
 * Client/Service Provider assignment shared across every Opportunity create
 * and edit entry point.
 *
 * - **Client Stakeholder**: unchanged — filtered stakeholder rows for the account.
 * - **Service Provider**: populated from ALL System Users (via serviceProviders
 *   in CRMContext). Every System User is a Service Provider regardless of their
 *   active status. Inactive users are shown with an [Inactive] label.
 *   No manual "Create Service Provider" action.
 */
export const StakeholderAssignmentFields: React.FC<StakeholderAssignmentFieldsProps> = ({
  accountId,
  stakeholders,
  value,
  onChange,
  tone = 'blue',
}) => {
  const { accounts, addStakeholder, serviceProviders } = useCRM();
  const [creatingType, setCreatingType] = useState<StakeholderType | null>(null);

  const selectCls = tone === 'amber' ? SELECT_CLS_AMBER : SELECT_CLS;
  const account = accounts.find((a) => a.id === accountId);
  const createDisabledReason = account ? undefined : NO_ACCOUNT_MSG;

  const handleCreated = async (draft: Omit<Stakeholder, 'id'>) => {
    const created = await addStakeholder(draft);
    onChange({ clientStakeholderId: created.id });
  };

  return (
    <>
      {/* Client Stakeholder — unchanged */}
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

      {/* Service Provider — all System Users as options, no inline create */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-600">
          Service Provider Stakeholder
        </label>
        <select
          value={value.serviceProviderUserId ?? ''}
          onChange={(e) => onChange({ serviceProviderUserId: e.target.value || undefined })}
          className={selectCls}
        >
          <option value="">— None —</option>
          {serviceProviders.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name || sp.email}{sp.designation ? ` (${sp.designation})` : ''}{!sp.isActive ? ' [Inactive]' : ''}
            </option>
          ))}
        </select>
        {serviceProviders.length === 0 && (
          <p className="text-xs text-slate-400 italic">No system users found.</p>
        )}
      </div>

      {creatingType === 'CLIENT' && account &&
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
