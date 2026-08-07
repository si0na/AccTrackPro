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
    setDraft({ ...emptyHealthUpdateDraft, health: latest?.health ?? 'Green' });
    setIsModalOpen(true);
  }, [latest?.health]);

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.statusSummary.trim()) return;
    setIsSaving(true);
    try {
      await projectHealthApi.create(projectId, draft);
      setIsModalOpen(false);
      loadHistory();
      // The backend also moves projects.health, so pull the project back in to
      // keep the detail header badge and the Projects list in step.
      await refreshProject(projectId).catch(() => undefined);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    history, latest, loading, canUpdate,
    isModalOpen, openModal, closeModal,
    draft, setDraft, isSaving, save,
    reload: loadHistory,
  };
}
