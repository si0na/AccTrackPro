import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpCircle, BadgeCheck, Eye, FileText, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import type { SqaRecord, User } from '@/types';
import { usersApi } from '@/api/crm.api';
import { compareForSort, matchesGlobalAccount, SortDirection } from '@/utils';
import {
  Button,
  Card,
  ConfirmDialog,
  DeactivatedSection,
  EmptyRow,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  HEALTH_COLORS,
  PageHeader,
  Pagination,
  PRIORITY_COLORS,
  RestoreButton,
  RestoreDialog,
  RowActionButton,
  SearchBar,
  SortableHeader,
  StatusBadge,
  SummaryCard,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextPreviewCell,
  InlineTextEditCell,
  InlineSelectEditCell,
  InlineTextareaEditCell,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import {
  SQA_HEALTH_WEEK_CHOICES,
  SQA_IMPORTANCE_OPTIONS,
  PROJECT_HEALTH_OPTIONS,
  SQA_BILLING_MODEL_OPTIONS,
  SQA_DELIVERY_MODEL_OPTIONS,
  SQA_RESOURCING_STATUS_OPTIONS,
  SQA_SDLC_PHASE_OPTIONS,
  SQA_TOWER_OPTIONS,
} from '@/constants';
import { sqaErrorMessage, useSqaAvailableProjects, useSqaRecords } from '../hooks/useSqaRecords';
import { SqaWeekHealthCell, weekKey } from './SqaWeeklyHealthGrid';
import {
  draftFromRecord, draftToInput, emptySqaDraft, SqaDraft, SqaFormModal, SqaInherited,
} from './SqaFormModal';
import { SqaTrackerTab } from './SqaTrackerTab';

const formatCur = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const YES_NO_COLORS: Record<string, string> = {
  Yes: 'bg-green-100 text-green-700',
  No: 'bg-slate-100 text-slate-600',
};
const ESCALATION_COLORS: Record<string, string> = {
  Yes: 'bg-red-100 text-red-700',
  No: 'bg-slate-100 text-slate-600',
};

/** The RAG of the most recent week in the window — what "current health" means here. */
const latestWeekHealth = (record: SqaRecord): string | null =>
  record.weeklyHealth.length ? record.weeklyHealth[record.weeklyHealth.length - 1].health : null;

/**
 * SQA list — every SQA record with its inherited project data and its trailing
 * weekly health columns.
 *
 * The "Health Week NN" columns are generated from the window the server
 * returned, so they roll forward with the calendar instead of being pinned to
 * weeks 31–33, and the "Weeks" control widens the window on demand.
 */
export const SqaListView: React.FC = () => {
  const { globalAccountId, setView, setSelectedSqaId } = useCRM();

  const {
    records, deactivated, weekWindow, weeks, setWeeks,
    loading, error, setError, reload,
    create, update, remove, restore, setWeekHealth,
    canCreate, canUpdate, canDelete, canEditWeeklyHealth,
  } = useSqaRecords();
  const { projects, updateProject } = useCRM();

  const [activeTab, setActiveTab] = useState<'details' | 'tracker'>('details');

  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, []);

  const pmOptions = React.useMemo(() => users.filter(u => u.roleKey === 'project-manager' || u.roleKeys?.includes('project-manager')), [users]);

  const [searchQuery, setSearchQuery] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('All');
  const [healthFilter, setHealthFilter] = useState('All');
  const [wsrFilter, setWsrFilter] = useState('All');
  const [escalationFilter, setEscalationFilter] = useState('All');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortField, setSortField] = useState<string>('projectName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };

  // ── Create / Edit ───────────────────────────────────────────────────────────
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [draft, setDraft] = useState<SqaDraft>(emptySqaDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { projects: availableProjects } = useSqaAvailableProjects(formMode === 'create');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; label: string } | null>(null);

  const openCreate = () => {
    setEditingId(null);
    // Weeks are seeded from the shared window so the new record's grid shows the
    // same weeks as every column in the list.
    setDraft({ ...emptySqaDraft, weeklyHealth: weekWindow });
    setFormMode('create');
  };

  const openEdit = (record: SqaRecord) => {
    setEditingId(record.id);
    setDraft(draftFromRecord(record));
    setFormMode('edit');
  };

  const editingRecord = editingId ? records.find((r) => r.id === editingId) : undefined;
  const previewProject = availableProjects.find((p) => p.id === draft.projectId);

  /**
   * What the form shows as inherited. Both branches read server-computed values
   * — the saved record, or the Create picker's preview — so the form never
   * re-derives the inheritance rules itself.
   */
  const inherited: SqaInherited = useMemo(() => {
    if (formMode === 'edit' && editingRecord) {
      return {
        accountName: editingRecord.accountName,
        projectHealth: editingRecord.projectHealth,
        pmName: editingRecord.pmName,
        clientPmName: editingRecord.clientPmName,
        billingModel: editingRecord.billingModelInherited,
        tower: editingRecord.towerInherited,
        serviceLine: editingRecord.serviceLineInherited,
        revenue: editingRecord.revenueInherited,
        revenueInheritedSource: editingRecord.revenueInheritedSource,
        fte: editingRecord.fteInherited,
        teamMemberCount: editingRecord.teamMemberCount,
      };
    }
    if (previewProject) {
      return {
        accountName: previewProject.accountName,
        projectHealth: previewProject.projectHealth,
        pmName: previewProject.pmName,
        clientPmName: previewProject.clientPmName,
        billingModel: previewProject.billingModelInherited,
        tower: previewProject.towerInherited,
        serviceLine: previewProject.serviceLineInherited,
        revenue: previewProject.revenueInherited,
        revenueInheritedSource: previewProject.revenueInheritedSource,
        fte: previewProject.fteInherited,
        teamMemberCount: previewProject.teamMemberCount,
      };
    }
    return {};
  }, [formMode, editingRecord, previewProject]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.projectId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (formMode === 'edit' && editingId) await update(editingId, draftToInput(draft));
      else await create(draftToInput(draft));
      setFormMode(null);
      setEditingId(null);
    } catch (err) {
      setError(sqaErrorMessage(err, 'Failed to save the SQA record.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Filtering / sorting ─────────────────────────────────────────────────────
  const filtered = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || (r.projectName ?? '').toLowerCase().includes(q)
      || (r.accountName ?? '').toLowerCase().includes(q)
      || (r.pmName ?? '').toLowerCase().includes(q)
      || (r.tower ?? '').toLowerCase().includes(q);
    const matchesAccount = matchesGlobalAccount(r.accountId, globalAccountId);
    const matchesImportance = importanceFilter === 'All' || r.importance === importanceFilter;
    const matchesHealth = healthFilter === 'All' || latestWeekHealth(r) === healthFilter;
    const matchesWsr = wsrFilter === 'All' || String(r.wsrPublished) === wsrFilter;
    const matchesEscalation = escalationFilter === 'All' || String(r.clientEscalation) === escalationFilter;
    return matchesSearch && matchesAccount && matchesImportance
      && matchesHealth && matchesWsr && matchesEscalation;
  });

  const sorted = [...filtered].sort((a, b) =>
    compareForSort((a as any)[sortField], (b as any)[sortField], sortDirection),
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Summary strip ───────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    total: filtered.length,
    red: filtered.filter((r) => latestWeekHealth(r) === 'Red').length,
    escalations: filtered.filter((r) => r.clientEscalation).length,
    wsrPending: filtered.filter((r) => !r.wsrPublished).length,
  }), [filtered]);

  const openDetails = (id: string) => {
    setSelectedSqaId(id);
    setView('sqa-details');
  };

  if (loading) return <LoadingState label="Loading SQA records…" />;

  // Base columns before the weekly ones — used for the empty-row colspan and to
  // tell the table how far past the container it needs to grow.
  const BASE_COLS = 14;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SQA"
        subtitle="Weekly quality tracking per project — inherited delivery data, SQA classification, and the weekly health trend."
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-tight border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'details'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <BadgeCheck className="w-4 h-4" />
          <span>SQA Details</span>
          <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-700">
            {records.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-tight border-b-2 -mb-px transition-colors cursor-pointer ${
            activeTab === 'tracker'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>SQA Tracker</span>
        </button>
      </div>

      {activeTab === 'tracker' ? (
        <SqaTrackerTab />
      ) : (
        <>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="SQA Records"
          value={summary.total}
          icon={<BadgeCheck className="w-5 h-5" />}
        />
        <SummaryCard
          label="Red This Week"
          value={summary.red}
          tone="amber"
          icon={<AlertTriangle className="w-5 h-5" />}
          urgent={summary.red > 0}
        />
        <SummaryCard
          label="Client Escalations"
          value={summary.escalations}
          tone="amber"
          icon={<ArrowUpCircle className="w-5 h-5" />}
          urgent={summary.escalations > 0}
        />
        <SummaryCard
          label="WSR Not Published"
          value={summary.wsrPending}
          tone="slate"
          icon={<FileText className="w-5 h-5" />}
        />
      </div>

      <FilterBar className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search projects, accounts, PMs, towers..."
          className="w-full xl:col-span-2"
        />
        <FilterSelect
          label="Importance"
          hideLabel
          value={importanceFilter}
          onChange={setImportanceFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Importance' },
            ...SQA_IMPORTANCE_OPTIONS.map((i) => ({ value: i, label: i })),
          ]}
        />
        <FilterSelect
          label="Latest Week Health"
          hideLabel
          value={healthFilter}
          onChange={setHealthFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'All Health' },
            ...PROJECT_HEALTH_OPTIONS.map((h) => ({ value: h, label: h })),
          ]}
        />
        <FilterSelect
          label="WSR Publish Status"
          hideLabel
          value={wsrFilter}
          onChange={setWsrFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'WSR: All' },
            { value: 'true', label: 'WSR: Published' },
            { value: 'false', label: 'WSR: Not published' },
          ]}
        />
        <FilterSelect
          label="Client Escalation"
          hideLabel
          value={escalationFilter}
          onChange={setEscalationFilter}
          className="w-full"
          options={[
            { value: 'All', label: 'Escalation: All' },
            { value: 'true', label: 'Escalation: Yes' },
            { value: 'false', label: 'Escalation: No' },
          ]}
        />
      </FilterBar>

      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable storageKey="sqa">
            <TableHead>
              <TableHeadCell columnId="projectName">
                <SortableHeader label="Project" field="projectName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="accountName">
                <SortableHeader label="Account" field="accountName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="importance" align="center">
                <SortableHeader label="Importance" field="importance" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="deliveryModel">Delivery Model</TableHeadCell>
              <TableHeadCell columnId="billingModel">Billing Model</TableHeadCell>
              <TableHeadCell columnId="tower">Tower</TableHeadCell>
              <TableHeadCell columnId="serviceLine">Service Line</TableHeadCell>
              <TableHeadCell columnId="fte" align="right">FTE</TableHeadCell>
              <TableHeadCell columnId="revenue" align="right">
                <SortableHeader label="Revenue" field="revenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="pmName">PM</TableHeadCell>
              <TableHeadCell columnId="wsrPublished" align="center">WSR Publish Status (Y/N)</TableHeadCell>
              <TableHeadCell columnId="health" align="center">
                <SortableHeader label="Health" field="projectHealth" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="clientEscalation" align="center">Client Escalation</TableHeadCell>
              <TableHeadCell columnId="currentSdlcPhase">Current SDLC Phase</TableHeadCell>
              <TableHeadCell columnId="resourcingStatus">Resourcing Status</TableHeadCell>
              <TableHeadCell columnId="currentWeekUpdate">Update for the Current Week</TableHeadCell>
              <TableHeadCell columnId="nextWeekPlan">Plan for Next Week</TableHeadCell>
              <TableHeadCell columnId="issuesChallenges">Issues / Challenges</TableHeadCell>
              <TableHeadCell columnId="pathToGreen">Path to Green</TableHeadCell>
              <TableHeadCell columnId="sqaRemarks">SQA Remarks</TableHeadCell>
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {paged.length === 0 ? (
                <EmptyRow
                  colSpan={BASE_COLS + 7}
                  message="No SQA records found matching the selected search and criteria."
                />
              ) : (
                paged.map((r) => {
                  const byWeek = new Map(r.weeklyHealth.map((w) => [weekKey(w), w]));
                  return (
                    <TableRow key={r.id} clickable onClick={() => openDetails(r.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                            <BadgeCheck className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <p className="font-bold text-slate-900 text-sm min-w-0 truncate">
                            {r.projectName || 'Unknown Project'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 font-semibold">{r.accountName || '—'}</TableCell>
                      <TableCell align="center">
                        <InlineSelectEditCell
                          value={r.importance ?? 'Medium'}
                          options={SQA_IMPORTANCE_OPTIONS}
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.importance = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <InlineSelectEditCell
                          value={r.deliveryModel ?? ''}
                          options={[{ value: '', label: '— Inherit —' }, ...SQA_DELIVERY_MODEL_OPTIONS]}
                          placeholder="— Inherit —"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.deliveryModel = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <InlineSelectEditCell
                          value={r.billingModelOverride ?? ''}
                          options={[{ value: '', label: '— Inherit —' }, ...SQA_BILLING_MODEL_OPTIONS]}
                          placeholder={r.billingModel || '— Inherit —'}
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.billingModelOverride = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <InlineSelectEditCell
                          value={r.towerOverride ?? ''}
                          options={[{ value: '', label: '— Inherit —' }, ...SQA_TOWER_OPTIONS]}
                          placeholder={r.tower || '— Inherit —'}
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.towerOverride = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">{r.serviceLine || '—'}</TableCell>
                      <TableCell align="right" className="font-mono text-slate-600">
                        <InlineTextEditCell
                          type="number"
                          value={r.fteOverride ?? r.fte}
                          placeholder="—"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.fteOverride = v !== undefined && v !== null && String(v) !== '' ? Number(v) : undefined;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" className="font-mono text-slate-700 whitespace-nowrap">
                        <InlineTextEditCell
                          type="number"
                          value={r.revenueOverride ?? r.revenue}
                          placeholder="—"
                          disabled={!canUpdate}
                          formatDisplay={(v) => (v !== undefined && v !== null && String(v) !== '' ? formatCur(Number(v)) : '—')}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.revenueOverride = v !== undefined && v !== null && String(v) !== '' ? Number(v) : undefined;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <InlineSelectEditCell
                          value={r.pmName || ''}
                          options={pmOptions.map(u => ({ value: u.name, label: u.name }))}
                          placeholder="— Inherit —"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const u = users.find(x => x.name === v);
                            if (u && r.projectId) {
                              const p = projects.find(proj => proj.id === r.projectId);
                              if (p) {
                                await updateProject({ ...p, serviceProviderPmId: u.id, serviceProviderPmName: u.name });
                                await reload();
                              }
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <InlineSelectEditCell
                          value={r.wsrPublished ? 'Yes' : 'No'}
                          options={['Yes', 'No']}
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.wsrPublished = v === 'Yes';
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <StatusBadge
                          value={r.projectHealth || 'Green'}
                          colorMap={HEALTH_COLORS}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <InlineSelectEditCell
                          value={r.clientEscalation ? 'Yes' : 'No'}
                          options={['Yes', 'No']}
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.clientEscalation = v === 'Yes';
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <InlineSelectEditCell
                          value={r.currentSdlcPhase ?? ''}
                          options={[{ value: '', label: '— None —' }, ...SQA_SDLC_PHASE_OPTIONS]}
                          placeholder="— None —"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.currentSdlcPhase = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <InlineSelectEditCell
                          value={r.resourcingStatus ?? ''}
                          options={[{ value: '', label: '— None —' }, ...SQA_RESOURCING_STATUS_OPTIONS]}
                          placeholder="— None —"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.resourcingStatus = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineTextareaEditCell
                          value={r.currentWeekUpdate}
                          label="Update for the Current Week"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.currentWeekUpdate = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineTextareaEditCell
                          value={r.nextWeekPlan}
                          label="Plan for Next Week"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.nextWeekPlan = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineTextareaEditCell
                          value={r.issuesChallenges}
                          label="Issues / Challenges"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.issuesChallenges = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineTextareaEditCell
                          value={r.pathToGreen}
                          label="Path to Green"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.pathToGreen = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineTextareaEditCell
                          value={r.sqaRemarks}
                          label="SQA Remarks"
                          disabled={!canUpdate}
                          onSave={async (v) => {
                            const d = draftFromRecord(r);
                            d.sqaRemarks = v;
                            await update(r.id, draftToInput(d));
                          }}
                        />
                      </TableCell>
                      <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <RowActionButton
                            intent="view"
                            label={`View SQA record for ${r.projectName}`}
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => openDetails(r.id)}
                          />
                          {canUpdate && (
                            <RowActionButton
                              intent="edit"
                              label={`Edit SQA record for ${r.projectName}`}
                              icon={<Pencil className="w-3.5 h-3.5" />}
                              onClick={() => openEdit(r)}
                            />
                          )}
                          {canDelete && (
                            <RowActionButton
                              intent="delete"
                              label={`Delete SQA record for ${r.projectName}`}
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => setDeleteTarget({ id: r.id, label: r.projectName ?? 'this project' })}
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
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel="SQA records"
        />
      </Card>

      {formMode && (
        <SqaFormModal
          isOpen
          mode={formMode}
          onClose={() => { setFormMode(null); setEditingId(null); }}
          onSubmit={submit}
          isSubmitting={isSubmitting}
          value={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          availableProjects={availableProjects}
          inherited={inherited}
          weeklyHealthReadOnly={!canEditWeeklyHealth}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete SQA Record"
        message={deleteTarget ? (
          <>Deactivate the SQA record for <span className="font-bold">"{deleteTarget.label}"</span>? It
          moves to the Deactivated section; the project's health history is untouched.</>
        ) : undefined}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await remove(deleteTarget.id);
          } catch (err) {
            setError(sqaErrorMessage(err, 'Failed to delete the SQA record.'));
          } finally {
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {deactivated.length > 0 && (
        <DeactivatedSection title="Deactivated SQA Records" count={deactivated.length}>
          <Table>
            <TableHead>
              <TableHeadCell>Project</TableHeadCell>
              <TableHeadCell>Account</TableHeadCell>
              <TableHeadCell>Importance</TableHeadCell>
              <TableHeadCell align="center">Restore</TableHeadCell>
            </TableHead>
            <tbody>
              {deactivated.map((r) => (
                <TableRow key={r.id} className="opacity-70">
                  <TableCell>
                    <span className="font-semibold text-slate-600 line-through decoration-slate-300">
                      {r.projectName || 'Unknown Project'}
                    </span>
                  </TableCell>
                  <TableCell>{r.accountName || '—'}</TableCell>
                  <TableCell className="text-slate-500">{r.importance}</TableCell>
                  <TableCell align="center">
                    <RestoreButton
                      label={`Restore SQA record for ${r.projectName}`}
                      onClick={() => setRestoreTarget({ id: r.id, label: r.projectName ?? 'this project' })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </DeactivatedSection>
      )}

      <RestoreDialog
        isOpen={!!restoreTarget}
        title="Restore SQA Record"
        message={restoreTarget ? (
          <>Restore the SQA record for <span className="font-bold">"{restoreTarget.label}"</span>?</>
        ) : undefined}
        onConfirm={async () => {
          if (!restoreTarget) return;
          try {
            await restore(restoreTarget.id);
            await reload();
          } catch (err) {
            setError(sqaErrorMessage(err, 'Failed to restore the SQA record.'));
          } finally {
            setRestoreTarget(null);
          }
        }}
        onCancel={() => setRestoreTarget(null)}
      />
        </>
      )}
    </div>
  );
};
