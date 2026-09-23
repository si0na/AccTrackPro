/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Project, User } from '@/types';
import { usersApi, projectsApi } from '@/api/crm.api';
import { Eye, Trash2, FolderKanban, Plus, Pencil, Settings2 } from 'lucide-react';
import { compareForSort, matchesGlobalAccount, serviceProviderOptionLabel, isRawIdStr, SortDirection } from '@/utils';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import {
  Button,
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
  computePinnedOffsets,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { ProjectFormModal } from './ProjectFormModal';

const METHODOLOGY_OPTIONS = ['Agile', 'Waterfall'] as const;
const STATUS_OPTIONS = ['Active', 'Cancelled', 'Completed', 'On Hold'] as const;
const HEALTH_OPTIONS = ['Amber', 'Green', 'Red'] as const;

/**
 * Projects list — modeled on OpportunitiesView.tsx.
 */
export const ProjectsListView: React.FC = () => {
  const {
    projects,
    deactivatedProjects,
    accounts,
    addProject,
    deleteProject,
    restoreProject,
    updateProject,
    setView,
    setSelectedProjectId,
    globalAccountId: selectedAccountFilter,
    refreshData,
    loading,
    can,
    projectsColumnConfig,
  } = useCRM();

  const canDeleteProject = can('projects', 'delete');
  const canUpdateProject = can('projects', 'update');
  const canCreateProject = can('projects', 'create');

  // Direct Project Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [newProjectDraft, setNewProjectDraft] = useState<Project>({
    id: '',
    name: '',
    description: '',
    accountId: '',
    accountName: '',
    startDate: '',
    endDate: '',
    status: 'Active',
    health: 'Green',
    methodology: 'Agile',
  } as Project);

  const handleOpenCreateModal = () => {
    const firstAcc = accounts && accounts.length > 0 ? accounts[0] : null;
    setNewProjectDraft({
      id: '',
      name: '',
      description: '',
      accountId: firstAcc ? firstAcc.id : '',
      accountName: firstAcc ? firstAcc.name : '',
      startDate: '',
      endDate: '',
      status: 'Active',
      health: 'Green',
      methodology: 'Agile',
    } as Project);
    setIsCreateModalOpen(true);
  };

  const handleSaveDirectProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectDraft.name.trim() || !newProjectDraft.accountId) return;
    if (newProjectDraft.startDate && newProjectDraft.endDate && newProjectDraft.endDate < newProjectDraft.startDate) {
      alert('Project End Date cannot be earlier than Project Start Date.');
      return;
    }
    setIsSubmittingCreate(true);
    try {
      const created = await addProject({
        name: newProjectDraft.name.trim(),
        description: newProjectDraft.description || '',
        accountId: newProjectDraft.accountId,
        startDate: newProjectDraft.startDate || undefined,
        endDate: newProjectDraft.endDate || undefined,
        dealValue: newProjectDraft.dealValue,
        priority: newProjectDraft.priority,
        deliveryModel: newProjectDraft.deliveryModel,
        billingModel: newProjectDraft.billingModel,
        tower: newProjectDraft.tower,
        serviceProviderPmId: newProjectDraft.serviceProviderPmId,
        practiceLeadId: newProjectDraft.practiceLeadId,
        clientPartnerId: newProjectDraft.clientPartnerId,
        clientPmName: newProjectDraft.clientPmName,
        status: newProjectDraft.status || 'Active',
        health: newProjectDraft.health || 'Green',
        methodology: newProjectDraft.methodology || 'Agile',
      });
      setIsCreateModalOpen(false);
      setSelectedProjectId(created.id);
      setView('project-details');
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to create project.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Edit Project Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProjectDraft, setEditingProjectDraft] = useState<Project | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editProjectError, setEditProjectError] = useState<string | null>(null);

  const handleOpenEditModal = (project: Project) => {
    setEditingProjectDraft({ ...project });
    setEditProjectError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectDraft || !editingProjectDraft.name.trim()) return;
    if (editingProjectDraft.startDate && editingProjectDraft.endDate && editingProjectDraft.endDate < editingProjectDraft.startDate) {
      setEditProjectError('Project End Date cannot be earlier than Project Start Date.');
      return;
    }
    setIsSubmittingEdit(true);
    setEditProjectError(null);
    try {
      await updateProject(editingProjectDraft);
      setIsEditModalOpen(false);
      setEditingProjectDraft(null);
    } catch (err: any) {
      setEditProjectError(err?.response?.data?.message || err?.message || 'Failed to update project.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, []);

  const { projectManagers, practiceLeads, clientPartners, serviceProviders } = useCRM();

  const buildUserList = useCallback((roleUsers: any[]) => {
    return (roleUsers || [])
      .map((u) => u)
      .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base', numeric: true }));
  }, []);

  const pmOptions = React.useMemo(() => buildUserList(projectManagers), [projectManagers, buildUserList]);
  const practiceLeadOptions = React.useMemo(() => buildUserList(practiceLeads), [practiceLeads, buildUserList]);
  const clientPartnerOptions = React.useMemo(() => buildUserList(clientPartners), [clientPartners, buildUserList]);

  const resolveProjectUserLabel = useCallback(
    (name?: string | null, id?: string | null, roleList?: any[]) => {
      if (name && name.trim() && !isRawIdStr(name)) return name;
      if (id) {
        const match =
          serviceProviders.find((u) => u.id === id || (u as any).userId === id) ||
          (roleList || []).find((u) => u.id === id || (u as any).userId === id);
        if (match) return serviceProviderOptionLabel(match);
      }
      return '—';
    },
    [serviceProviders],
  );

  const [editingCell, setEditingCell] = useState<{ id: string; key: string; value: any } | null>(null);

  const saveInlineCell = async (id: string, key: string, value: any, extraFields?: Record<string, any>) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;
    try {
      await updateProject({ ...target, [key]: value, ...(extraFields || {}) });
    } catch {
      // revert on error
    }
    setEditingCell(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [methodologyFilter, setMethodologyFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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
      || (p.clientPartnerName || '').toLowerCase().includes(q);
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const displayedConfigs = useMemo(() => {
    const cols = (projectsColumnConfig || []).filter((c) => c.isDisplayed);
    const pinned = cols.filter((c) => c.isPinned);
    const unpinned = cols.filter((c) => !c.isPinned);
    return [...pinned, ...unpinned];
  }, [projectsColumnConfig]);

  const pinnedOffsets = useMemo(() => {
    return computePinnedOffsets(displayedConfigs, 'projects');
  }, [displayedConfigs]);

  const extraColumnCount = displayedConfigs.filter((col) => !col.isStandard).length;

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
        subtitle="Live delivery record for active projects — progress, team, and ongoing work."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<Settings2 className="w-4.5 h-4.5 text-slate-500" aria-hidden="true" />}
              onClick={() => setIsSidebarOpen(true)}
            >
              Customize Columns
            </Button>
            {canCreateProject && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="w-4.5 h-4.5" aria-hidden="true" />}
                onClick={handleOpenCreateModal}
              >
                Create Project
              </Button>
            )}
          </div>
        }
      />

      <CustomizeColumnsSidebar
        module="projects"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <FilterBar className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search projects, accounts, or client partners..."
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
          <Table extraColumns={extraColumnCount} resizable storageKey="projects">
            <TableHead>
              {displayedConfigs.map((col) => (
                <TableHeadCell
                  key={col.key}
                  columnId={col.key}
                  sticky={col.isPinned ? 'left' : undefined}
                  stickyLeft={pinnedOffsets[col.key]}
                  align={col.key === 'health' || col.key === 'actualCompletionPct' ? 'center' : undefined}
                >
                  {col.key === 'name' || col.key === 'accountId' ? (
                    <SortableHeader
                      label={col.name}
                      field={col.key}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  ) : (
                    col.name
                  )}
                </TableHeadCell>
              ))}
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {pagedProjects.length === 0 ? (
                <EmptyRow colSpan={displayedConfigs.length + 1} message="No projects found matching the selected search and criteria." />
              ) : (
                pagedProjects.map((p) => {
                  const account = accounts.find((a) => a.id === p.accountId);
                  const pct = p.actualCompletionPct ?? 0;
                  return (
                    <TableRow key={p.id}>
                      {displayedConfigs.map((col) => {
                        if (col.key === 'name') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="cursor-pointer" onClick={() => handleRowClick(p.id)}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold shrink-0">
                                  <FolderKanban className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <p className="font-bold text-slate-900 text-sm min-w-0 truncate hover:text-indigo-600 transition-colors">{p.name}</p>
                              </div>
                            </TableCell>
                          );
                        }
                        if (col.key === 'accountId') {
                          const isFromOpportunity = !!p.opportunityId;
                          const canEditAccount = canUpdateProject && !isFromOpportunity;
                          return (
                            <TableCell
                              key={col.key}
                              sticky={col.isPinned ? 'left' : undefined}
                              stickyLeft={pinnedOffsets[col.key]}
                              className={`text-slate-600 font-semibold ${canEditAccount ? 'cursor-pointer' : ''}`}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (canEditAccount) {
                                  setEditingCell({ id: p.id, key: 'accountId', value: p.accountId || '' });
                                }
                              }}
                              title={isFromOpportunity ? 'Account is fixed for projects created from opportunities' : undefined}
                            >
                              {editingCell?.id === p.id && editingCell?.key === 'accountId' ? (
                                <select
                                  autoFocus
                                  value={editingCell.value}
                                  onChange={(e) => {
                                    const selectedAcc = accounts.find((a) => a.id === e.target.value);
                                    saveInlineCell(p.id, 'accountId', e.target.value, { accountName: selectedAcc?.name || '' });
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                  className="text-xs p-1 border border-indigo-500 rounded bg-white font-normal min-w-[140px]"
                                >
                                  <option value="" disabled>Select Account…</option>
                                  {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                account?.name || p.accountName || 'Unknown Account'
                              )}
                            </TableCell>
                          );
                        }
                        if (col.key === 'clientPartnerName' || col.key === 'clientPartnerId') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="text-slate-600" onDoubleClick={(e) => { e.stopPropagation(); if (canUpdateProject) setEditingCell({ id: p.id, key: 'clientPartnerId', value: p.clientPartnerId || '' }); }}>
                              {editingCell?.id === p.id && editingCell?.key === 'clientPartnerId' ? (
                                <select autoFocus value={editingCell.value} onChange={e => { const u = clientPartnerOptions.find((x: any) => x.id === e.target.value); saveInlineCell(p.id, 'clientPartnerId', e.target.value, { clientPartnerName: u?.name || '' }); }} onBlur={() => setEditingCell(null)} className="text-xs p-1 border border-indigo-500 rounded bg-white">
                                  <option value="">Select Client Partner…</option>
                                  {clientPartnerOptions.map((u: any) => <option key={u.id} value={u.id}>{serviceProviderOptionLabel(u)}</option>)}
                                </select>
                              ) : (resolveProjectUserLabel(p.clientPartnerName, p.clientPartnerId, clientPartnerOptions))}
                            </TableCell>
                          );
                        }
                        if (col.key === 'serviceProviderPmName' || col.key === 'serviceProviderPmId') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="text-slate-600" onDoubleClick={(e) => { e.stopPropagation(); if (canUpdateProject) setEditingCell({ id: p.id, key: 'serviceProviderPmId', value: p.serviceProviderPmId || '' }); }}>
                              {editingCell?.id === p.id && editingCell?.key === 'serviceProviderPmId' ? (
                                <select autoFocus value={editingCell.value} onChange={e => { const u = pmOptions.find((x: any) => x.id === e.target.value); saveInlineCell(p.id, 'serviceProviderPmId', e.target.value, { serviceProviderPmName: u?.name || '' }); }} onBlur={() => setEditingCell(null)} className="text-xs p-1 border border-indigo-500 rounded bg-white">
                                  <option value="">Select Project Manager…</option>
                                  {pmOptions.map((u: any) => <option key={u.id} value={u.id}>{serviceProviderOptionLabel(u)}</option>)}
                                </select>
                              ) : (resolveProjectUserLabel(p.serviceProviderPmName, p.serviceProviderPmId, pmOptions))}
                            </TableCell>
                          );
                        }
                        if (col.key === 'practiceLeadName' || col.key === 'practiceLeadId') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="text-slate-600" onDoubleClick={(e) => { e.stopPropagation(); if (canUpdateProject) setEditingCell({ id: p.id, key: 'practiceLeadId', value: p.practiceLeadId || '' }); }}>
                              {editingCell?.id === p.id && editingCell?.key === 'practiceLeadId' ? (
                                <select autoFocus value={editingCell.value} onChange={e => { const u = practiceLeadOptions.find((x: any) => x.id === e.target.value); saveInlineCell(p.id, 'practiceLeadId', e.target.value, { practiceLeadName: u?.name || '' }); }} onBlur={() => setEditingCell(null)} className="text-xs p-1 border border-indigo-500 rounded bg-white">
                                  <option value="">Select Practice Lead…</option>
                                  {practiceLeadOptions.map((u: any) => <option key={u.id} value={u.id}>{serviceProviderOptionLabel(u)}</option>)}
                                </select>
                              ) : (resolveProjectUserLabel(p.practiceLeadName, p.practiceLeadId, practiceLeadOptions))}
                            </TableCell>
                          );
                        }
                        if (col.key === 'methodology') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="text-slate-600" onDoubleClick={(e) => { e.stopPropagation(); if (canUpdateProject) setEditingCell({ id: p.id, key: 'methodology', value: p.methodology }); }}>
                              {editingCell?.id === p.id && editingCell?.key === 'methodology' ? (
                                <select autoFocus value={editingCell.value} onChange={e => saveInlineCell(p.id, 'methodology', e.target.value)} onBlur={() => setEditingCell(null)} className="text-xs p-1 border border-indigo-500 rounded bg-white">
                                  {METHODOLOGY_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              ) : (p.methodology)}
                            </TableCell>
                          );
                        }
                        if (col.key === 'health') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} align="center" onDoubleClick={(e) => { e.stopPropagation(); if (canUpdateProject) setEditingCell({ id: p.id, key: 'health', value: p.health }); }}>
                              {editingCell?.id === p.id && editingCell?.key === 'health' ? (
                                <select autoFocus value={editingCell.value} onChange={e => saveInlineCell(p.id, 'health', e.target.value)} onBlur={() => setEditingCell(null)} className="text-xs p-1 border border-indigo-500 rounded bg-white">
                                  {HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              ) : (
                                <StatusBadge value={p.health} colorMap={HEALTH_COLORS} />
                              )}
                            </TableCell>
                          );
                        }
                        if (col.key === 'actualCompletionPct') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} align="center">
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
                          );
                        }
                        if (col.key === 'status') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="text-slate-600 font-medium" onDoubleClick={(e) => { e.stopPropagation(); if (canUpdateProject) setEditingCell({ id: p.id, key: 'status', value: p.status }); }}>
                              {editingCell?.id === p.id && editingCell?.key === 'status' ? (
                                <select autoFocus value={editingCell.value} onChange={e => saveInlineCell(p.id, 'status', e.target.value)} onBlur={() => setEditingCell(null)} className="text-xs p-1 border border-indigo-500 rounded bg-white">
                                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (p.status)}
                            </TableCell>
                          );
                        }
                        if (col.key === 'startDate') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="font-mono text-slate-500 whitespace-nowrap">
                              {p.startDate || 'N/A'}
                            </TableCell>
                          );
                        }
                        if (col.key === 'endDate') {
                          return (
                            <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="font-mono text-slate-500 whitespace-nowrap">
                              {p.endDate || 'N/A'}
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={col.key} sticky={col.isPinned ? 'left' : undefined} stickyLeft={pinnedOffsets[col.key]} className="text-slate-600">
                            {String((p as any)[col.key] ?? '—')}
                          </TableCell>
                        );
                      })}
                      <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <RowActionButton
                            intent="view"
                            label={`View project ${p.name}`}
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => handleRowClick(p.id)}
                          />
                          {canUpdateProject && (
                            <RowActionButton
                              intent="edit"
                              label={`Edit project ${p.name}`}
                              icon={<Pencil className="w-3.5 h-3.5" />}
                              onClick={() => handleOpenEditModal(p)}
                            />
                          )}
                          {canDeleteProject && (
                            <RowActionButton
                              intent="delete"
                              label={`Delete project ${p.name}`}
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => setDeleteTarget({ id: p.id, label: p.name })}
                            />
                          )}
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

      {isCreateModalOpen && (
        <ProjectFormModal
          isOpen={isCreateModalOpen}
          mode="create"
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleSaveDirectProject}
          isSubmitting={isSubmittingCreate}
          value={newProjectDraft}
          onChange={(patch) => setNewProjectDraft((prev) => ({ ...prev, ...patch }))}
          users={[]}
          stakeholders={[]}
        />
      )}

      {isEditModalOpen && editingProjectDraft && (
        <ProjectFormModal
          isOpen={isEditModalOpen}
          mode="edit"
          onClose={() => { setIsEditModalOpen(false); setEditingProjectDraft(null); setEditProjectError(null); }}
          onSubmit={handleSaveEditProject}
          isSubmitting={isSubmittingEdit}
          errorMsg={editProjectError}
          value={editingProjectDraft}
          onChange={(patch) => setEditingProjectDraft((prev) => (prev ? { ...prev, ...patch } : null))}
        />
      )}
    </div>
  );
};
