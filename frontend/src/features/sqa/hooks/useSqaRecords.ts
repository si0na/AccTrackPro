import { useCallback, useEffect, useState } from 'react';
import type { SqaAvailableProject, SqaRecord, SqaWeeklyHealth } from '@/types';
import { sqaApi, type SqaRecordInput } from '@/api/crm.api';
import { useCRM } from '@/contexts/CRMContext';
import { SQA_DEFAULT_HEALTH_WEEKS } from '@/constants';

/** Turns an axios error into a message safe to show in a banner. */
export function sqaErrorMessage(err: any, fallback: string): string {
  const raw = err?.response?.data?.message;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.length) return String(raw[0]);
  return fallback;
}

/**
 * Owns the SQA module's server state: the record list, the deactivated list, the
 * ISO-week window backing the "Health Week NN" columns, and every mutation.
 *
 * SQA records are deliberately NOT held in CRMContext (unlike accounts /
 * opportunities / projects): nothing outside this module reads them, so keeping
 * them here avoids a module-wide refetch on every unrelated navigation. The
 * pattern matches Performance Evaluation, which also fetches its own data.
 *
 * `weeks` is the width of the weekly health window. Changing it refetches, so
 * the columns and the record data always describe the same weeks.
 */
export function useSqaRecords(initialWeeks: number = SQA_DEFAULT_HEALTH_WEEKS) {
  const { can } = useCRM();

  const [records, setRecords] = useState<SqaRecord[]>([]);
  const [deactivated, setDeactivated] = useState<SqaRecord[]>([]);
  const [weekWindow, setWeekWindow] = useState<SqaWeeklyHealth[]>([]);
  const [weeks, setWeeks] = useState<number>(initialWeeks);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canCreate = can('sqa', 'create');
  const canUpdate = can('sqa', 'update');
  const canDelete = can('sqa', 'delete');
  /** Weekly RAG values land in the project health trail, which Projects guards. */
  const canEditWeeklyHealth = canUpdate && can('projects', 'update');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The window is fetched alongside the records so the column headers can
      // never describe a different set of weeks than the data underneath them.
      const [list, gone, window] = await Promise.all([
        sqaApi.getAll(weeks),
        sqaApi.getDeactivated(),
        sqaApi.getWeekWindow(weeks),
      ]);
      setRecords(list);
      setDeactivated(gone);
      setWeekWindow(window);
    } catch (err) {
      setError(sqaErrorMessage(err, 'Failed to load SQA records.'));
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data: SqaRecordInput): Promise<SqaRecord> => {
    const created = await sqaApi.create(data, weeks);
    setRecords((prev) => [created, ...prev]);
    return created;
  }, [weeks]);

  const update = useCallback(async (id: string, data: SqaRecordInput): Promise<SqaRecord> => {
    const saved = await sqaApi.update(id, data, weeks);
    setRecords((prev) => prev.map((r) => (r.id === id ? saved : r)));
    return saved;
  }, [weeks]);

  const remove = useCallback(async (id: string): Promise<void> => {
    const record = records.find((r) => r.id === id);
    await sqaApi.delete(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (record) setDeactivated((prev) => [{ ...record, weeklyHealth: [] }, ...prev]);
  }, [records]);

  const restore = useCallback(async (id: string): Promise<void> => {
    const restored = await sqaApi.restore(id);
    setDeactivated((prev) => prev.filter((r) => r.id !== id));
    setRecords((prev) => [restored, ...prev]);
  }, []);

  /** Sets one week's RAG value; the refreshed record carries the new window. */
  const setWeekHealth = useCallback(async (
    id: string,
    week: { isoYear: number; weekNumber: number; health: string },
  ): Promise<SqaRecord> => {
    const saved = await sqaApi.setWeekHealth(id, week, weeks);
    setRecords((prev) => prev.map((r) => (r.id === id ? saved : r)));
    return saved;
  }, [weeks]);

  return {
    records, deactivated, weekWindow, weeks, setWeeks,
    loading, error, setError, reload: load,
    create, update, remove, restore, setWeekHealth,
    canCreate, canUpdate, canDelete, canEditWeeklyHealth,
  };
}

/**
 * Projects still eligible for a new SQA record. Fetched on demand (when the
 * create form opens) rather than with the list, since it only matters there and
 * goes stale as soon as a record is created.
 */
export function useSqaAvailableProjects(enabled: boolean) {
  const [projects, setProjects] = useState<SqaAvailableProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    sqaApi.getAvailableProjects()
      .then((list) => { if (!cancelled) setProjects(list); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  return { projects, loading };
}

/**
 * A single SQA record, loaded by id — backs the details view, which can be
 * reached by direct URL and so cannot rely on the list having been fetched.
 */
export function useSqaRecord(id: string | null, weeks: number = SQA_DEFAULT_HEALTH_WEEKS) {
  const { can } = useCRM();
  const [record, setRecord] = useState<SqaRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) { setRecord(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setRecord(await sqaApi.getById(id, weeks));
    } catch (err) {
      setError(sqaErrorMessage(err, 'Failed to load this SQA record.'));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id, weeks]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (data: SqaRecordInput): Promise<SqaRecord> => {
    if (!id) throw new Error('No SQA record selected');
    const saved = await sqaApi.update(id, data, weeks);
    setRecord(saved);
    return saved;
  }, [id, weeks]);

  const setWeekHealth = useCallback(async (
    week: { isoYear: number; weekNumber: number; health: string },
  ): Promise<void> => {
    if (!id) return;
    setRecord(await sqaApi.setWeekHealth(id, week, weeks));
  }, [id, weeks]);

  return {
    record, loading, error, reload: load, update, setWeekHealth,
    canUpdate: can('sqa', 'update'),
    canEditWeeklyHealth: can('sqa', 'update') && can('projects', 'update'),
  };
}
