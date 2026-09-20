/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Account, InfluenceLevel, RelationshipStatus, Stakeholder, StakeholderType } from '@/types';
import { Pencil, Users } from 'lucide-react';
import { serviceProviderOptionLabel } from '@/utils';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  PhoneInput,
  STAKEHOLDER_TYPE_LABELS,
} from '@/components/ui';

const EMPTY_STAKEHOLDER: Omit<Stakeholder, 'id'> = {
  name: '',
  accountId: '',
  designation: '',
  influence: '' as InfluenceLevel,
  relationship: '' as RelationshipStatus,
  email: '',
  phone: '',
  stakeholderType: '' as StakeholderType,
  department: '',
  linkedinProfileUrl: '',
  primaryOwnerId: undefined,
  secondaryOwnerId: undefined,
  tertiaryOwnerId: undefined,
  thirdOwnerId: undefined,
};

export interface StakeholderFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  /** The stakeholder being edited; ignored in create mode. */
  stakeholder?: Stakeholder | null;
  accounts: Account[];
  /** Fixes the account association (used inside Account Details). */
  lockedAccount?: { id: string; name: string };
  /**
   * Fixes the stakeholder type (used by the inline-create flow inside the
   * Opportunity form). When set in create mode, the Stakeholder Type control is
   * shown read-only and seeded with this value. Ignored in edit mode.
   */
  lockedType?: StakeholderType;
  onClose: () => void;
  /** Awaited before closing — throw (e.g. failed API call) to keep the dialog open. */
  onSubmit: (draft: Omit<Stakeholder, 'id'>) => Promise<void> | void;
}

/**
 * Shared create/edit dialog for stakeholders, used by both the Stakeholders
 * directory and the Account Details stakeholders tab so the two entry points
 * stay identical.
 */
