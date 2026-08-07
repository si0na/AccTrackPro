import React from 'react';
import { FormModal, FormGrid, FormField, SELECT_CLS, INPUT_CLS } from '@/components/ui';
import { ProjectHealthUpdate, AdminUser } from '@/types';
import { PROJECT_HEALTH_CHOICES } from '@/constants';

export type HealthUpdateDraft = Omit<ProjectHealthUpdate, 'id' | 'projectId' | 'createdAt' | 'updatedById' | 'updatedByName' | 'reviewedByName'>;

export const emptyHealthUpdateDraft: HealthUpdateDraft = {
  health: 'Green',
  statusSummary: '',
  keyAchievements: '',
  currentChallenges: '',
  risksImpactingHealth: '',
  mitigationPlan: '',
  supportRequired: '',
  nextReviewDate: '',
  overallConfidencePct: undefined,
  reviewedById: '',
};

interface HealthUpdateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  draft: HealthUpdateDraft;
  setDraft: React.Dispatch<React.SetStateAction<HealthUpdateDraft>>;
  isSaving: boolean;
  users: AdminUser[];
}

export const HealthUpdateFormModal: React.FC<HealthUpdateFormModalProps> = ({
  isOpen, onClose, onSave, draft, setDraft, isSaving, users
}) => {
  const isFormValid = draft.health && draft.statusSummary.trim();

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Project Health"
      isSubmitting={isSaving}
      onSubmit={onSave}
      submitLabel="Update Health"
      maxWidth="max-w-3xl"
    >
      <FormGrid columns={2}>
        <FormField label="Overall Health Status" required>
          <select
            className={SELECT_CLS}
            value={draft.health}
            onChange={(e) => setDraft((d) => ({ ...d, health: e.target.value as any }))}
            required
          >
            {PROJECT_HEALTH_CHOICES.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </FormField>
        
        <FormField label="Overall Confidence (%)">
          <div className="text-[11px] text-slate-500 mb-1 leading-tight">0-100% confidence in successful delivery</div>
          <input
            type="number"
            className={INPUT_CLS}
            value={draft.overallConfidencePct ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, overallConfidencePct: e.target.value ? Number(e.target.value) : undefined }))}
            min="0"
            max="100"
            placeholder="e.g. 85"
          />
        </FormField>

        <div className="col-span-2">
          <FormField label="Status Summary" required>
            <textarea
              className={INPUT_CLS}
              rows={3}
              value={draft.statusSummary}
              onChange={(e) => setDraft((d) => ({ ...d, statusSummary: e.target.value }))}
              placeholder="Brief summary of current project status"
              required
            />
          </FormField>
        </div>

        <FormField label="Key Achievements">
          <textarea
            className={INPUT_CLS}
            rows={3}
            value={draft.keyAchievements}
            onChange={(e) => setDraft((d) => ({ ...d, keyAchievements: e.target.value }))}
            placeholder="What has gone well?"
          />
        </FormField>

        <FormField label="Current Challenges">
          <textarea
            className={INPUT_CLS}
            rows={3}
            value={draft.currentChallenges}
            onChange={(e) => setDraft((d) => ({ ...d, currentChallenges: e.target.value }))}
            placeholder="What is blocking progress?"
          />
        </FormField>

        <FormField label="Risks Impacting Health">
          <textarea
            className={INPUT_CLS}
            rows={3}
            value={draft.risksImpactingHealth}
            onChange={(e) => setDraft((d) => ({ ...d, risksImpactingHealth: e.target.value }))}
            placeholder="Identify top risks affecting the RAG status"
          />
        </FormField>

        <FormField label="Mitigation Plan">
          <textarea
            className={INPUT_CLS}
            rows={3}
            value={draft.mitigationPlan}
            onChange={(e) => setDraft((d) => ({ ...d, mitigationPlan: e.target.value }))}
            placeholder="How are the challenges/risks being addressed?"
          />
        </FormField>
        
        <FormField label="Support Required">
          <textarea
            className={INPUT_CLS}
            rows={2}
            value={draft.supportRequired}
            onChange={(e) => setDraft((d) => ({ ...d, supportRequired: e.target.value }))}
            placeholder="Escalations or support needed from management"
          />
        </FormField>

        <div className="col-span-2">
           <FormGrid columns={2}>
              <FormField label="Next Review Date">
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={draft.nextReviewDate || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, nextReviewDate: e.target.value }))}
                />
              </FormField>

              <FormField label="Reviewed By">
                <select
                  className={SELECT_CLS}
                  value={draft.reviewedById || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, reviewedById: e.target.value }))}
                >
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </FormField>
           </FormGrid>
        </div>
      </FormGrid>
    </FormModal>
  );
};
