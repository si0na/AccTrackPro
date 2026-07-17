import React from 'react';
import { FormField, SELECT_CLS } from '@/components/ui';
import { OPPORTUNITY_TYPE_OPTIONS, SERVICE_LINE_OPTIONS } from '@/constants';
import type { OpportunityType, ServiceLine } from '@/types';

export interface OpportunityClassificationValue {
  opportunityType: OpportunityType;
  serviceLine?: ServiceLine;
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
    <FormField label="Opportunity Type">
      <select
        value={value.opportunityType}
        onChange={(e) => onChange({ opportunityType: e.target.value as OpportunityType })}
        className={SELECT_CLS}
      >
        {OPPORTUNITY_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Service Line">
      <select
        value={value.serviceLine ?? ''}
        onChange={(e) => onChange({ serviceLine: (e.target.value || undefined) as ServiceLine | undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {SERVICE_LINE_OPTIONS.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </FormField>
  </>
);
