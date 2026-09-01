/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCRM } from '@/contexts/CRMContext';
import { usersApi } from '@/api/crm.api';
import { Account, AccountType, AccountHealth, User } from '@/types';
import { Building2, Pencil } from 'lucide-react';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { MultiStakeholderPicker } from '@/components/MultiStakeholderPicker';
import { getCustomerSinceYearOptions } from '@/utils';
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_HEALTH_OPTIONS, LOCATION_OPTIONS, TOWER_OPTIONS } from '@/constants';
import {
  FormGrid,
  FormModal,
  FormSection,
  FormField,
  InlineCreateField,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SearchableSelect,
} from '@/components/ui';

export interface AccountFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  /** The account record being edited; ignored in create mode. */
  account?: Account | null;
  onClose: () => void;
  /** Awaited before closing — throw to keep the dialog open on error. */
  onSubmit: (draft: Omit<Account, 'id'> | Account) => Promise<void> | void;
}

const EMPTY_ACCOUNT: Omit<Account, 'id'> = {
  name: '',
  type: '' as AccountType,
  health: '' as AccountHealth,
  owner: '',
  revenue: 0,
  industry: '',
  since: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  location: '',
  description: '',
  tower: '',
  accountManagerId: '',
  practiceLeadId: '',
  clientPartnerId: '',
  verticalHeadId: '',
};

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  isOpen,
  mode,
  account,
  onClose,
  onSubmit,
}) => {
  const isEdit = mode === 'edit';
  const { stakeholders, serviceProviders, addStakeholder } = useCRM();

  // Users list backing role-filtered option dropdowns
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, [isOpen]);

  // Role-filtered option lists ({ value: id, label: name })
  const accountManagerOptions = useMemo(
    () => users.filter(u => u.roleKey === 'account-manager' || (u.roleKeys && u.roleKeys.includes('account-manager'))).map(u => ({ value: u.id, label: u.name })),
    [users],
  );
  const practiceLeadOptions = useMemo(
    () => users.filter(u => u.roleKey === 'practice-lead' || (u.roleKeys && u.roleKeys.includes('practice-lead'))).map(u => ({ value: u.id, label: u.name })),
    [users],
  );
  const clientPartnerOptions = useMemo(
    () => users.filter(u => u.roleKey === 'client-partner' || (u.roleKeys && u.roleKeys.includes('client-partner'))).map(u => ({ value: u.id, label: u.name })),
    [users],
  );
  const verticalHeadOptions = useMemo(
    () => users.filter(u => u.roleKey === 'vertical-head' || (u.roleKeys && u.roleKeys.includes('vertical-head'))).map(u => ({ value: u.id, label: u.name })),
    [users],
  );

  const [draft, setDraft] = useState<Omit<Account, 'id'> | Account>(EMPTY_ACCOUNT);
  const [selectedClientStakeholderIds, setSelectedClientStakeholderIds] = useState<string[]>([]);
  const [selectedSpUserIds, setSelectedSpUserIds] = useState<string[]>([]);
  const [showAddClientModal, setShowAddClientModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seed form state on open / mode change
  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && account) {
      setDraft(account);
      setSelectedClientStakeholderIds(
        account.clientStakeholderIds ??
          stakeholders.filter(s => s.accountId === account.id && s.stakeholderType === 'CLIENT').map(s => s.id),
      );
      setSelectedSpUserIds(
        account.serviceProviderUserIds ??
          stakeholders
            .filter(s => s.accountId === account.id && s.stakeholderType === 'SERVICE_PROVIDER')
            .map(s => s.userId || s.id)
            .filter(Boolean),
      );
    } else {
      setDraft(EMPTY_ACCOUNT);
      setSelectedClientStakeholderIds([]);
      setSelectedSpUserIds([]);
    }
  }, [isOpen, isEdit, account?.id]);

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.type || !draft.health || !draft.tower) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...draft,
        practiceLeadId: draft.practiceLeadId || null,
        clientPartnerId: draft.clientPartnerId || null,
        verticalHeadId: draft.verticalHeadId || null,
        accountManagerId: draft.accountManagerId || null,
        clientStakeholderIds: selectedClientStakeholderIds.length ? selectedClientStakeholderIds : [],
        serviceProviderUserIds: selectedSpUserIds.length ? selectedSpUserIds : [],
      };
      await onSubmit(payload);
      onClose();
    } catch {
      // Failure toast raised centrally by API client; keep modal open for retries
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        title={isEdit ? `Edit Account Profile — ${account?.name ?? ''}` : 'Create Account Profile'}
        icon={
          isEdit ? (
            <Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />
          ) : (
            <Building2 className="w-5 h-5 text-blue-600" aria-hidden="true" />
          )
        }
        onClose={onClose}
        onSubmit={handleSubmit}
        submitLabel={isEdit ? 'Save Changes' : 'Create Account'}
        submitVariant={isEdit ? 'warning' : 'primary'}
        isSubmitting={isSubmitting}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-5">
          {/* Identity Section */}
          <FormSection title="Identity">
            <FormGrid columns={3}>
              <FormField label="Account Name" required wide>
                <input
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g., Tesla Inc."
                  className={inputCls}
                />
              </FormField>

              <FormField label="Account Type" required>
                <select
                  required
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as AccountType })}
                  className={selectCls}
                >
                  <option value="" disabled>Select type…</option>
                  {ACCOUNT_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Health Status" required>
                <select
                  required
                  value={draft.health}
                  onChange={(e) => setDraft({ ...draft, health: e.target.value as AccountHealth })}
                  className={selectCls}
                >
                  <option value="" disabled>Select health…</option>
                  {ACCOUNT_HEALTH_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </FormField>
            </FormGrid>
          </FormSection>

          {/* Details Section */}
          <FormSection title="Details">
            <FormGrid columns={3}>
              <FormField label="Tower" required>
                <select
                  required
                  value={draft.tower || ''}
                  onChange={(e) => setDraft({ ...draft, tower: e.target.value })}
                  className={selectCls}
                >
                  <option value="" disabled>Select tower…</option>
                  {TOWER_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Industry (Optional)">
                <input
                  type="text"
                  value={draft.industry ?? ''}
                  onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                  placeholder="e.g., Technology"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Customer Since (Optional)">
                <SearchableSelect
                  value={draft.since || ''}
                  onChange={(since) => setDraft({ ...draft, since })}
                  options={getCustomerSinceYearOptions()}
                  placeholder="Select year…"
                  aria-label="Customer since year"
                />
              </FormField>

              <FormField label="Location (Optional)">
                <SearchableSelect
                  value={draft.location || ''}
                  onChange={(location) => setDraft({ ...draft, location })}
                  options={LOCATION_OPTIONS}
                  placeholder="Search countries…"
                  aria-label="Account location"
                />
              </FormField>

              <FormField label="Website (Optional)">
                <input
                  type="text"
                  value={draft.website ?? ''}
                  onChange={(e) => setDraft({ ...draft, website: e.target.value })}
                  placeholder="e.g., https://example.com"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Phone (Optional)">
                <input
                  type="text"
                  value={draft.phone ?? ''}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="e.g., +1 (555) 000-0000"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Email (Optional)">
                <input
                  type="email"
                  value={draft.email ?? ''}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="e.g., contact@company.com"
                  className={inputCls}
                />
              </FormField>

              <FormField label="Address (Optional)">
                <input
                  type="text"
                  value={draft.address ?? ''}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  placeholder="e.g., 123 Corporate Blvd"
                  className={inputCls}
                />
              </FormField>
            </FormGrid>

            <div className="mt-4">
              <FormField label="Description (Optional)">
                <textarea
                  rows={2}
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Brief summary of account..."
                  className={inputCls}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Ownership Section */}
          <FormSection title="Ownership">
            <FormGrid columns={2}>
              <FormField label="Account Manager (Optional)">
                <SearchableSelect
                  value={draft.accountManagerId || ''}
                  onChange={(accountManagerId) => setDraft({ ...draft, accountManagerId })}
                  options={accountManagerOptions}
                  placeholder="Select account manager…"
                  aria-label="Account manager"
                />
              </FormField>

              <FormField label="Practice Lead (Optional)">
                <SearchableSelect
                  value={draft.practiceLeadId || ''}
                  onChange={(practiceLeadId) => setDraft({ ...draft, practiceLeadId })}
                  options={practiceLeadOptions}
                  placeholder="Select practice lead…"
                  aria-label="Practice lead"
                />
              </FormField>

              <FormField label="Client Partner (Optional)">
                <SearchableSelect
                  value={draft.clientPartnerId || ''}
                  onChange={(clientPartnerId) => setDraft({ ...draft, clientPartnerId })}
                  options={clientPartnerOptions}
                  placeholder="Select client partner…"
                  aria-label="Client partner"
                />
              </FormField>

              <FormField label="Vertical Head (Optional)">
                <SearchableSelect
                  value={draft.verticalHeadId || ''}
                  onChange={(verticalHeadId) => setDraft({ ...draft, verticalHeadId })}
                  options={verticalHeadOptions}
                  placeholder="Select vertical head…"
                  aria-label="Vertical head"
                />
              </FormField>
            </FormGrid>
          </FormSection>

          {/* Stakeholders Section */}
          <FormSection title="Stakeholders (Optional)">
            <FormGrid columns={2}>
              <FormField label="Service Provider Stakeholders">
                <MultiStakeholderPicker
                  mode="service-provider"
                  selectedIds={selectedSpUserIds}
                  onChange={setSelectedSpUserIds}
                  serviceProviders={serviceProviders}
                  tone={isEdit ? 'amber' : 'blue'}
                />
              </FormField>

              <InlineCreateField
                label="Client Stakeholders"
                createLabel="client stakeholder"
                onCreate={() => setShowAddClientModal(true)}
              >
                <MultiStakeholderPicker
                  mode="client"
                  selectedIds={selectedClientStakeholderIds}
                  onChange={setSelectedClientStakeholderIds}
                  stakeholders={stakeholders}
                  tone={isEdit ? 'amber' : 'blue'}
                />
              </InlineCreateField>
            </FormGrid>
          </FormSection>
        </div>
      </FormModal>

      {showAddClientModal &&
        createPortal(
          <StakeholderFormModal
            isOpen={true}
            mode="create"
            accounts={[]}
            lockedAccount={{ id: account?.id ?? '', name: draft.name || 'Account' }}
            lockedType="CLIENT"
            onClose={() => setShowAddClientModal(false)}
            onSubmit={async (stkDraft) => {
              const created = await addStakeholder({ ...stkDraft, accountId: account?.id ?? '' });
              setSelectedClientStakeholderIds((ids) => [...ids, created.id]);
              setShowAddClientModal(false);
            }}
          />,
          document.body,
        )}
    </>
  );
};
