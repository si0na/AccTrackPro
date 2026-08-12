import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ProjectHealthUpdate } from '@/types';
import { projectHealthApi } from '@/api/crm.api';
import { useCRM } from '@/contexts/CRMContext';
import { HealthUpdateDraft, emptyHealthUpdateDraft } from '../components/HealthUpdateFormModal';

/**
 * Owns everything about a project's health: the Health Tracker history, the
 * shared "Update Health" modal, and the write.
 *
 * Both surfaces that show health — the Overview's summary card and the Health
 * Tracker tab — consume this hook, so there is exactly one fetch path, one
 * modal, and one save path between them. `latest` is the newest history entry;
 * the Overview shows that, which is why the two views can never disagree.
 */
export function useProjectHealth(projectId: string) {
  const { can, roleKey, refreshProject } = useCRM();

  const [history, setHistory] = useState<ProjectHealthUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<HealthUpdateDraft>(emptyHealthUpdateDraft);
  const [isSaving, setIsSaving] = useState(false);
  /** Id of the entry being corrected; null while composing a new update. */
  const [editingId, setEditingId] = useState<string | null>(null);

  /** Users with 'projects:update' can add health updates. */
  const canUpdate = can('projects', 'update') || roleKey === 'admin';

  const loadHistory = useCallback(() => {
    setLoading(true);
    projectHealthApi.getAllForProject(projectId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const latest: ProjectHealthUpdate | undefined = history[0];

  /** Pre-seeds the RAG status with the current health so a summary-only update keeps it. */
  const openModal = useCallback(() => {
    setEditingId(null);
    setDraft({ ...emptyHealthUpdateDraft, health: latest?.health ?? 'Green' });
    setIsModalOpen(true);
  }, [latest?.health]);

  /** Opens the same modal loaded with an existing entry, to correct it in place. */
  const openEditModal = useCallback((update: ProjectHealthUpdate) => {
    setEditingId(update.id);
    setDraft({
      health: update.health,
      statusSummary: update.statusSummary ?? '',
      keyAchievements: update.keyAchievements ?? '',
      currentChallenges: update.currentChallenges ?? '',
      risksImpactingHealth: update.risksImpactingHealth ?? '',
      mitigationPlan: update.mitigationPlan ?? '',
      supportRequired: update.supportRequired ?? '',
      // The input is type="date"; trim a full timestamp down to yyyy-MM-dd.
      nextReviewDate: update.nextReviewDate ? update.nextReviewDate.slice(0, 10) : undefined,
      overallConfidencePct: update.overallConfidencePct,
      reviewedById: update.reviewedById ?? '',
    });
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingId(null);
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.statusSummary.trim()) return;
    setIsSaving(true);
    try {
      if (editingId) {
        await projectHealthApi.update(projectId, editingId, draft);
      } else {
        await projectHealthApi.create(projectId, draft);
      }
      setIsModalOpen(false);
      setEditingId(null);
      loadHistory();
      // The backend also moves projects.health (on edit, only when the newest
      // entry changed), so pull the project back in to keep the detail header
      // badge and the Projects list in step.
      await refreshProject(projectId).catch(() => undefined);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    history, latest, loading, canUpdate,
    isModalOpen, openModal, openEditModal, closeModal,
    isEditing: editingId !== null,
    draft, setDraft, isSaving, save,
    reload: loadHistory,
  };
}
