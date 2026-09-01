/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AdminUser, PriorityLevel, ProjectRisk, RiskStatus } from '@/types';
import { RISK_RAG_OPTIONS, RISK_CLASSIFICATION_OPTIONS, RISK_IMPACT_OPTIONS, RISK_LIKELIHOOD_OPTIONS } from '@/constants';
import { calculateRiskSeverity } from '@/utils';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';

export type RiskDraft = Omit<ProjectRisk, 'id' | 'projectId' | 'ownerName' | 'createdAt' | 'updatedAt'>;

export const emptyRiskDraft: RiskDraft = {
  priority: 'Medium',
  description: '',
  impact: '',
  likelihood: '',
  severity: '',
  ownerId: '',
  mitigationPlan: '',
  status: 'Open',
  targetResolutionDate: '',
  rag: undefined,
  impactDescription: '',
  classification: undefined,
  contingencyPlan: '',
  riskOpenDate: '',
};

export interface RiskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel: string;
  submitVariant?: 'primary' | 'warning';
  value: RiskDraft;
  onChange: (patch: Partial<RiskDraft>) => void;
  users: AdminUser[];
}

/** Add/edit dialog for a Project's Risks tab. */
export const RiskFormModal: React.FC<RiskFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitLabel,
  submitVariant = 'primary',
  value,
  onChange,
  users,
}) => (
  <FormModal
    isOpen={isOpen}
    title={submitVariant === 'warning' ? 'Edit Risk' : 'Add Risk'}
    icon={<ShieldAlert className="w-5 h-5 text-red-600" aria-hidden="true" />}
    onClose={onClose}
    onSubmit={onSubmit}
    submitLabel={isSubmitting ? 'Saving…' : submitLabel}
    isSubmitting={isSubmitting}
    submitVariant={submitVariant}
    maxWidth="max-w-3xl"
  >
    <div className="space-y-5">
      <FormSection title="Risk Details">
        <FormGrid columns={3}>
          <FormField label="Description" required wide>
            <textarea
              rows={2}
              required
              value={value.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe the risk..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
          <FormField label="RAG Status">
            <select
              value={value.rag ?? ''}
              onChange={(e) => onChange({ rag: (e.target.value || undefined) as any })}
              className={SELECT_CLS}
            >
              <option value="">— Select —</option>
              {RISK_RAG_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Classification">
            <select
              value={value.classification ?? ''}
              onChange={(e) => onChange({ classification: e.target.value || undefined })}
              className={SELECT_CLS}
            >
              <option value="">— Select —</option>
              {RISK_CLASSIFICATION_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Priority" required>
            <select
              required
              value={value.priority}
              onChange={(e) => onChange({ priority: e.target.value as PriorityLevel })}
              className={SELECT_CLS}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select
              value={value.status}
              onChange={(e) => onChange({ status: e.target.value as RiskStatus })}
              className={SELECT_CLS}
            >
              <option value="Open">Open</option>
              <option value="Mitigated">Mitigated</option>
              <option value="Closed">Closed</option>
              <option value="Accepted">Accepted</option>
            </select>
          </FormField>
          <FormField label="Owner">
            <select
              value={value.ownerId ?? ''}
              onChange={(e) => onChange({ ownerId: e.target.value || undefined })}
              className={SELECT_CLS}
            >
              <option value="">Not assigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Risk Open Date">
            <input
              type="date"
              value={value.riskOpenDate ?? ''}
              onChange={(e) => onChange({ riskOpenDate: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Target Resolution Date">
            <input
              type="date"
              value={value.targetResolutionDate ?? ''}
              onChange={(e) => onChange({ targetResolutionDate: e.target.value || undefined })}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Impact">
            <select
              value={value.impact ?? ''}
              onChange={(e) => {
                const nextImpact = e.target.value;
                const nextSeverity = calculateRiskSeverity(nextImpact, value.likelihood);
                onChange({ impact: nextImpact, severity: nextSeverity });
              }}
              className={SELECT_CLS}
            >
              <option value="">— Select —</option>
              {RISK_IMPACT_OPTIONS.map((imp) => (
                <option key={imp} value={imp}>{imp}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Likelihood">
            <select
              value={value.likelihood ?? ''}
              onChange={(e) => {
                const nextLikelihood = e.target.value;
                const nextSeverity = calculateRiskSeverity(value.impact, nextLikelihood);
                onChange({ likelihood: nextLikelihood, severity: nextSeverity });
              }}
              className={SELECT_CLS}
            >
              <option value="">— Select —</option>
              {RISK_LIKELIHOOD_OPTIONS.map((lik) => (
                <option key={lik} value={lik}>{lik}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Severity (Calculated)">
            <input
              type="text"
              readOnly
              disabled
              value={value.severity || calculateRiskSeverity(value.impact, value.likelihood)}
              placeholder="Auto-calculated"
              className={`${INPUT_CLS} bg-slate-100 text-slate-700 font-semibold cursor-not-allowed`}
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Impact & Plans">
        <FormField label="Impact Description" wide>
          <textarea
            rows={2}
            value={value.impactDescription ?? ''}
            onChange={(e) => onChange({ impactDescription: e.target.value })}
            placeholder="Describe potential impact of the risk..."
            className={`${INPUT_CLS} resize-none`}
          />
        </FormField>
        <FormField label="Mitigation Plan" wide>
          <textarea
            rows={2}
            value={value.mitigationPlan}
            onChange={(e) => onChange({ mitigationPlan: e.target.value })}
            placeholder="How will this risk be mitigated..."
            className={`${INPUT_CLS} resize-none`}
          />
        </FormField>
        <FormField label="Contingency Plan" wide>
          <textarea
            rows={2}
            value={value.contingencyPlan ?? ''}
            onChange={(e) => onChange({ contingencyPlan: e.target.value })}
            placeholder="Describe contingency plan if risk occurs..."
            className={`${INPUT_CLS} resize-none`}
          />
        </FormField>
      </FormSection>
    </div>
  </FormModal>
);
