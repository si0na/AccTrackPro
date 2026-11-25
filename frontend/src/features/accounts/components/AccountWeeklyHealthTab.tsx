import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { accountWeeklyHealthApi } from '@/api/crm.api';
import { AccountWeeklyHealth, AccountHealth, Account } from '@/types';
import { WeeklyHealthFormModal, WeeklyHealthFormData } from './WeeklyHealthFormModal';
import {
  Card,
  SummaryCard,
  Button,
  StatusBadge,
  ConfirmDialog,
  EmptyState,
  SearchBar,
  HEALTH_COLORS,
} from '@/components/ui';
import {
  HeartPulse,
  Calendar,
  User,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  ShieldAlert,
  ListChecks,
} from 'lucide-react';
import { showToast } from '@/components/common/ToastHost';

export interface AccountWeeklyHealthTabProps {
  accountId: string;
  account?: Account;
}

export function formatDateLabel(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return isoDate;
  } catch {
    return isoDate;
  }
}

export const AccountWeeklyHealthTab: React.FC<AccountWeeklyHealthTabProps> = ({
  accountId,
  account,
}) => {
  const { can } = useCRM();

  const [updates, setUpdates] = useState<AccountWeeklyHealth[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountHealth>('ALL');

  // Expanded items state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountWeeklyHealth | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<AccountWeeklyHealth | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = can('accounts', 'update');

  const fetchWeeklyHealth = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await accountWeeklyHealthApi.getAll(accountId);
      setUpdates(data);
      // Automatically expand the latest update if available
      if (data.length > 0) {
        setExpandedIds(new Set([data[0].id]));
      }
    } catch (err: any) {
      console.error('Failed to load weekly health updates:', err);
      setErrorMsg(err?.message || 'Failed to load weekly health updates.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchWeeklyHealth();
  }, [fetchWeeklyHealth]);

  // Derived KPI metrics
  const metrics = useMemo(() => {
    const total = updates.length;
    const green = updates.filter((u) => u.healthStatus === 'Green').length;
    const amber = updates.filter((u) => u.healthStatus === 'Amber').length;
    const red = updates.filter((u) => u.healthStatus === 'Red').length;
    const latest = updates[0] || null;

    return { total, green, amber, red, latest };
  }, [updates]);

  // Filtered & searched updates (already sorted descending by reporting_date from backend)
  const filteredUpdates = useMemo(() => {
    return updates.filter((u) => {
      if (statusFilter !== 'ALL' && u.healthStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inDate = u.reportingDate?.toLowerCase().includes(q);
        const inSummary = u.summary?.toLowerCase().includes(q);
        const inUpdates = u.keyUpdates?.toLowerCase().includes(q);
        const inRisks = u.risksAndIssues?.toLowerCase().includes(q);
        const inMitigation = u.actionItemsMitigation?.toLowerCase().includes(q);
        const inOwner = u.owner?.toLowerCase().includes(q);
        const inNext = u.nextSteps?.toLowerCase().includes(q);
        if (!inDate && !inSummary && !inUpdates && !inRisks && !inMitigation && !inOwner && !inNext) {
          return false;
        }
      }
      return true;
    });
  }, [updates, statusFilter, searchQuery]);

  const existingDates = useMemo(() => {
    return updates.map((u) => u.reportingDate);
  }, [updates]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(filteredUpdates.map((u) => u.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (item: AccountWeeklyHealth) => {
    setEditingItem(item);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (formData: WeeklyHealthFormData) => {
    if (editingItem) {
      await accountWeeklyHealthApi.update(accountId, editingItem.id, formData);
      showToast({ kind: 'success', message: 'Weekly health update modified successfully' });
    } else {
      await accountWeeklyHealthApi.create(accountId, formData);
      showToast({ kind: 'success', message: 'Weekly health update recorded successfully' });
    }
    await fetchWeeklyHealth();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await accountWeeklyHealthApi.delete(accountId, deleteTarget.id);
      showToast({ kind: 'success', message: 'Weekly health update deleted' });
      setDeleteTarget(null);
      await fetchWeeklyHealth();
    } catch (err: any) {
      showToast({ kind: 'error', message: err?.message || 'Failed to delete update' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Latest Health Assessment"
          value={metrics.latest ? metrics.latest.healthStatus : 'None'}
          description={metrics.latest ? `Week of ${formatDateLabel(metrics.latest.reportingDate)}` : 'No weekly updates yet'}
          icon={<HeartPulse className="w-5 h-5" />}
          tone={
            metrics.latest?.healthStatus === 'Green'
              ? 'emerald'
              : metrics.latest?.healthStatus === 'Amber'
              ? 'amber'
              : 'slate'
          }
          urgent={metrics.latest?.healthStatus === 'Red'}
        />

        <SummaryCard
          label="Total Weekly Updates"
          value={metrics.total}
          description="Chronological historical record"
          icon={<Calendar className="w-5 h-5" />}
          tone="blue"
        />

        <SummaryCard
          label="Green Health Weeks"
          value={metrics.green}
          description={metrics.total > 0 ? `${Math.round((metrics.green / metrics.total) * 100)}% of tracked weeks` : 'No updates recorded'}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="emerald"
        />

        <SummaryCard
          label="Attention Required"
          value={metrics.amber + metrics.red}
          description={`${metrics.amber} Amber · ${metrics.red} Red`}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={metrics.amber + metrics.red > 0 ? 'amber' : 'slate'}
          urgent={metrics.red > 0}
        />
      </div>

      {/* Main Container Card */}
      <Card className="p-6">
        {/* Header & Action Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Weekly Health History</h3>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                {filteredUpdates.length} {filteredUpdates.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Historical timeline of weekly health checks, risks, mitigation actions, and forward-looking plans.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {filteredUpdates.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500 mr-2">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                >
                  Expand all
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                >
                  Collapse all
                </button>
              </div>
            )}

            {canEdit && (
              <Button onClick={handleOpenAdd} className="shrink-0">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Weekly Update
              </Button>
            )}
          </div>
        </div>

        {/* Filter and Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 pb-2">
          <div className="w-full sm:w-72">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search updates, risks, owners..."
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Filter Health:</span>
            <div className="flex items-center gap-1">
              {(['ALL', 'Green', 'Amber', 'Red'] as const).map((status) => {
                const isSelected = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                      isSelected
                        ? status === 'Green'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : status === 'Amber'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : status === 'Red'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-800 text-white border-slate-800 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button size="sm" variant="secondary" onClick={fetchWeeklyHealth}>
              Retry
            </Button>
          </div>
        )}

        {/* Timeline Content */}
        <div className="mt-6">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 mt-3 font-medium">Loading weekly health updates...</p>
            </div>
          ) : filteredUpdates.length === 0 ? (
            <div className="flex flex-col items-center">
              <EmptyState
                icon={<HeartPulse className="w-6 h-6 text-slate-400" />}
                title={
                  updates.length === 0
                    ? 'No Weekly Health Updates'
                    : 'No Updates Match Your Filter'
                }
                hint={
                  updates.length === 0
                    ? 'Start maintaining account health trends by recording the first weekly health update.'
                    : 'Try adjusting your search keywords or health status filter.'
                }
              />
              {updates.length === 0 && canEdit && (
                <Button onClick={handleOpenAdd} className="mt-1">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Record First Weekly Update
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUpdates.map((item, index) => {
                const isExpanded = expandedIds.has(item.id);
                const isLatest = index === 0;

                const statusBg = {
                  Green: 'border-l-emerald-500',
                  Amber: 'border-l-amber-500',
                  Red: 'border-l-rose-500',
                }[item.healthStatus] || 'border-l-slate-400';

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border border-slate-200 bg-white transition-all shadow-xs hover:border-slate-300 border-l-4 ${statusBg}`}
                  >
                    {/* Header Row (Always Visible) */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-start md:items-center gap-3">
                        <button
                          type="button"
                          className="mt-0.5 md:mt-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              Week of {formatDateLabel(item.reportingDate)}
                            </span>

                            <StatusBadge
                              value={item.healthStatus}
                              colorMap={HEALTH_COLORS}
                              className="text-[11px] font-semibold uppercase tracking-wider"
                            />

                            {isLatest && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                                Latest
                              </span>
                            )}
                          </div>

                          {/* Quick Summary Line */}
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1 max-w-2xl font-normal">
                            {item.summary}
                          </p>
                        </div>
                      </div>

                      {/* Right Meta & Actions */}
                      <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                        {item.owner && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium">{item.owner}</span>
                          </div>
                        )}

                        {canEdit && (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit update"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete update"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expandable Details Body */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4 text-xs animate-in fade-in duration-150">
                        {/* Health Summary Box */}
                        <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span>Health Summary</span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-line leading-relaxed font-normal">
                            {item.summary}
                          </p>
                        </div>

                        {/* Two Column Grid: Key Updates & Next Steps */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Key Updates */}
                          <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Key Updates & Milestones</span>
                            </div>
                            {item.keyUpdates ? (
                              <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                                {item.keyUpdates}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic">No key updates recorded for this week.</p>
                            )}
                          </div>

                          {/* Next Steps */}
                          <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1.5">
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Next Steps & Planned Activities</span>
                            </div>
                            {item.nextSteps ? (
                              <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                                {item.nextSteps}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic">No next steps defined.</p>
                            )}
                          </div>
                        </div>

                        {/* Two Column Grid: Risks & Mitigation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Risks / Issues */}
                          <div className="p-3.5 rounded-lg bg-rose-50/50 border border-rose-200/80">
                            <div className="flex items-center gap-1.5 font-bold text-rose-800 mb-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Risks & Issues</span>
                            </div>
                            {item.risksAndIssues ? (
                              <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                                {item.risksAndIssues}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic">No active risks or blockers reported.</p>
                            )}
                          </div>

                          {/* Action Items / Mitigation */}
                          <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1.5">
                              <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Action Items & Mitigation</span>
                            </div>
                            {item.actionItemsMitigation ? (
                              <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                                {item.actionItemsMitigation}
                              </p>
                            ) : (
                              <p className="text-slate-400 italic">No mitigation actions specified.</p>
                            )}
                          </div>
                        </div>

                        {/* Audit Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                          <div>
                            {item.createdByName && (
                              <span>Recorded by <span className="font-medium text-slate-600">{item.createdByName}</span></span>
                            )}
                            {item.createdAt && (
                              <span> on {new Date(item.createdAt).toLocaleString()}</span>
                            )}
                          </div>
                          {item.updatedByName && item.updatedAt && item.updatedAt !== item.createdAt && (
                            <div>
                              <span>Last updated by <span className="font-medium text-slate-600">{item.updatedByName}</span> ({new Date(item.updatedAt).toLocaleDateString()})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Add / Edit Modal */}
      {isFormModalOpen && (
        <WeeklyHealthFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingItem(null);
          }}
          onSubmit={handleFormSubmit}
          initialData={editingItem}
          accountName={account?.name}
          existingDates={existingDates}
          defaultOwner={account?.owner}
          defaultOwnerId={account?.ownerId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Delete Weekly Health Update"
          message={`Are you sure you want to delete the health update for week of ${formatDateLabel(deleteTarget.reportingDate)}? This action cannot be undone.`}
          confirmLabel={isDeleting ? 'Deleting...' : 'Delete Update'}
          tone="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