export const StakeholderFormModal: React.FC<StakeholderFormModalProps> = ({
  isOpen,
  mode,
  stakeholder,
  accounts,
  lockedAccount,
  lockedType,
  onClose,
  onSubmit,
}) => {
  const isEdit = mode === 'edit';
  // The type is fixed only when the inline-create flow supplies it (create mode).
  const isTypeLocked = !isEdit && !!lockedType;
  const [draft, setDraft] = useState<Omit<Stakeholder, 'id'>>(EMPTY_STAKEHOLDER);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { stakeholders: allContextStakeholders, serviceProviders, associateServiceProvider } = useCRM();
  const { serviceProviderOptions, stkIdToOptionIdMap } = useMemo(() => {
    const list: Array<{ id: string; name: string; isSystemUser?: boolean }> = [];
    const seenKeys = new Set<string>();
    const idMap = new Map<string, string>();

    // 1. System Service Providers (system users / employees) take precedence
    if (serviceProviders && serviceProviders.length > 0) {
      for (const spUser of serviceProviders) {
        if (!spUser.id) continue;
        const nameKey = (spUser.email || spUser.name || '').toLowerCase().trim();
        if (seenKeys.has(spUser.id)) continue;
        if (nameKey && seenKeys.has(nameKey)) continue;

        seenKeys.add(spUser.id);
        if (nameKey) seenKeys.add(nameKey);

        const label = serviceProviderOptionLabel(spUser);
        list.push({ id: spUser.id, name: label, isSystemUser: true });
      }
    }

    // 2. Map any SERVICE_PROVIDER stakeholder rows to system user options (if matching) or add as unlinked option
    const spStks = (allContextStakeholders || []).filter((s) => s.stakeholderType === 'SERVICE_PROVIDER');
    for (const sp of spStks) {
      if (!sp.id) continue;
      const nameKey = (sp.email || sp.name || '').toLowerCase().trim();
      const matchingUser = (serviceProviders || []).find(
        (u) =>
          (sp.userId && u.id === sp.userId) ||
          (sp.employeeId && u.id === sp.employeeId) ||
          (u.email && sp.email && u.email.toLowerCase().trim() === sp.email.toLowerCase().trim()) ||
          (nameKey && (u.name || u.email || '').toLowerCase().trim() === nameKey),
      );

      if (matchingUser) {
        idMap.set(sp.id, matchingUser.id);
      } else {
        if (!seenKeys.has(sp.id) && (!nameKey || !seenKeys.has(nameKey))) {
          seenKeys.add(sp.id);
          if (nameKey) seenKeys.add(nameKey);
          const label = sp.designation ? `${sp.name} (${sp.designation})` : (sp.name || sp.email || 'Service Provider');
          list.push({ id: sp.id, name: label });
        }
      }
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    return { serviceProviderOptions: list, stkIdToOptionIdMap: idMap };
  }, [allContextStakeholders, serviceProviders]);

  // Re-seed the draft each time the dialog opens (create → blank, edit → record).
  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && stakeholder) {
      const { id: _id, ...rest } = stakeholder;
      setDraft(rest);
    } else {
      setDraft({
        ...EMPTY_STAKEHOLDER,
        accountId: lockedAccount?.id ?? '',
        stakeholderType: lockedType ?? ('' as StakeholderType),
      });
    }
  }, [isOpen, isEdit, stakeholder, lockedAccount?.id, lockedType]);

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  // The Relationship section (influence + relationship status) applies only to
  // Client stakeholders. For Service Providers those inputs are hidden and not
  // part of the required set.
  const isServiceProvider = draft.stakeholderType === 'SERVICE_PROVIDER';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || (!lockedAccount && !draft.accountId) || !draft.stakeholderType) return;
    // Influence & relationship are only required for Client stakeholders.
    if (!isServiceProvider && (!draft.influence || !draft.relationship)) return;
    setIsSubmitting(true);
    try {
      // Service Providers have no Relationship section, but the backend still
      // requires influence/relationship (NOT NULL columns). Persist hidden
      // defaults for new records while preserving any existing values on edit,
      // so the API contract and stored data stay intact without display.
      const payload: Omit<Stakeholder, 'id'> = isServiceProvider
        ? {
            ...draft,
            influence: (draft.influence || 'Medium') as InfluenceLevel,
            relationship: (draft.relationship || 'Neutral') as RelationshipStatus,
          }
        : { ...draft };

      // Auto-resolve system user selection for owner fields
      const resolveOwnerId = async (ownerId: string | undefined): Promise<string | undefined> => {
        if (!ownerId || !ownerId.trim()) return undefined;
        const opt = serviceProviderOptions.find((o) => o.id === ownerId);
        if (opt?.isSystemUser) {
          if (payload.accountId) {
            const resolvedStkId = await associateServiceProvider(ownerId, payload.accountId);
            if (resolvedStkId) return resolvedStkId;
          }
          return (opt as any).stkId || undefined;
        }
        return ownerId;
      };

      const [pId, sId, tId] = await Promise.all([
        resolveOwnerId(payload.primaryOwnerId),
        resolveOwnerId(payload.secondaryOwnerId),
        resolveOwnerId(payload.tertiaryOwnerId || payload.thirdOwnerId),
      ]);

      payload.primaryOwnerId = pId;
      payload.secondaryOwnerId = sId;
      payload.tertiaryOwnerId = tId;
      payload.thirdOwnerId = tId;

      await onSubmit(payload);
      onClose();
    } catch {
      // Failure toast raised centrally by the API client; keep the dialog open.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? `Edit Stakeholder — ${stakeholder?.name ?? ''}` : 'Register Corporate Stakeholder'}
      icon={
        isEdit
          ? <Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />
          : <Users className="w-5 h-5 text-blue-600" aria-hidden="true" />
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : 'Register Stakeholder'}
      submitVariant={isEdit ? 'warning' : 'primary'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        <FormSection title="Identity & Account">
          <FormGrid columns={3}>
            <FormField label="Stakeholder Name" required>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g., David Miller"
                className={inputCls}
              />
            </FormField>

            <FormField label="Client Account Association" required>
              {lockedAccount ? (
                <input
                  type="text"
                  value={lockedAccount.name}
                  disabled
                  aria-readonly="true"
                  className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
                />
              ) : (
                <select
                  required
                  value={draft.accountId}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                  className={selectCls}
                >
                  <option value="" disabled>Select account…</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField label="Stakeholder Type" required>
              {isTypeLocked ? (
                // Fixed by the inline-create flow — shown read-only so the user
                // sees the context without being able to change it.
                <input
                  type="text"
                  value={STAKEHOLDER_TYPE_LABELS[lockedType!]}
                  disabled
                  aria-readonly="true"
                  className={`${inputCls} bg-slate-50 text-slate-500 cursor-not-allowed`}
                />
              ) : (
                <select
                  required
                  value={draft.stakeholderType}
                  onChange={(e) => setDraft({ ...draft, stakeholderType: e.target.value as StakeholderType })}
                  className={selectCls}
                >
                  <option value="" disabled>Select stakeholder type…</option>
                  <option value="CLIENT">Client Stakeholder</option>
                  {/* SERVICE_PROVIDER is auto-managed from System Users — not manually creatable */}
                </select>
              )}
            </FormField>

            <FormField label="Department">
              <input
                type="text"
                value={draft.department ?? ''}
                onChange={(e) => setDraft({ ...draft, department: e.target.value })}
                placeholder="e.g., Finance, Delivery"
                className={inputCls}
              />
            </FormField>

            <FormField label="Corporate Designation" required>
              <input
                type="text"
                required
                value={draft.designation}
                onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
                placeholder="e.g., CTO"
                className={inputCls}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Relationship & Ownership section — Client stakeholders only. */}
        {!isServiceProvider && (
          <>
            <FormSection title="Relationship">
              <FormGrid>
                <FormField label="Influence Level" required>
                  <select
                    required
                    value={draft.influence}
                    onChange={(e) => setDraft({ ...draft, influence: e.target.value as InfluenceLevel })}
                    className={selectCls}
                  >
                    <option value="" disabled>Select influence level…</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </FormField>

                <FormField label="Relationship Status" required>
                  <select
                    required
                    value={draft.relationship}
                    onChange={(e) => setDraft({ ...draft, relationship: e.target.value as RelationshipStatus })}
                    className={selectCls}
                  >
                    <option value="" disabled>Select relationship…</option>
                    <option value="Strong">Strong</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Weak">Weak</option>
                  </select>
                </FormField>
              </FormGrid>
            </FormSection>

            <FormSection title="Service Provider Ownership">
              <FormGrid columns={3}>
                <FormField label="Primary Owner (Service Provider)">
                  <select
                    value={stkIdToOptionIdMap.get(draft.primaryOwnerId ?? '') ?? draft.primaryOwnerId ?? ''}
                    onChange={(e) => setDraft({ ...draft, primaryOwnerId: e.target.value || undefined })}
                    className={selectCls}
                  >
                    <option value="">None / Select Primary Owner…</option>
                    {serviceProviderOptions.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Secondary Owner (Service Provider)">
                  <select
                    value={stkIdToOptionIdMap.get(draft.secondaryOwnerId ?? '') ?? draft.secondaryOwnerId ?? ''}
                    onChange={(e) => setDraft({ ...draft, secondaryOwnerId: e.target.value || undefined })}
                    className={selectCls}
                  >
                    <option value="">None / Select Secondary Owner…</option>
                    {serviceProviderOptions.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Third Owner (Service Provider)">
                  <select
                    value={
                      stkIdToOptionIdMap.get(draft.tertiaryOwnerId ?? draft.thirdOwnerId ?? '') ??
                      draft.tertiaryOwnerId ??
                      draft.thirdOwnerId ??
                      ''
                    }
                    onChange={(e) => setDraft({ ...draft, tertiaryOwnerId: e.target.value || undefined, thirdOwnerId: e.target.value || undefined })}
                    className={selectCls}
                  >
                    <option value="">None / Select Third Owner…</option>
                    {serviceProviderOptions.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </FormGrid>
            </FormSection>
          </>
        )}

        <FormSection title="Contact Details">
          <FormGrid columns={3}>
            <FormField label="Direct Line Phone">
              <PhoneInput
                value={draft.phone}
                onChange={(phone) => setDraft({ ...draft, phone })}
                tone={isEdit ? 'amber' : 'blue'}
              />
            </FormField>

            <FormField label="Direct Email">
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="e.g., david.miller@company.com"
                className={inputCls}
              />
            </FormField>

            <FormField label="LinkedIn Profile URL (Optional)">
              <input
                type="url"
                value={draft.linkedinProfileUrl ?? ''}
                onChange={(e) => setDraft({ ...draft, linkedinProfileUrl: e.target.value })}
                placeholder="https://www.linkedin.com/in/username"
                className={inputCls}
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </div>
    </FormModal>
  );
};
