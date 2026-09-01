/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { Account, ColumnConfig, CustomColumn, Opportunity, OpportunityStage, Stakeholder } from '@/types';
import { OPPORTUNITY_STAGE_OPTIONS, stageChangePatch, LOCATION_OPTIONS } from '@/constants';
import { NumberInput } from '@/components/NumberInput';
import { AopYearFields } from '@/components/AopYearFields';
import { StakeholderAssignmentFields } from '@/components/StakeholderAssignmentFields';
import { OpportunityClassificationFields } from '@/components/OpportunityClassificationFields';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { useCRM } from '@/contexts/CRMContext';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
  SearchableSelect,
} from '@/components/ui';

export type OpportunityDraft = Omit<Opportunity, 'id'>;

export interface OpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  value: OpportunityDraft;
  onChange: (patch: Partial<OpportunityDraft>) => void;
  accounts: Account[];
  stakeholders: Stakeholder[];
  opportunityColumns: CustomColumn[];
  opportunitiesColumnConfig: ColumnConfig[];
  /** Fixes the account association (used inside Account Details, where the account is already known). */
  lockedAccount?: { id: string; name: string };
}

/**
 * Shared Create dialog for opportunities — used by both the Opportunities
 * page and the Account Details "Add Opportunity" flow so the two entry
 * points render an identical field order and section grouping.
 */
