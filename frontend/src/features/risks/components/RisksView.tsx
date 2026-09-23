import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { centralRisksApi, accountRisksApi, projectRisksApi, projectIssuesApi } from '@/api/crm.api';
import { NormalizedRisk } from '@/types';
import { useCRM } from '@/contexts/CRMContext';
import {
  ShieldAlert,
  Building2,
  User,
  Filter,
  RefreshCw,
  Plus,
  FolderGit2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { compareForSort, SortDirection } from '@/utils';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyRow,
  FilterBar,
  HEALTH_COLORS,
  PageHeader,
  Pagination,
  PRIORITY_COLORS,
  RowActionButton,
  SearchBar,
  SortableHeader,
  StatusBadge,
  SummaryCard,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { RiskFormModal } from './RiskFormModal';
import { IssueFormModal } from './IssueFormModal';
import { RiskQuickPanel } from './RiskQuickPanel';

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 border-amber-200',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  Mitigated: 'bg-blue-100 text-blue-800 border-blue-200',
  Closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Accepted: 'bg-slate-100 text-slate-700 border-slate-200',
  Resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const RisksView: React.FC = () => {
  const {
    accounts,
    projects,
    globalAccountId,
    setView,
    setSelectedAccountId,
    setSelectedRiskId,
    can,
  } = useCRM();

  // Compute available accounts by combining accounts list and accounts derived from accessible projects
  const availableAccounts = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    accounts.forEach((acc) => {
      if (acc.id) {
        map.set(acc.id, { id: acc.id, name: acc.name });
      }
    });
    projects.forEach((proj) => {
      if (proj.accountId && !map.has(proj.accountId)) {
        map.set(proj.accountId, {
          id: proj.accountId,
          name: proj.accountName || proj.accountId,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, projects]);

  // Parent Tab State: 'Risks' | 'Issues'
  const [activeTab, setActiveTab] = useState<'Risks' | 'Issues'>('Risks');

  const [items, setItems] = useState<NormalizedRisk[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded Row state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [ragFilter, setRagFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [localAccountId, setLocalAccountId] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Quick Panel State
  const [selectedQuickItem, setSelectedQuickItem] = useState<NormalizedRisk | null>(null);

  // Modals & Actions
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [targetItem, setTargetItem] = useState<NormalizedRisk | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NormalizedRisk | null>(null);

  const activeAccountId = globalAccountId !== 'All' ? globalAccountId : localAccountId;

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await centralRisksApi.getAll({
        source: sourceFilter !== 'All' ? sourceFilter : undefined,
        accountId: activeAccountId !== 'All' ? activeAccountId : undefined,
        rag: activeTab === 'Risks' && ragFilter !== 'All' ? ragFilter : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
      });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sourceFilter, activeAccountId, activeTab, ragFilter, priorityFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Separate Risks list vs Issues list
  const risksList = useMemo(() => items.filter((i) => i.riskType !== 'Issue'), [items]);
  const issuesList = useMemo(() => items.filter((i) => i.riskType === 'Issue'), [items]);

  const currentList = activeTab === 'Risks' ? risksList : issuesList;

  // Search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return currentList.filter((r) => {
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        (r.accountName || '').toLowerCase().includes(q) ||
        (r.projectName || '').toLowerCase().includes(q) ||
        (r.ownerName || '').toLowerCase().includes(q) ||
        (r.mitigationPlan || '').toLowerCase().includes(q) ||
        (r.contingencyPlan || '').toLowerCase().includes(q) ||
        (r.impactDescription || '').toLowerCase().includes(q) ||
        (r.classification || '').toLowerCase().includes(q) ||
        (r.priority || '').toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q)
      );
    });
  }, [currentList, search]);

  // Column sort state — default to description ascending
  const [sortField, setSortField] = useState<string>('description');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortValue = (item: NormalizedRisk, field: string): string | number => {
    switch (field) {
      case 'scope':
        return item.sourceType || '';
      case 'account':
        return item.accountName || '';
      case 'project':
        return item.projectName || '';
      case 'description':
        return item.description || '';
      case 'rag':
        return item.rag || '';
      case 'classification':
        return item.classification || '';
      case 'priority':
        return item.priority || '';
      case 'status':
        return item.status || '';
      case 'owner':
        return item.ownerName || '';
      case 'openDate':
      case 'dateIdentified':
        return item.riskOpenDate || '';
      case 'targetDate':
        return item.targetResolutionDate || '';
      case 'impact':
        return item.impact || '';
      case 'likelihood':
        return item.likelihood || '';
      case 'severity':
        return item.severity || '';
      case 'impactDesc':
        return item.impactDescription || '';
      case 'mitigation':
        return item.mitigationPlan || '';
      case 'contingency':
        return item.contingencyPlan || '';
      case 'resolutionPlan':
        return item.mitigationPlan || '';
      case 'remarks':
        return item.contingencyPlan || '';
      default:
        return (item as any)[field] ?? '';
    }
  };

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection)
    );
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Metrics for Risks
  const riskOpenCount = useMemo(() => risksList.filter((r) => r.status === 'Open' || r.status === 'In Progress').length, [risksList]);
  const riskHighCount = useMemo(
    () => risksList.filter((r) => (r.status === 'Open' || r.status === 'In Progress') && (r.priority === 'High' || r.severity === 'Critical' || r.severity === 'High')).length,
    [risksList]
  );
  const riskAccountCount = useMemo(() => risksList.filter((r) => r.sourceType === 'Account').length, [risksList]);
  const riskProjectCount = useMemo(() => risksList.filter((r) => r.sourceType === 'Project').length, [risksList]);

  // Metrics for Issues
  const issueOpenCount = useMemo(() => issuesList.filter((r) => r.status === 'Open' || r.status === 'In Progress').length, [issuesList]);
  const issueHighCount = useMemo(
    () => issuesList.filter((r) => (r.status === 'Open' || r.status === 'In Progress') && r.priority === 'High').length,
    [issuesList]
  );
  const issueAccountCount = useMemo(() => issuesList.filter((r) => r.sourceType === 'Account').length, [issuesList]);
  const issueProjectCount = useMemo(() => issuesList.filter((r) => r.sourceType === 'Project').length, [issuesList]);

  const handleNavigateAccount = (r: NormalizedRisk) => {
    if (r.accountId) {
      setSelectedAccountId(r.accountId);
      setView('account-details');
    }
  };

  const handleOpenDetail = (item: NormalizedRisk) => {
    setSelectedRiskId(item.id);
    setView('risk-details');
  };

  const handleOpenCreate = () => {
    setTargetItem(null);
    setModalMode('create');
    if (activeTab === 'Risks') {
      setRiskModalOpen(true);
    } else {
      setIssueModalOpen(true);
    }
  };

  const handleOpenEdit = (item: NormalizedRisk) => {
    setTargetItem(item);
    setModalMode('edit');
    if (item.riskType === 'Issue') {
      setIssueModalOpen(true);
    } else {
      setRiskModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.id.startsWith('proj-issue-')) {
        await projectIssuesApi.delete(deleteTarget.projectId!, deleteTarget.sourceId);
      } else if (deleteTarget.sourceType === 'Project') {
        await projectRisksApi.delete(deleteTarget.projectId!, deleteTarget.sourceId);
      } else {
        await accountRisksApi.delete(deleteTarget.sourceId);
      }
      await loadData(true);
    } catch {
      // Handled silently
    } finally {
      setDeleteTarget(null);
    }
  };

  const canCreate = can('risks', 'create');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Risks & Issues"
        subtitle="Central management, aggregation, and tracking of Account and Project level Risks & Issues"
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreate}
            >
              {activeTab === 'Risks' ? 'Add Risk' : 'Add Issue'}
            </Button>
          ) : undefined
        }
      />

      {/* Sub-Tabs Selector: [ Risks ] [ Issues ] */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('Risks');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'Risks'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Risks ({risksList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('Issues');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'Issues'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Issues ({issuesList.length})</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {activeTab === 'Risks' ? (
          <>
            <SummaryCard
              label="Total Open Risks"
              value={riskOpenCount}
              icon={<ShieldAlert className="w-4.5 h-4.5 text-red-600" />}
              tone="amber"
              actionLabel="Show Open"
              onAction={() => { setStatusFilter('Open'); setPage(1); }}
            />
            <SummaryCard
              label="High / Critical Risks"
              value={riskHighCount}
              icon={<AlertTriangle className="w-4.5 h-4.5 text-red-600" />}
              tone="amber"
              urgent={true}
              actionLabel="Show High"
              onAction={() => { setPriorityFilter('High'); setPage(1); }}
            />
            <SummaryCard
              label="Account Risks"
              value={riskAccountCount}
              icon={<Building2 className="w-4.5 h-4.5 text-purple-600" />}
              tone="amber"
              actionLabel="Show Account Level"
              onAction={() => { setSourceFilter('Account'); setPage(1); }}
            />
            <SummaryCard
              label="Project Risks"
              value={riskProjectCount}
              icon={<FolderGit2 className="w-4.5 h-4.5 text-indigo-600" />}
              tone="blue"
              actionLabel="Show Project Level"
              onAction={() => { setSourceFilter('Project'); setPage(1); }}
            />
          </>
        ) : (
          <>
            <SummaryCard
              label="Total Open Issues"
              value={issueOpenCount}
              icon={<AlertCircle className="w-4.5 h-4.5 text-amber-600" />}
              tone="amber"
              actionLabel="Show Open"
              onAction={() => { setStatusFilter('Open'); setPage(1); }}
            />
            <SummaryCard
              label="High Priority Issues"
              value={issueHighCount}
              icon={<AlertTriangle className="w-4.5 h-4.5 text-amber-600" />}
              tone="amber"
              urgent={true}
              actionLabel="Show High"
              onAction={() => { setPriorityFilter('High'); setPage(1); }}
            />
            <SummaryCard
              label="Account Issues"
              value={issueAccountCount}
              icon={<Building2 className="w-4.5 h-4.5 text-purple-600" />}
              tone="amber"
              actionLabel="Show Account Level"
              onAction={() => { setSourceFilter('Account'); setPage(1); }}
            />
            <SummaryCard
              label="Project Issues"
              value={issueProjectCount}
              icon={<FolderGit2 className="w-4.5 h-4.5 text-indigo-600" />}
              tone="blue"
              actionLabel="Show Project Level"
              onAction={() => { setSourceFilter('Project'); setPage(1); }}
            />
          </>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              {activeTab === 'Risks' ? 'Risk Filters' : 'Issue Filters'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSourceFilter('All');
              setRagFilter('All');
              setPriorityFilter('All');
              setStatusFilter('All');
              setLocalAccountId('All');
              setSearch('');
              setPage(1);
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Source / Level Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Source / Level</label>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white cursor-pointer font-semibold text-slate-700"
            >
              <option value="All">All Sources</option>
              <option value="Account">Account Level</option>
              <option value="Project">Project Level</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white cursor-pointer font-semibold text-slate-700"
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
            </select>
          </div>

          {/* RAG Filter (Risks Only) */}
          {activeTab === 'Risks' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">RAG Status</label>
              <select
                value={ragFilter}
                onChange={(e) => { setRagFilter(e.target.value); setPage(1); }}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white cursor-pointer font-semibold text-slate-700"
              >
                <option value="All">All RAG</option>
                <option value="Amber">Amber</option>
                <option value="Green">Green</option>
                <option value="Red">Red</option>
              </select>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white cursor-pointer font-semibold text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Accepted">Accepted</option>
              <option value="Closed">Closed</option>
              <option value="In Progress">In Progress</option>
              <option value="Mitigated">Mitigated</option>
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Account</label>
            <select
              value={activeAccountId}
              onChange={(e) => { setLocalAccountId(e.target.value); setPage(1); }}
              disabled={globalAccountId !== 'All'}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white cursor-pointer font-semibold text-slate-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="All">All Accounts</option>
              {availableAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* FilterBar & Search */}
      <FilterBar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder={`Search ${activeTab.toLowerCase()} by description, owner, plans, classification...`}
          className="flex-1 min-w-[240px]"
        />
      </FilterBar>

      {/* Main Table Card */}
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable storageKey={activeTab === 'Risks' ? 'risks:table' : 'issues:table'}>
            <TableHead>
              <TableHeadCell columnId="scope">
                <SortableHeader label="Scope / Level" field="scope" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="account">
                <SortableHeader label="Account" field="account" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="project">
                <SortableHeader label="Project" field="project" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="description">
                <SortableHeader label="Description" field="description" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              {activeTab === 'Risks' && (
                <TableHeadCell columnId="rag" align="center">
                  <SortableHeader label="RAG" field="rag" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
              )}
              {activeTab === 'Risks' && (
                <TableHeadCell columnId="classification">
                  <SortableHeader label="Classification" field="classification" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
              )}
              <TableHeadCell columnId="priority" align="center">
                <SortableHeader label="Priority" field="priority" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="status" align="center">
                <SortableHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="owner">
                <SortableHeader label="Owner" field="owner" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId={activeTab === 'Risks' ? 'openDate' : 'dateIdentified'}>
                <SortableHeader
                  label={activeTab === 'Risks' ? 'Risk Open Date' : 'Date Identified'}
                  field={activeTab === 'Risks' ? 'openDate' : 'dateIdentified'}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHeadCell>
              <TableHeadCell columnId="targetDate">
                <SortableHeader label="Target Resolution Date" field="targetDate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              <TableHeadCell columnId="impact">
                <SortableHeader label="Impact" field="impact" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              </TableHeadCell>
              {activeTab === 'Risks' && (
                <TableHeadCell columnId="likelihood">
                  <SortableHeader label="Likelihood" field="likelihood" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
              )}
              {activeTab === 'Risks' && (
                <TableHeadCell columnId="severity">
                  <SortableHeader label="Severity (Calculated)" field="severity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
              )}
              {activeTab === 'Risks' ? (
                <>
                  <TableHeadCell columnId="impactDesc">
                    <SortableHeader label="Impact Description" field="impactDesc" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHeadCell>
                  <TableHeadCell columnId="mitigation">
                    <SortableHeader label="Mitigation Plan" field="mitigation" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHeadCell>
                  <TableHeadCell columnId="contingency">
                    <SortableHeader label="Contingency Plan" field="contingency" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHeadCell>
                </>
              ) : (
                <>
                  <TableHeadCell columnId="resolutionPlan">
                    <SortableHeader label="Resolution Plan" field="resolutionPlan" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHeadCell>
                  <TableHeadCell columnId="remarks">
                    <SortableHeader label="Remarks" field="remarks" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHeadCell>
                </>
              )}
              <TableHeadCell columnId="actions" align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={activeTab === 'Risks' ? 18 : 13} message={`Loading ${activeTab.toLowerCase()}...`} />
              ) : filtered.length === 0 ? (
                <EmptyRow colSpan={activeTab === 'Risks' ? 18 : 13} message={search ? 'No items match your search filters.' : `No ${activeTab.toLowerCase()} found.`} />
              ) : (
                paged.map((item) => (
                  <TableRow
                    key={item.id}
                    clickable
                    onClick={() => setSelectedQuickItem(item)}
                    className={`hover:bg-slate-50/70 cursor-pointer transition-colors ${
                      selectedQuickItem?.id === item.id ? 'bg-indigo-50/50 ring-1 ring-indigo-200' : ''
                    }`}
                  >
                    {/* Scope Badge */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {item.sourceType === 'Project' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <FolderGit2 className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate max-w-[140px]">Project</span>
                        </span>
                      ) : item.sourceType === 'Opportunity' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <span className="truncate max-w-[140px]">Opportunity</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>Account Level</span>
                        </span>
                      )}
                    </TableCell>

                    {/* Account Name (Plain text, no link) */}
                    <TableCell className="font-semibold text-slate-700 text-xs">
                      <span className="truncate max-w-[150px] block" title={item.accountName || '—'}>
                        {item.accountName || '—'}
                      </span>
                    </TableCell>

                    {/* Project Name */}
                    <TableCell className="text-slate-700 font-semibold text-xs">
                      {item.projectName || '—'}
                    </TableCell>

                    {/* Description */}
                    <TableCell className="font-semibold text-slate-900 min-w-[200px] max-w-[300px]">
                      <span className="line-clamp-2" title={item.description}>{item.description}</span>
                    </TableCell>

                    {/* RAG (Risks only) */}
                    {activeTab === 'Risks' && (
                      <TableCell align="center">
                        {item.rag ? (
                          <StatusBadge value={item.rag} colorMap={HEALTH_COLORS} shape="rounded" />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                    )}

                    {/* Classification (Risks only) */}
                    {activeTab === 'Risks' && (
                      <TableCell className="text-slate-600 font-medium text-xs">
                        {item.classification || '—'}
                      </TableCell>
                    )}

                    {/* Priority */}
                    <TableCell align="center">
                      <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                    </TableCell>

                    {/* Status */}
                    <TableCell align="center">
                      <StatusBadge value={item.status} colorMap={STATUS_COLORS} shape="rounded" />
                    </TableCell>

                    {/* Owner */}
                    <TableCell className="text-slate-700 font-medium">
                      {item.ownerName ? (
                        <span className="flex items-center gap-1.5 text-slate-800 font-semibold text-xs">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.ownerName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </TableCell>

                    {/* Risk Open Date / Date Identified */}
                    <TableCell className="text-slate-500 text-xs font-mono">
                      {item.riskOpenDate || '—'}
                    </TableCell>

                    {/* Target Resolution Date */}
                    <TableCell className="text-slate-500 text-xs font-mono">
                      {item.targetResolutionDate || '—'}
                    </TableCell>

                    {/* Impact */}
                    <TableCell className="text-slate-700 font-semibold text-xs">
                      {item.impact || '—'}
                    </TableCell>

                    {/* Likelihood (Risks only) */}
                    {activeTab === 'Risks' && (
                      <TableCell className="text-slate-700 font-semibold text-xs">
                        {item.likelihood || '—'}
                      </TableCell>
                    )}

                    {/* Severity (Calculated) (Risks only) */}
                    {activeTab === 'Risks' && (
                      <TableCell className="text-xs">
                        {item.severity ? (
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            item.severity === 'High' || item.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                            item.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.severity}
                          </span>
                        ) : <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                    )}

                    {/* Impact Description / Resolution Plan */}
                    {activeTab === 'Risks' ? (
                      <>
                        <TableCell className="text-slate-600 text-xs max-w-[200px]">
                          <span className="line-clamp-2" title={item.impactDescription}>{item.impactDescription || '—'}</span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs max-w-[200px]">
                          <span className="line-clamp-2" title={item.mitigationPlan}>{item.mitigationPlan || '—'}</span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs max-w-[200px]">
                          <span className="line-clamp-2" title={item.contingencyPlan}>{item.contingencyPlan || '—'}</span>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-slate-600 text-xs max-w-[220px]">
                          <span className="line-clamp-2" title={item.mitigationPlan}>{item.mitigationPlan || '—'}</span>
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs max-w-[220px]">
                          <span className="line-clamp-2" title={item.contingencyPlan}>{item.contingencyPlan || '—'}</span>
                        </TableCell>
                      </>
                    )}

                    {/* Actions */}
                    <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <RowActionButton
                          intent="view"
                          label={`View details for ${item.riskType}`}
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenDetail(item)}
                        />
                        {canCreate && (
                          <RowActionButton
                            intent="edit"
                            label={`Edit ${item.riskType}`}
                            icon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => handleOpenEdit(item)}
                          />
                        )}
                        {canCreate && (
                          <RowActionButton
                            intent="delete"
                            label={`Delete ${item.riskType}`}
                            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                            onClick={() => setDeleteTarget(item)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(sz: number) => { setPageSize(sz); setPage(1); }}
        />
      </Card>

      {/* Quick Panel Drawer Overlay (matching Opportunities & Action Items) */}
      <AnimatePresence>
        {selectedQuickItem && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQuickItem(null)}
              className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs z-50 cursor-pointer"
            />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="fixed right-0 top-0 h-screen w-full sm:w-[650px] md:w-[750px] lg:w-[900px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden"
            >
              <RiskQuickPanel
                item={selectedQuickItem}
                onClose={() => setSelectedQuickItem(null)}
                onEdit={canCreate ? handleOpenEdit : undefined}
                onDelete={canCreate ? (item) => setDeleteTarget(item) : undefined}
                onOpenDetail={handleOpenDetail}
                onSave={() => loadData(true)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Separate Risk Form Modal */}
      {riskModalOpen && (
        <RiskFormModal
          isOpen={riskModalOpen}
          mode={modalMode}
          risk={targetItem}
          onClose={() => setRiskModalOpen(false)}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* Separate Issue Form Modal */}
      {issueModalOpen && (
        <IssueFormModal
          isOpen={issueModalOpen}
          mode={modalMode}
          issue={targetItem}
          onClose={() => setIssueModalOpen(false)}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title={`Delete ${deleteTarget.riskType}`}
          message={`Are you sure you want to delete this ${deleteTarget.riskType.toLowerCase()}? This action cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
