import React from 'react';
import { FormModal, FormGrid, FormField, INPUT_CLS } from '@/components/ui';
import type { ProgressUpdateDraft } from '../hooks/useProjectProgress';

interface ProgressUpdateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e?: React.FormEvent) => Promise<void>;
  draft: ProgressUpdateDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProgressUpdateDraft>>;
  isSaving: boolean;
  isEditing?: boolean;
  errorMessage?: string | null;
}

export const ProgressUpdateFormModal: React.FC<ProgressUpdateFormModalProps> = ({
  isOpen, onClose, onSave, draft, setDraft, isSaving, isEditing = false, errorMessage
}) => {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isFutureDate = Boolean(draft.asOnDate && draft.asOnDate > todayStr);

  const isPercentValid = (v?: number) => v === undefined || (v >= 0 && v <= 100);
  const isNonNegative = (v?: number) => v === undefined || v >= 0;

  const isFormValid =
    Boolean(draft.asOnDate) &&
    !isFutureDate &&
    isPercentValid(draft.plannedCompletionPct) &&
    isPercentValid(draft.actualCompletionPct) &&
    isNonNegative(draft.plannedEffortHours) &&
    isNonNegative(draft.actualEffortHours) &&
    isNonNegative(draft.plannedCost) &&
    isNonNegative(draft.actualCost);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Progress Update' : 'Record Progress Update'}
      isSubmitting={isSaving}
      onSubmit={onSave}
      submitLabel={isEditing ? 'Save Changes' : 'Submit Progress'}
      maxWidth="max-w-2xl"
    >
      <FormGrid columns={2}>
        <div className="col-span-2">
          {errorMessage && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm font-medium border border-red-200">
              {errorMessage}
            </div>
          )}
          {isFutureDate && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm font-medium border border-red-200">
              Progress Date cannot be in the future. (Today is {todayStr})
            </div>
          )}
        </div>

        <FormField label="Progress Date / As On Date" required>
          <input
            type="date"
            max={todayStr}
            required
            className={`${INPUT_CLS} font-mono`}
            value={draft.asOnDate || ''}
            onChange={(e) => setDraft((d) => ({ ...d, asOnDate: e.target.value }))}
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            Select today or any past date. Future dates are not allowed.
          </span>
        </FormField>

        <div className="hidden sm:block" />

        <FormField label="Planned Completion (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={INPUT_CLS}
            placeholder="0 - 100"
            value={draft.plannedCompletionPct ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                plannedCompletionPct: e.target.value !== '' ? Number(e.target.value) : undefined,
              }))
            }
          />
        </FormField>

        <FormField label="Actual Completion (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={INPUT_CLS}
            placeholder="0 - 100"
            value={draft.actualCompletionPct ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                actualCompletionPct: e.target.value !== '' ? Number(e.target.value) : undefined,
              }))
            }
          />
        </FormField>

        <FormField label="Planned Effort (Hours)">
          <input
            type="number"
            min="0"
            step="0.1"
            className={INPUT_CLS}
            placeholder="e.g. 120"
            value={draft.plannedEffortHours ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                plannedEffortHours: e.target.value !== '' ? Number(e.target.value) : undefined,
              }))
            }
          />
        </FormField>

        <FormField label="Actual Effort (Hours)">
          <input
            type="number"
            min="0"
            step="0.1"
            className={INPUT_CLS}
            placeholder="e.g. 95"
            value={draft.actualEffortHours ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                actualEffortHours: e.target.value !== '' ? Number(e.target.value) : undefined,
              }))
            }
          />
        </FormField>

        <FormField label="Planned Cost (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            className={INPUT_CLS}
            placeholder="e.g. 50000"
            value={draft.plannedCost ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                plannedCost: e.target.value !== '' ? Number(e.target.value) : undefined,
              }))
            }
          />
        </FormField>

        <FormField label="Actual Cost (USD)">
          <input
            type="number"
            min="0"
            step="0.01"
            className={INPUT_CLS}
            placeholder="e.g. 42000"
            value={draft.actualCost ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                actualCost: e.target.value !== '' ? Number(e.target.value) : undefined,
              }))
            }
          />
        </FormField>

        <div className="col-span-2">
          <FormField label="Notes / Progress Remarks">
            <textarea
              className={INPUT_CLS}
              rows={3}
              placeholder="Optional notes or context for this progress update..."
              value={draft.notes ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </FormField>
        </div>
      </FormGrid>
    </FormModal>
  );
};
