/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Project } from '@/types';
import { Eye, Trash2, FolderKanban } from 'lucide-react';
import { compareForSort, matchesGlobalAccount, SortDirection } from '@/utils';
import {
  Card,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  PageHeader,
  Pagination,
  RestoreButton,
  RestoreDialog,
  RowActionButton,
  SearchBar,
  SortableHeader,
  StatusBadge,
  HEALTH_COLORS,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';

const METHODOLOGY_OPTIONS = ['Agile', 'Waterfall'] as const;
const STATUS_OPTIONS = ['Active', 'On Hold', 'Completed', 'Cancelled'] as const;
const HEALTH_OPTIONS = ['Green', 'Amber', 'Red'] as const;

/**
 * Projects list — modeled on OpportunitiesView.tsx. Unlike every other list
 * view, there is intentionally no "New Project" action: a Project is always
 * derived server-side from a Won Opportunity, never created by hand.
 */
export const ProjectsListView: React.FC = () => {
  const {
    projects,
    deactivatedProjects,
    accounts,
    deleteProject,
    restoreProject,
    setView,
    setSelectedProjectId,
    globalAccountId: selectedAccountFilter,
    refreshData,
    loading,
  } = useCRM();

  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [methodologyFilter, setMethodologyFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };
  const getSortValue = (p: Project, key: string) => {
    if (key === 'accountId') {
      const acc = accounts.find((a) => a.id === p.accountId);
      return acc ? acc.name : (p.accountName ?? '');
    }
    return (p as any)[key];
  };

  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    setSearchQuery('');
    setPage(1);
  }, [selectedAccountFilter]);

  useEffect(() => {
    refreshData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProjects = projects.filter((p) => {
    const account = accounts.find((a) => a.id === p.accountId);
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || p.name.toLowerCase().includes(q)
      || (account?.name || p.accountName || '').toLowerCase().includes(q)
      || (p.clientStakeholderName || '').toLowerCase().includes(q);
    const matchesAccount = matchesGlobalAccount(p.accountId, selectedAccountFilter);
    const matchesHealth = healthFilter === 'All' || p.health === healthFilter;
    const matchesMethodology = methodologyFilter === 'All' || p.methodology === methodologyFilter;
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesAccount && matchesHealth && matchesMethodology && matchesStatus;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) =>
    compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
  );

  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProjects = sortedProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleRowClick = (id: string) => {
    setSelectedProjectId(id);
    setView('project-details');
  };

  const handleRestoreProject = async (id: string) => {
    setRestoreError(null);
    try {
      await restoreProject(id);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      setRestoreError(
        typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : 'Failed to restore the project.'),
      );
    }
  };

  if (loading) return <LoadingState label="Loading projects…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Management"
        subtitle="Live delivery record for every Won opportunity — progress, team, and ongoing work."
      />

      <FilterBar className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search projects, accounts, or clients..."
          className="w-full"
        />

        <FilterSelect
          label="Health"
          hideLabel
          value={healthFilter}
          onChange={setHealthFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Health' },
            ...HEALTH_OPTIONS.map((h) => ({ value: h, label: h })),
          ]}
        />

        <FilterSelect
          label="Methodology"
          hideLabel
          value={methodologyFilter}
          onChange={setMethodologyFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Methodologies' },
            ...METHODOLOGY_OPTIONS.map((m) => ({ value: m, label: m })),
          ]}
        />

        <FilterSelect
          label="Status"
          hideLabel
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Statuses' },
            ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
          ]}
        />
      </FilterBar>

      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable storageKey="projects">
            <TableHead>
              <TableHeadCell columnId="name">
                <SortableHeader label="Project Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="accountId">
                <SortableHeader label="Account" field="accountId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="clientStakeholderName">Client</TableHeadCell>
              <TableHeadCell columnId="serviceProviderPmName">Service Provider PM</TableHeadCell>
              <TableHeadCell columnId="practiceLeadName">Practice Lead</TableHeadCell>
              <TableHeadCell columnId="methodology">Methodology</TableHeadCell>
              <TableHeadCell columnId="health" align="center">Health</TableHeadCell>
              <TableHeadCell columnId="actualCompletionPct" align="center">Progress</TableHeadCell>
              <TableHeadCell columnId="status">Status</TableHeadCell>
              <TableHeadCell columnId="startDate">Start Date</TableHeadCell>
              <TableHeadCell columnId="endDate">End Date</TableHeadCell>
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {pagedProjects.length === 0 ? (
                <EmptyRow colSpan={12} message="No projects found matching the selected search and criteria." />
              ) : (
                pagedProjects.map((p) => {
                  const account = accounts.find((a) => a.id === p.accountId);
                  const pct = p.actualCompletionPct ?? 0;
                  return (
                    <TableRow key={p.id} clickable onClick={() => handleRowClick(p.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0">
                            <FolderKanban className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <p className="font-bold text-slate-900 text-sm min-w-0 truncate">{p.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 font-semibold">
                        {account?.name || p.accountName || 'Unknown Account'}
                      </TableCell>
                      <TableCell className="text-slate-600">{p.clientStakeholderName || '—'}</TableCell>
                      <TableCell className="text-slate-600">{p.serviceProviderPmName || '—'}</TableCell>
                      <TableCell className="text-slate-600">{p.practiceLeadName || '—'}</TableCell>
                      <TableCell className="text-slate-600">{p.methodology}</TableCell>
                      <TableCell align="center">
                        <StatusBadge value={p.health} colorMap={HEALTH_COLORS} />
                      </TableCell>
                      <TableCell align="center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-14 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 font-mono text-[11px]">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">{p.status}</TableCell>
                      <TableCell className="font-mono text-slate-500 whitespace-nowrap">{p.startDate || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-slate-500 whitespace-nowrap">{p.endDate || 'N/A'}</TableCell>
                      <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <RowActionButton
                            intent="view"
                            label={`View project ${p.name}`}
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => handleRowClick(p.id)}
                          />
                          <RowActionButton
                            intent="delete"
                            label={`Delete project ${p.name}`}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setDeleteTarget({ id: p.id, label: p.name })}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filteredProjects.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="projects"
        />
      </Card>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Project"
        message={deleteTarget ? <>Deactivate project <span className="font-bold">"{deleteTarget.label}"</span>? It will move to the Deactivated section.</> : undefined}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteProject(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {deactivatedProjects.length > 0 && (
        <DeactivatedSection title="Deactivated Projects" count={deactivatedProjects.length}>
          {restoreError && (
            <ErrorBanner message={restoreError} onDismiss={() => setRestoreError(null)} className="mx-5 my-3" />
          )}
          <Table>
            <TableHead>
              <TableHeadCell>Project Name</TableHeadCell>
              <TableHeadCell>Account</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell align="center">Restore</TableHeadCell>
            </TableHead>
            <tbody>
              {deactivatedProjects.map((p) => {
                const accountName = p.accountName || accounts.find((a) => a.id === p.accountId)?.name;
                return (
                  <TableRow key={p.id} className="opacity-70">
                    <TableCell>
                      <span className="font-semibold text-slate-600 line-through decoration-slate-300">{p.name}</span>
                    </TableCell>
                    <TableCell>{accountName || '—'}</TableCell>
                    <TableCell className="text-slate-500">{p.status}</TableCell>
                    <TableCell align="center">
                      <RestoreButton
                        label={`Restore project ${p.name}`}
                        onClick={() => setRestoreTarget({ id: p.id, label: p.name })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </DeactivatedSection>
      )}

      <RestoreDialog
        isOpen={!!restoreTarget}
        title="Restore Project"
        message={restoreTarget ? <>Restore project <span className="font-bold">"{restoreTarget.label}"</span>? It will reappear in the active list.</> : undefined}
        onConfirm={async () => {
          if (restoreTarget) {
            await handleRestoreProject(restoreTarget.id);
            setRestoreTarget(null);
          }
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
};
