import { useState, useEffect, useCallback } from 'react';
import {
  employeeDirectoryService,
  type EmployeeDirectoryResult,
  type GraphDirectoryError,
} from '@/services/employeeDirectory.service';
import { disconnectGraphDirectory, getActiveMsalAccount } from '@/lib/msal';
import type { EmployeeDirectoryUser, DirectorySource } from '@/types';

export interface UseEmployeesResult {
  employees: EmployeeDirectoryUser[];
  loading: boolean;
  connecting: boolean;
  error: string | null;
  graphError: GraphDirectoryError | null;
  source: DirectorySource;
  fallbackReason: string | null;
  isGraphConnected: boolean;
  totalCount: number;
  lastSyncTime: number | null;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  search: (query: string, max?: number) => EmployeeDirectoryUser[];
  findById: (id: string) => EmployeeDirectoryUser | undefined;
  connectGraph: () => Promise<number>;
  disconnectGraph: () => Promise<void>;
}

export function useEmployees(autoFetch = true): UseEmployeesResult {
  const [employees, setEmployees] = useState<EmployeeDirectoryUser[]>([]);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<GraphDirectoryError | null>(null);
  const [source, setSource] = useState<DirectorySource>('disconnected');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isGraphConnected, setIsGraphConnected] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const fetchEmployees = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res: EmployeeDirectoryResult = await employeeDirectoryService.getEmployees(forceRefresh);
      setEmployees(res.employees);
      setSource(res.source);
      setFallbackReason(res.fallbackReason || null);
      setGraphError(res.error || null);
      setLastSyncTime(res.lastSyncTime || null);

      const activeAccount = await getActiveMsalAccount();
      setIsGraphConnected(Boolean(activeAccount && res.source === 'microsoft_graph' && res.employees.length > 0));
    } catch (err: any) {
      setError(err?.message || 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchEmployees(false);
    }
  }, [autoFetch, fetchEmployees]);

  const refresh = useCallback(
    async (force = true) => {
      await fetchEmployees(force);
    },
    [fetchEmployees],
  );

  const search = useCallback(
    (query: string, max = 50) => {
      return employeeDirectoryService.search(query, employees, max);
    },
    [employees],
  );

  const findById = useCallback(
    (id: string) => {
      return employeeDirectoryService.findById(id, employees);
    },
    [employees],
  );

  /**
   * Explicit interactive connection action.
   * MUST only be called directly from user click events.
   */
  const connectGraph = useCallback(async (): Promise<number> => {
    setConnecting(true);
    setError(null);
    setGraphError(null);
    try {
      const res = await employeeDirectoryService.connectAndFetch();
      setEmployees(res.employees);
      setSource(res.source);
      setFallbackReason(null);
      setIsGraphConnected(true);
      setLastSyncTime(res.lastSyncTime || Date.now());
      return res.employees.length;
    } catch (err: any) {
      const msg = err?.message || 'Failed to authenticate and connect Microsoft Graph.';
      setError(msg);
      if (err?.code) {
        setGraphError(err);
      }
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnectGraph = useCallback(async (): Promise<void> => {
    try {
      await disconnectGraphDirectory();
      employeeDirectoryService.clearCache();
      setIsGraphConnected(false);
      setEmployees([]);
      setSource('disconnected');
      setLastSyncTime(null);
      setFallbackReason('Disconnected from Microsoft Entra Directory.');
    } catch (err: any) {
      setError(err?.message || 'Failed to disconnect Microsoft account.');
    }
  }, []);

  return {
    employees,
    loading,
    connecting,
    error,
    graphError,
    source,
    fallbackReason,
    isGraphConnected,
    totalCount: employees.length,
    lastSyncTime,
    refresh,
    search,
    findById,
    connectGraph,
    disconnectGraph,
  };
}
