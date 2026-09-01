import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ProjectProgressUpdate } from '@/types';
import { projectProgressApi, type ProjectProgressUpdateInput } from '@/api/crm.api';
import { useCRM } from '@/contexts/CRMContext';

export interface ProgressUpdateDraft extends ProjectProgressUpdateInput {}

export const emptyProgressUpdateDraft: ProgressUpdateDraft = {
  asOnDate: new Date().toLocaleDateString('en-CA'),
  plannedCompletionPct: undefined,
  actualCompletionPct: undefined,
  plannedEffortHours: undefined,
  actualEffortHours: undefined,
  plannedCost: undefined,
  actualCost: undefined,
  notes: '',
};

export function useProjectProgress(projectId: string) {
  const { can, roleKey, refreshProject } = useCRM();

  const [history, setHistory] = useState<ProjectProgressUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<ProgressUpdateDraft>(emptyProgressUpdateDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canUpdate = can('projects', 'update') || roleKey === 'admin';

  const loadHistory = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    projectProgressApi.getAllForProject(projectId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const latest: ProjectProgressUpdate | undefined = history[0];

  const todayStr = new Date().toLocaleDateString('en-CA');

  const openModal = useCallback(() => {
    setEditingId(null);
    setErrorMessage(null);
    setDraft({
      ...emptyProgressUpdateDraft,
      asOnDate: todayStr,
      plannedCompletionPct: latest?.plannedCompletionPct,
      actualCompletionPct: latest?.actualCompletionPct,
      plannedEffortHours: latest?.plannedEffortHours,
      actualEffortHours: latest?.actualEffortHours,
      plannedCost: latest?.plannedCost,
      actualCost: latest?.actualCost,
    });
    setIsModalOpen(true);
  }, [latest, todayStr]);

  const openEditModal = useCallback((update: ProjectProgressUpdate) => {
    setEditingId(update.id);
    setErrorMessage(null);
    setDraft({
      asOnDate: update.asOnDate ? update.asOnDate.slice(0, 10) : todayStr,
      plannedCompletionPct: update.plannedCompletionPct,
      actualCompletionPct: update.actualCompletionPct,
      plannedEffortHours: update.plannedEffortHours,
      actualEffortHours: update.actualEffortHours,
      plannedCost: update.plannedCost,
      actualCost: update.actualCost,
      notes: update.notes ?? '',
    });
    setIsModalOpen(true);
  }, [todayStr]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingId(null);
    setErrorMessage(null);
  }, []);

  const save = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (draft.asOnDate && draft.asOnDate > todayStr) {
      setErrorMessage('Progress Date cannot be a future date');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await projectProgressApi.update(projectId, editingId, draft);
      } else {
        await projectProgressApi.create(projectId, draft);
      }
      setIsModalOpen(false);
      setEditingId(null);
      loadHistory();
      await refreshProject(projectId).catch(() => undefined);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save progress update');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    history,
    latest,
    loading,
    canUpdate,
    isModalOpen,
    openModal,
    openEditModal,
    closeModal,
    isEditing: editingId !== null,
    draft,
    setDraft,
    isSaving,
    save,
    errorMessage,
    setErrorMessage,
    reload: loadHistory,
  };
}
