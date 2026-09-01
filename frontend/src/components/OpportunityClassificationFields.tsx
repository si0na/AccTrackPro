import React from 'react';
import { FormField, SELECT_CLS } from '@/components/ui';
import { OPPORTUNITY_TYPE_OPTIONS, SERVICE_LINE_OPTIONS, OPPORTUNITY_HEALTH_OPTIONS, OPPORTUNITY_PRIORITY_OPTIONS, DELIVERY_MODEL_OPTIONS, BILLING_MODEL_OPTIONS, TOWER_OPTIONS } from '@/constants';
import type { OpportunityType, ServiceLine, OpportunityHealth, PriorityLevel } from '@/types';

export interface OpportunityClassificationValue {
  opportunityType: OpportunityType;
  serviceLine?: ServiceLine;
  opportunityHealth?: OpportunityHealth;
  priority?: PriorityLevel;
  deliveryModel?: string;
  billingModel?: string;
  tower?: string;
}

export interface OpportunityClassificationFieldsProps {
  value: OpportunityClassificationValue;
  onChange: (patch: Partial<OpportunityClassificationValue>) => void;
}

/**
 * Opportunity Type + Service Line + Health + Revenue Model + Priority + Delivery Model + Billing Model + Tower —
 * classification fields shared across every Opportunity creation entry point.
 */
export const OpportunityClassificationFields: React.FC<OpportunityClassificationFieldsProps> = ({ value, onChange }) => (
  <>
    <FormField label="Category" required>
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

    <FormField label="Priority">
      <select
        value={value.priority ?? ''}
        onChange={(e) => onChange({ priority: (e.target.value || undefined) as PriorityLevel | undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {OPPORTUNITY_PRIORITY_OPTIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Delivery Model">
      <select
        value={value.deliveryModel ?? ''}
        onChange={(e) => onChange({ deliveryModel: e.target.value || undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {DELIVERY_MODEL_OPTIONS.map((dm) => (
          <option key={dm} value={dm}>{dm}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Billing Model">
      <select
        value={value.billingModel ?? ''}
        onChange={(e) => onChange({ billingModel: e.target.value || undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {BILLING_MODEL_OPTIONS.map((bm) => (
          <option key={bm} value={bm}>{bm}</option>
        ))}
      </select>
    </FormField>

    <FormField label="Tower">
      <select
        value={value.tower ?? ''}
        onChange={(e) => onChange({ tower: e.target.value || undefined })}
        className={SELECT_CLS}
      >
        <option value="">— Select —</option>
        {TOWER_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
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
  </>
);

