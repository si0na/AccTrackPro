import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineCreateField, INPUT_CLS_AMBER, SELECT_CLS } from '@/components/ui';
import { showToast } from '@/components/common/ToastHost';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { useCRM } from '@/contexts/CRMContext';
import type { Stakeholder, StakeholderType } from '@/types';
import { serviceProviderOptionLabel } from '@/utils';

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
 * - **Service Provider**: populated from the full Service Provider directory
 *   (via serviceProviders in CRMContext) — every System User plus every
 *   whitelisted employee who has not registered yet. Neither active status nor
 *   pending registration removes anyone from the list; both are labelled
 *   inline. No manual "Create Service Provider" action.
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
    const normEmail = (draft.email || '').toLowerCase().trim();
    const normName = (draft.name || '').toLowerCase().trim();
    const existing = (stakeholders || []).find((s) => {
      if (draft.accountId && s.accountId && s.accountId !== draft.accountId) return false;
      const sameEmail = normEmail && s.email && s.email.toLowerCase().trim() === normEmail;
      const sameName = normName && s.name && s.name.toLowerCase().trim() === normName;
      return sameEmail || (!normEmail && sameName);
    });
    if (existing) {
      showToast({ kind: 'success', message: `Stakeholder "${existing.name}" already exists. Selected existing record.` });
      onChange({ clientStakeholderId: existing.id });
      setCreatingType(null);
      return;
    }
    const created = await addStakeholder(draft);
    if (created?.id) {
      onChange({ clientStakeholderId: created.id });
    }
    setCreatingType(null);
  };

  const uniqueServiceProviders = React.useMemo(() => {
    const list: typeof serviceProviders = [];
    const seen = new Set<string>();
    for (const sp of serviceProviders) {
      if (sp.id && !seen.has(sp.id)) {
        seen.add(sp.id);
        list.push(sp);
      }
    }
    return list;
  }, [serviceProviders]);

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
          Owner
        </label>
        <select
          value={value.serviceProviderUserId ?? ''}
          onChange={(e) => onChange({ serviceProviderUserId: e.target.value || undefined })}
          className={selectCls}
        >
          <option value="">— None —</option>
          {uniqueServiceProviders.map((sp) => (
            <option key={sp.id} value={sp.id}>{serviceProviderOptionLabel(sp)}</option>
          ))}
        </select>
        {uniqueServiceProviders.length === 0 && (
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
