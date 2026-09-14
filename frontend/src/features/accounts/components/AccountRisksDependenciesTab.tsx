import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { centralRisksApi, accountRisksApi, projectRisksApi, projectIssuesApi } from '@/api/crm.api';
import { NormalizedRisk } from '@/types';
import { useCRM } from '@/contexts/CRMContext';
import {
  ShieldAlert,
  Building2,
  User,
  Plus,
  FolderGit2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyRow,
  FilterBar,
  HEALTH_COLORS,
  Pagination,
  PRIORITY_COLORS,
  SearchBar,
  StatusBadge,
  Table,
  TableActions,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { RiskFormModal } from '@/features/risks/components/RiskFormModal';
import { IssueFormModal } from '@/features/risks/components/IssueFormModal';

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 border-amber-200',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
  Mitigated: 'bg-blue-100 text-blue-800 border-blue-200',
  Closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Accepted: 'bg-slate-100 text-slate-700 border-slate-200',
  Resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export interface AccountRisksDependenciesTabProps {
  accountId: string;
  accountName?: string;
}

export const AccountRisksDependenciesTab: React.FC<AccountRisksDependenciesTabProps> = ({ accountId }) => {
  const { can } = useCRM();

  // Active Sub-Tab: 'Risks' | 'Issues'
  const [activeTab, setActiveTab] = useState<'Risks' | 'Issues'>('Risks');

  const [items, setItems] = useState<NormalizedRisk[]>([]);
  const [loading, setLoading] = useState(true);

  // Level Filter: ALL, Account, Project
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'Account' | 'Project'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Expanded Row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals & Actions
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [targetItem, setTargetItem] = useState<NormalizedRisk | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NormalizedRisk | null>(null);

  const loadData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await centralRisksApi.getAll({ accountId });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Separate Risks list vs Issues list
  const risksList = useMemo(() => items.filter((i) => i.riskType !== 'Issue'), [items]);
  const issuesList = useMemo(() => items.filter((i) => i.riskType === 'Issue'), [items]);

  const currentList = activeTab === 'Risks' ? risksList : issuesList;

  // Filter by level and search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return currentList.filter((item) => {
      if (levelFilter === 'Account' && item.sourceType !== 'Account') return false;
      if (levelFilter === 'Project' && item.sourceType !== 'Project') return false;

      if (!q) return true;
      return (
        item.description.toLowerCase().includes(q) ||
        (item.projectName || '').toLowerCase().includes(q) ||
        (item.ownerName || '').toLowerCase().includes(q) ||
        (item.classification || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      );
    });
  }, [currentList, levelFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const accountCount = useMemo(() => currentList.filter((i) => i.sourceType === 'Account').length, [currentList]);
  const projectCount = useMemo(() => currentList.filter((i) => i.sourceType === 'Project').length, [currentList]);

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
      await loadData();
    } catch {
      // Handled silently
    } finally {
      setDeleteTarget(null);
    }
  };

  const canCreate = can('risks', 'create');

  return (
    <div className="space-y-6">
      {/* Top Header: Sub-tabs [ Risks ] [ Issues ] & Level Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Main Sub-Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('Risks');
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'Risks'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Risks ({risksList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('Issues');
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'Issues'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Issues ({issuesList.length})</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Level Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => { setLevelFilter('ALL'); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                levelFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Levels ({currentList.length})
            </button>
            <button
              type="button"
              onClick={() => { setLevelFilter('Account'); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                levelFilter === 'Account' ? 'bg-white text-purple-900 shadow-sm' : 'text-slate-600 hover:text-purple-900'
              }`}
            >
              Account Level ({accountCount})
            </button>
            <button
              type="button"
              onClick={() => { setLevelFilter('Project'); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                levelFilter === 'Project' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-indigo-900'
              }`}
            >
              Project Level ({projectCount})
            </button>
          </div>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenCreate}
          >
            {activeTab === 'Risks' ? 'Add Risk' : 'Add Issue'}
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <FilterBar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder={`Search ${activeTab.toLowerCase()} by description, project, owner, status...`}
          className="flex-1 min-w-[240px]"
        />
      </FilterBar>

      {/* Table — Displaying all fields as separate columns */}
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Scope / Level</TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
              {activeTab === 'Risks' && <TableHeadCell align="center">RAG</TableHeadCell>}
              {activeTab === 'Risks' && <TableHeadCell>Classification</TableHeadCell>}
              <TableHeadCell align="center">Priority</TableHeadCell>
              <TableHeadCell align="center">Status</TableHeadCell>
              <TableHeadCell>Owner</TableHeadCell>
              <TableHeadCell>{activeTab === 'Risks' ? 'Risk Open Date' : 'Date Identified'}</TableHeadCell>
              <TableHeadCell>Target Resolution Date</TableHeadCell>
              <TableHeadCell>Impact</TableHeadCell>
              {activeTab === 'Risks' && <TableHeadCell>Likelihood</TableHeadCell>}
              {activeTab === 'Risks' && <TableHeadCell>Severity (Calculated)</TableHeadCell>}
              {activeTab === 'Risks' ? (
                <>
                  <TableHeadCell>Impact Description</TableHeadCell>
                  <TableHeadCell>Mitigation Plan</TableHeadCell>
                  <TableHeadCell>Contingency Plan</TableHeadCell>
                </>
              ) : (
                <>
                  <TableHeadCell>Resolution Plan</TableHeadCell>
                  <TableHeadCell>Remarks</TableHeadCell>
                </>
              )}
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={activeTab === 'Risks' ? 16 : 11} message={`Loading ${activeTab.toLowerCase()}...`} />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  colSpan={activeTab === 'Risks' ? 16 : 11}
                  message={search ? 'No items match your search.' : `No ${levelFilter !== 'ALL' ? levelFilter.toLowerCase() + ' level' : ''} ${activeTab.toLowerCase()} recorded.`}
                />
              ) : (
                paged.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    {/* Scope Badge */}
                    <TableCell>
                      {item.sourceType === 'Project' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <FolderGit2 className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate max-w-[140px]">Project: {item.projectName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>Account Level</span>
                        </span>
                      )}
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
                    <TableCell align="center" sticky="right">
                      <TableActions
                        entityLabel={`${item.riskType} "${item.description.slice(0, 20)}..."`}
                        onEdit={canCreate ? () => handleOpenEdit(item) : undefined}
                        onDelete={canCreate ? () => setDeleteTarget(item) : undefined}
                      />
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

      {/* Risk Form Modal */}
      {riskModalOpen && (
        <RiskFormModal
          isOpen={riskModalOpen}
          mode={modalMode}
          fixedAccountId={accountId}
          risk={targetItem}
          onClose={() => setRiskModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* Issue Form Modal */}
      {issueModalOpen && (
        <IssueFormModal
          isOpen={issueModalOpen}
          mode={modalMode}
          fixedAccountId={accountId}
          issue={targetItem}
          onClose={() => setIssueModalOpen(false)}
          onSuccess={loadData}
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
