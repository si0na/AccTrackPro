import React from 'react';
import { FormField, SELECT_CLS } from '@/components/ui';
import type { Stakeholder } from '@/types';

export interface StakeholderAssignmentValue {
  clientStakeholderId?: string;
  serviceProviderStakeholderId?: string;
}

export interface StakeholderAssignmentFieldsProps {
  accountId: string;
  stakeholders: Stakeholder[];
  value: StakeholderAssignmentValue;
  onChange: (patch: Partial<StakeholderAssignmentValue>) => void;
}

/**
 * Client/Service Provider stakeholder assignment — options are scoped to the
 * selected account and the matching stakeholder type. Shared across every
 * Opportunity creation entry point so the filtering logic can't drift between them.
 */
export const StakeholderAssignmentFields: React.FC<StakeholderAssignmentFieldsProps> = ({
  accountId,
  stakeholders,
  value,
  onChange,
}) => (
  <>
    <FormField label="Client Stakeholder">
      <select
        value={value.clientStakeholderId ?? ''}
        onChange={(e) => onChange({ clientStakeholderId: e.target.value })}
        disabled={!accountId}
        className={SELECT_CLS}
      >
        <option value="">— None —</option>
        {stakeholders
          .filter((s) => s.accountId === accountId && s.stakeholderType === 'CLIENT')
          .map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
          ))}
      </select>
    </FormField>

    <FormField label="Service Provider Stakeholder">
      <select
        value={value.serviceProviderStakeholderId ?? ''}
        onChange={(e) => onChange({ serviceProviderStakeholderId: e.target.value })}
        disabled={!accountId}
        className={SELECT_CLS}
      >
        <option value="">— None —</option>
        {stakeholders
          .filter((s) => s.accountId === accountId && s.stakeholderType === 'SERVICE_PROVIDER')
          .map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
          ))}
      </select>
    </FormField>
  </>
);
