/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCRM } from '@/contexts/CRMContext';
import { usersApi } from '@/api/crm.api';
import { Account, AccountType, AccountHealth, User } from '@/types';
import { Building2, Pencil } from 'lucide-react';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { MultiStakeholderPicker } from '@/components/MultiStakeholderPicker';
import { showToast } from '@/components/common/ToastHost';
import { getCustomerSinceYearOptions, serviceProviderOptionLabel, isRawIdStr } from '@/utils';
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_HEALTH_OPTIONS, LOCATION_OPTIONS, TOWER_OPTIONS, INDUSTRY_OPTIONS } from '@/constants';
import {
  FormGrid,
  FormModal,
  FormSection,
  FormField,
  InlineCreateField,
  SearchableSelect,
  INPUT_CLS,
  INPUT_CLS_AMBER,
} from '@/components/ui';

export interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (draft: Omit<Account, 'id'> | Account) => Promise<void>;
  account?: Account | null;
  mode?: 'create' | 'edit';
}

const EMPTY_ACCOUNT: Omit<Account, 'id'> = {
  name: '',
  type: '' as AccountType,
  health: 'Green',
  healthReason: '',
  industry: '',
  since: '',
  location: '',
  website: '',
  phone: '',
  email: '',
  address: '',
  description: '',
  tower: '',
  practiceLeadId: '',
  clientPartnerId: '',
  verticalHeadId: '',
  accountManagerId: '',
  clientStakeholderIds: [],
  serviceProviderUserIds: [],
};

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  account,
  mode = 'create',
}) => {
  const isEdit = mode === 'edit';
  const { stakeholders, addStakeholder } = useCRM();

  // Users list — backs the four role-filtered "owner" dropdowns on the create
  // form (loaded once on mount, same pattern as ProjectDetailsView).
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, [isOpen]);

  const { practiceLeads, clientPartners, verticalHeads, accountManagers, serviceProviders } = useCRM();

  const buildUserOptions = useCallback((roleUsers: any[]) => {
    return (roleUsers || [])
      .map((u) => ({
        value: u.id,
        label: serviceProviderOptionLabel(u),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, []);

  // Role-filtered option lists ({ value: id, label: name })
  const accountManagerOptions = useMemo(() => buildUserOptions(accountManagers), [accountManagers, buildUserOptions]);
  const practiceLeadOptions = useMemo(() => buildUserOptions(practiceLeads), [practiceLeads, buildUserOptions]);
  const clientPartnerOptions = useMemo(() => buildUserOptions(clientPartners), [clientPartners, buildUserOptions]);
  const verticalHeadOptions = useMemo(() => buildUserOptions(verticalHeads), [verticalHeads, buildUserOptions]);

  const resolveUserFallback = useCallback(
    (id?: string | null, name?: string | null) => {
      if (name && name.trim() && !isRawIdStr(name)) return name;
      if (id) {
        const sp =
          serviceProviders.find((u) => u.id === id || (u as any).userId === id) ||
          accountManagers.find((u) => u.id === id || (u as any).userId === id) ||
          practiceLeads.find((u) => u.id === id || (u as any).userId === id) ||
          clientPartners.find((u) => u.id === id || (u as any).userId === id) ||
          verticalHeads.find((u) => u.id === id || (u as any).userId === id);
        if (sp) return serviceProviderOptionLabel(sp);
      }
      return undefined;
    },
    [serviceProviders, accountManagers, practiceLeads, clientPartners, verticalHeads],
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

              <FormField label="Reason for Health" wide>
                <input
                  type="text"
                  value={draft.healthReason || ''}
                  onChange={(e) => setDraft({ ...draft, healthReason: e.target.value })}
                  placeholder="e.g. Key stakeholder transition, budget freeze, operational stability..."
                  className={inputCls}
                />
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
                <SearchableSelect
                  value={draft.industry ?? ''}
                  onChange={(industry) => setDraft({ ...draft, industry })}
                  options={[...INDUSTRY_OPTIONS]}
                  placeholder="Select industry…"
                  aria-label="Industry"
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
                  fallbackLabel={resolveUserFallback(draft.accountManagerId, (account as any)?.accountManagerName)}
                  placeholder="Select account manager…"
                  aria-label="Account manager"
                  preserveOrder={true}
                />
              </FormField>

              <FormField label="Practice Lead (Optional)">
                <SearchableSelect
                  value={draft.practiceLeadId || ''}
                  onChange={(practiceLeadId) => setDraft({ ...draft, practiceLeadId })}
                  options={practiceLeadOptions}
                  fallbackLabel={resolveUserFallback(draft.practiceLeadId, (account as any)?.practiceLeadName)}
                  placeholder="Select practice lead…"
                  aria-label="Practice lead"
                  preserveOrder={true}
                />
              </FormField>

              <FormField label="Client Partner (Optional)">
                <SearchableSelect
                  value={draft.clientPartnerId || ''}
                  onChange={(clientPartnerId) => setDraft({ ...draft, clientPartnerId })}
                  options={clientPartnerOptions}
                  fallbackLabel={resolveUserFallback(draft.clientPartnerId, (account as any)?.clientPartnerName)}
                  placeholder="Select client partner…"
                  aria-label="Client partner"
                  preserveOrder={true}
                />
              </FormField>

              <FormField label="Vertical Head (Optional)">
                <SearchableSelect
                  value={draft.verticalHeadId || ''}
                  onChange={(verticalHeadId) => setDraft({ ...draft, verticalHeadId })}
                  options={verticalHeadOptions}
                  fallbackLabel={resolveUserFallback(draft.verticalHeadId, (account as any)?.verticalHeadName)}
                  placeholder="Select vertical head…"
                  aria-label="Vertical head"
                  preserveOrder={true}
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
                createDisabledReason={!draft.name?.trim() ? 'Please enter an account name first' : undefined}
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
      lockedAccount={{ id: account?.id || '', name: draft.name || 'Account' }}
      lockedType="CLIENT"
      onClose={() => setShowAddClientModal(false)}
      onSubmit={async (stkDraft) => {
        const normEmail = stkDraft.email?.trim().toLowerCase();
        const normName = stkDraft.name?.trim().toLowerCase();

        const existing = (stakeholders || []).find((s) => {
          if (s.stakeholderType !== 'CLIENT') return false;
          if (normEmail && s.email && s.email.trim().toLowerCase() === normEmail) return true;
          if (!normEmail && normName && s.name.trim().toLowerCase() === normName) return true;
          return false;
        });

        if (existing) {
          if (!selectedClientStakeholderIds.includes(existing.id)) {
            setSelectedClientStakeholderIds((ids) => [...ids, existing.id]);
          }
          showToast({ kind: 'success', message: `Stakeholder "${existing.name}" already exists. Selected existing record.` });
          setShowAddClientModal(false);
          return;
        }

        const created = await addStakeholder({
          ...stkDraft,
          accountId: account?.id ?? '',
        });
        setSelectedClientStakeholderIds((ids) => [...ids, created.id]);
        setShowAddClientModal(false);
      }}
    />,
    document.body,
  )}
    </>
  );
};
