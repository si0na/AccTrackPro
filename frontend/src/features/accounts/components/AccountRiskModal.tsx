import React, { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { AccountRisk, PriorityLevel, RiskStatus } from '@/types';
import { AlertTriangle, Pencil } from 'lucide-react';
import { calculateRiskSeverity, serviceProviderOptionLabel } from '@/utils';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SELECT_CLS,
} from '@/components/ui';

export interface AccountRiskModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  accountId: string;
  risk?: AccountRisk | null;
  onClose: () => void;
  onSubmit: (draft: Partial<AccountRisk>) => Promise<void> | void;
}

const EMPTY_DRAFT: Partial<AccountRisk> = {
  riskType: 'Risk',
  description: '',
  priority: 'Medium' as PriorityLevel,
  rag: 'Amber',
  impact: 'Medium',
  likelihood: 'Medium',
  ownerId: '',
  mitigationPlan: '',
  status: 'Open' as RiskStatus,
  targetResolutionDate: '',
};

export const AccountRiskModal: React.FC<AccountRiskModalProps> = ({
  isOpen,
  mode,
  accountId,
  risk,
  onClose,
  onSubmit,
}) => {
  const { serviceProviders } = useCRM();
  const isEdit = mode === 'edit';
  const [draft, setDraft] = useState<Partial<AccountRisk>>(EMPTY_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && risk) {
      setDraft({
        ...risk,
        accountId: risk.accountId || accountId,
      });
    } else {
      setDraft({
        ...EMPTY_DRAFT,
        accountId,
      });
    }
  }, [isOpen, isEdit, risk, accountId]);

  const computedSeverity = useMemo(
    () => calculateRiskSeverity(draft.impact, draft.likelihood) || draft.priority || '',
    [draft.impact, draft.likelihood, draft.priority],
  );

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.description?.trim() || !draft.priority) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...draft,
        accountId,
        severity: computedSeverity || draft.priority,
      });
      onClose();
    } catch {
      // API error handled centrally
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? `Edit Account ${draft.riskType === 'Dependency' ? 'Dependency' : 'Risk'}` : `Add Account ${draft.riskType === 'Dependency' ? 'Dependency' : 'Risk'}`}
      icon={
        isEdit
          ? <Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />
          : <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : `Create ${draft.riskType === 'Dependency' ? 'Dependency' : 'Risk'}`}
      submitVariant={isEdit ? 'warning' : 'primary'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        <FormSection title="General Information">
          <FormGrid columns={3}>
            <FormField label="Entry Type" required>
              <select
                value={draft.riskType || 'Risk'}
                onChange={(e) => setDraft({ ...draft, riskType: e.target.value as 'Risk' | 'Dependency' })}
                className={selectCls}
              >
                <option value="Risk">Risk</option>
                <option value="Dependency">Dependency</option>
              </select>
            </FormField>

            <FormField label="Priority / Level" required>
              <select
                required
                value={draft.priority || 'Medium'}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as PriorityLevel })}
                className={selectCls}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </FormField>

            <FormField label="RAG Status">
              <select
                value={draft.rag || 'Amber'}
                onChange={(e) => setDraft({ ...draft, rag: e.target.value as 'Red' | 'Amber' | 'Green' })}
                className={selectCls}
              >
                <option value="Red">Red</option>
                <option value="Amber">Amber</option>
                <option value="Green">Green</option>
              </select>
            </FormField>
          </FormGrid>

          <div className="mt-4">
            <FormField label="Description" required>
              <textarea
                required
                rows={3}
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={`Describe the account ${draft.riskType === 'Dependency' ? 'dependency' : 'risk'} in detail...`}
                className={inputCls}
              />
            </FormField>
          </div>
        </FormSection>

        {draft.riskType !== 'Dependency' && (
          <FormSection title="Risk Assessment (Matrix)">
            <FormGrid columns={3}>
              <FormField label="Impact">
                <select
                  value={draft.impact || 'Medium'}
                  onChange={(e) => setDraft({ ...draft, impact: e.target.value })}
                  className={selectCls}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </FormField>

              <FormField label="Likelihood">
                <select
                  value={draft.likelihood || 'Medium'}
                  onChange={(e) => setDraft({ ...draft, likelihood: e.target.value })}
                  className={selectCls}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </FormField>

              <FormField label="Calculated Severity">
                <input
                  type="text"
                  readOnly
                  value={computedSeverity || '—'}
                  className={`${inputCls} bg-slate-100 font-bold text-slate-700 cursor-not-allowed`}
                />
              </FormField>
            </FormGrid>
          </FormSection>
        )}

        <FormSection title="Ownership & Mitigation">
          <div className="space-y-4">
            <FormGrid columns={3}>
              <FormField label="Owner">
                <select
                  value={draft.ownerId || ''}
                  onChange={(e) => setDraft({ ...draft, ownerId: e.target.value || undefined })}
                  className={selectCls}
                >
                  <option value="">— Unassigned —</option>
                  {serviceProviders.map((user) => (
                    <option key={user.id} value={user.id}>
                      {serviceProviderOptionLabel(user)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status" required>
                <select
                  required
                  value={draft.status || 'Open'}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as RiskStatus })}
                  className={selectCls}
                >
                  <option value="Open">Open</option>
                  <option value="Mitigated">Mitigated</option>
                  <option value="Closed">Closed</option>
                  <option value="Accepted">Accepted</option>
                </select>
              </FormField>

              <FormField label="Target Resolution Date">
                <input
                  type="date"
                  value={draft.targetResolutionDate || ''}
                  onChange={(e) => setDraft({ ...draft, targetResolutionDate: e.target.value })}
                  className={inputCls}
                />
              </FormField>
            </FormGrid>

            <FormField label="Mitigation / Contingency Plan">
              <textarea
                rows={3}
                value={draft.mitigationPlan || ''}
                onChange={(e) => setDraft({ ...draft, mitigationPlan: e.target.value })}
                placeholder="Detail mitigation actions or fallback plans..."
                className={inputCls}
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
};
