/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Account, InfluenceLevel, RelationshipStatus, Stakeholder, StakeholderType } from '@/types';
import { Pencil, Users } from 'lucide-react';
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
    if (!draft.name.trim() || !draft.accountId || !draft.stakeholderType) return;
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
        : draft;
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

        {/* Relationship section — Client stakeholders only. Hidden entirely for
            Service Providers so the layout reflows and no space is reserved. */}
        {!isServiceProvider && (
          <FormSection title="Relationship">
            <FormGrid>
              <FormField label="Level of Interest" required>
                <select
                  required
                  value={draft.influence}
                  onChange={(e) => setDraft({ ...draft, influence: e.target.value as InfluenceLevel })}
                  className={selectCls}
                >
                  <option value="" disabled>Select interest…</option>
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
        )}

        <FormSection title="Contact Details">
          <FormGrid>
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
          </FormGrid>
        </FormSection>
      </div>
    </FormModal>
  );
};
