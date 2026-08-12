import React from 'react';
import { FormField, SELECT_CLS } from '@/components/ui';
import { OPPORTUNITY_TYPE_OPTIONS, SERVICE_LINE_OPTIONS, OPPORTUNITY_HEALTH_OPTIONS, REVENUE_MODEL_OPTIONS } from '@/constants';
import type { OpportunityType, ServiceLine, OpportunityHealth, RevenueModel } from '@/types';

export interface OpportunityClassificationValue {
  opportunityType: OpportunityType;
  serviceLine?: ServiceLine;
  opportunityHealth?: OpportunityHealth;
  revenueModel?: RevenueModel;
}

export interface OpportunityClassificationFieldsProps {
  value: OpportunityClassificationValue;
  onChange: (patch: Partial<OpportunityClassificationValue>) => void;
}

/**
 * Opportunity Type + Service Line — classification fields shared across every
 * Opportunity creation entry point.
 */
export const OpportunityClassificationFields: React.FC<OpportunityClassificationFieldsProps> = ({ value, onChange }) => (
  <>
    <FormField label="Opportunity Type" required>
      <select
        required
        value={value.opportunityType ?? ''}
        onChange={(e) => onChange({ opportunityType: e.target.value as OpportunityType })}
        className={SELECT_CLS}
      >
        <option value="" disabled>— Select —</option>
        {OPPORTUNITY_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Service Line" required>
      <select
        required
        value={value.serviceLine ?? ''}
        onChange={(e) => onChange({ serviceLine: (e.target.value || undefined) as ServiceLine | undefined })}
        className={SELECT_CLS}
      >
        <option value="" disabled>— Select —</option>
        {SERVICE_LINE_OPTIONS.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Opportunity Health">
      <select
        value={value.opportunityHealth ?? ''}
        onChange={(e) => onChange({ opportunityHealth: (e.target.value || undefined) as OpportunityHealth | undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {OPPORTUNITY_HEALTH_OPTIONS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Revenue Model">
      <select
        value={value.revenueModel ?? ''}
        onChange={(e) => onChange({ revenueModel: (e.target.value || undefined) as RevenueModel | undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {REVENUE_MODEL_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </FormField>
  </>
);