export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Create Opportunity',
  value,
  onChange,
  accounts,
  stakeholders,
  opportunityColumns,
  opportunitiesColumnConfig,
  lockedAccount,
}) => {


  return (
    <FormModal
      isOpen={isOpen}
      title="Create Corporate Opportunity"
      icon={<TrendingUp className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={isSubmitting ? 'Adding…' : submitLabel}
      isSubmitting={isSubmitting}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5">
        <FormSection title="Deal Information">
          <FormGrid>
            {lockedAccount ? (
              <FormField label="Account Name">
                <input
                  type="text"
                  value={lockedAccount.name}
                  disabled
                  aria-readonly="true"
                  className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`}
                />
              </FormField>
            ) : (
              <FormField label="Account Name" required>
                <select
                  required
                  value={value.accountId}
                  onChange={(e) => onChange({ accountId: e.target.value, clientStakeholderId: '', serviceProviderStakeholderId: '' })}
                  className={SELECT_CLS}
                >
                  <option value="" disabled>Select an account...</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Opportunity Name" required>
              <input
                type="text"
                required
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="e.g., Salesforce Integration"
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Classification">
          <FormGrid columns={3}>
            <FormField label="Stage" required>
              <select
                required
                value={value.stage ?? ''}
                onChange={(e) => onChange(stageChangePatch(e.target.value as OpportunityStage))}
                className={SELECT_CLS}
              >
                <option value="" disabled>— Select —</option>
                {OPPORTUNITY_STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Probability (%)">
              <NumberInput
                min={0}
                max={100}
                value={value.probability}
                onValueChange={(v) => onChange({ probability: v })}
                placeholder="0–100"
                className={INPUT_CLS}
              />
            </FormField>

            <OpportunityClassificationFields
              value={{
                opportunityType: value.opportunityType,
                serviceLine: value.serviceLine,
                opportunityHealth: value.opportunityHealth,
                priority: value.priority,
                deliveryModel: value.deliveryModel,
                billingModel: value.billingModel,
                tower: value.tower,
              }}
              onChange={onChange}
            />
          </FormGrid>

          {/* Win/Loss reason — optional; captured when available for win/loss analysis */}
          {(value.stage === 'Won' || value.stage === 'Lost') && (
            <FormGrid className="mt-4">
              <FormField label={value.stage === 'Won' ? 'Win Reason' : 'Loss Reason'} wide>
                <textarea
                  rows={2}
                  value={value.closeReason ?? ''}
                  onChange={(e) => onChange({ closeReason: e.target.value })}
                  placeholder={value.stage === 'Won'
                    ? 'e.g., Strong technical fit and competitive pricing'
                    : 'e.g., Lost to competitor on price'}
                  className={`${INPUT_CLS} resize-none`}
                />
              </FormField>
            </FormGrid>
          )}

          {/* Blocked/Delayed reason — optional; a distinct concept from Risks & Dependencies */}
          {value.stage === 'Blocked' && (
            <FormGrid className="mt-4">
              <FormField label="Blocked Reason" wide>
                <textarea
                  rows={2}
                  value={value.blockedReason ?? ''}
                  onChange={(e) => onChange({ blockedReason: e.target.value })}
                  placeholder="Describe why this opportunity is currently blocked..."
                  className={`${INPUT_CLS} resize-none`}
                />
              </FormField>
            </FormGrid>
          )}
          {value.stage === 'Delayed' && (
            <FormGrid className="mt-4">
              <FormField label="Delayed Reason" wide>
                <textarea
                  rows={2}
                  value={value.delayedReason ?? ''}
                  onChange={(e) => onChange({ delayedReason: e.target.value })}
                  placeholder="Describe why this opportunity has been delayed..."
                  className={`${INPUT_CLS} resize-none`}
                />
              </FormField>
            </FormGrid>
          )}
        </FormSection>

        <FormSection title="Timeline & Value">
          <FormGrid columns={2}>
            <FormField label="Deal Value ($)">
              <NumberInput
                min={0}
                value={value.value}
                onValueChange={(v) => onChange({ value: v, crmValue: Math.round(v * 0.9) })}
                placeholder="e.g. 50000"
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Business Details">
          <FormGrid columns={3}>
            <FormField label="Location">
              <SearchableSelect
                value={value.location ?? ''}
                onChange={(location) => onChange({ location })}
                options={LOCATION_OPTIONS}
                placeholder="Search countries…"
                aria-label="Opportunity location"
              />
            </FormField>

            <FormField label="Cost ($)">
              <NumberInput
                min={0}
                step="0.01"
                value={value.cost}
                onValueChange={(v) => onChange({ cost: v })}
                placeholder="e.g. 40000"
                className={INPUT_CLS}
              />
            </FormField>

            <FormField label="Gross Margin (%)">
              <NumberInput
                min={0}
                max={100}
                step="0.01"
                value={value.grossMargin}
                onValueChange={(v) => onChange({ grossMargin: v })}
                placeholder="0–100"
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Expected Project Period">
          <FormGrid columns={2}>
            <FormField label="Expected Project Start Date">
              <input
                type="date"
                value={value.allocationStartDate}
                onChange={(e) => onChange({ allocationStartDate: e.target.value })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>

            <FormField label="Expected Project End Date">
              <input
                type="date"
                value={value.allocationEndDate}
                onChange={(e) => onChange({ allocationEndDate: e.target.value })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Deal Period (Optional)">
          <FormGrid columns={2}>
            <FormField label="Deal Start Date">
              <input
                type="date"
                value={value.dealStartDate ?? ''}
                onChange={(e) => onChange({ dealStartDate: e.target.value || undefined })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>

            <FormField label="Deal Close Date">
              <input
                type="date"
                value={value.dealCloseDate ?? ''}
                onChange={(e) => onChange({ dealCloseDate: e.target.value || undefined })}
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Stakeholders">
          <FormGrid columns={3}>
            <StakeholderAssignmentFields
              accountId={value.accountId}
              stakeholders={stakeholders}
              value={value}
              onChange={onChange}
            />

          </FormGrid>
        </FormSection>

        <FormSection title="AOP Planning">
          <FormField label="AOP Planned" wide>
            <AopYearFields
              aopAvailable={value.aopAvailable}
              aopYear={value.aopYear}
              onChange={onChange}
            />
          </FormField>
        </FormSection>

        <FormSection title="Additional Details">
          <FormGrid>
            <FormField label="Detailed Scope" wide>
              <textarea
                rows={2}
                value={value.description}
                onChange={(e) => onChange({ description: e.target.value })}
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
          </FormGrid>
        </FormSection>

        {/* Active custom columns (hidden ones excluded) */}
        <CustomColumnFields
          columns={opportunityColumns}
          config={opportunitiesColumnConfig}
          values={value}
          onChange={(key, colValue) => onChange({ [key]: colValue } as Partial<OpportunityDraft>)}
        />
      </div>
    </FormModal>
  );
};
