/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import type { StakeholderConnect, ConnectStatus } from '@/types';
import { stakeholderConnectsApi, type ConnectFilter } from '@/api/crm.api';
import {
  BackButton,
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
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  CONNECT_STATUS_COLORS,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { showToast } from '@/components/common/ToastHost';
import { compareForSort, matchesGlobalAccount, SortDirection } from '@/utils';
import {
  CalendarCheck,
  Plus,
  Eye,
  Pencil,
  Trash2,
  CalendarClock,
  Ban,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { ConnectFormModal } from './ConnectFormModal';
import { ConnectDetailsModal } from './ConnectDetailsModal';
import { RescheduleModal } from './RescheduleModal';
import { CancelModal } from './CancelModal';

export const StakeholderConnectsView: React.FC = () => {
  const {
    accounts,
    stakeholders,
    serviceProviders,
    actionItems,
    currentUser,
    globalAccountId,
    cameFromDashboard,
    setView,
    can,
    refreshData,
    loading: crmLoading,
  } = useCRM();

  const [connects, setConnects] = useState<StakeholderConnect[]>([]);
  const [deactivatedConnects, setDeactivatedConnects] = useState<StakeholderConnect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>('meetingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Deactivated drawer / section
  const [showDeactivated, setShowDeactivated] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailsConnectId, setDetailsConnectId] = useState<string | null>(null);
  const [editConnect, setEditConnect] = useState<StakeholderConnect | null>(null);
  const [rescheduleConnect, setRescheduleConnect] = useState<StakeholderConnect | null>(null);
  const [cancelConnect, setCancelConnect] = useState<StakeholderConnect | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StakeholderConnect | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<StakeholderConnect | null>(null);

  const canCreate = can('stakeholder-connects', 'create');
  const canEdit = can('stakeholder-connects', 'update');
  const canDelete = can('stakeholder-connects', 'delete');

  const fetchConnects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: ConnectFilter = {};
      if (globalAccountId && globalAccountId !== 'All') {
        filter.accountId = globalAccountId;
      }
      const data = await stakeholderConnectsApi.getAll(filter);
      setConnects(data);

      if (canDelete) {
        const deactivated = await stakeholderConnectsApi.getDeactivated(
          globalAccountId && globalAccountId !== 'All' ? { accountId: globalAccountId } : undefined
        );
        setDeactivatedConnects(deactivated);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch Stakeholder Connects.');
    } finally {
      setLoading(false);
    }
  }, [globalAccountId, canDelete]);

  useEffect(() => {
    fetchConnects();
  }, [fetchConnects]);

  // Client-side filtering & sorting
  const filtered = useMemo(() => {
    return connects.filter((c) => {
      // Global Account filter
      if (!matchesGlobalAccount(c.accountId, globalAccountId)) return false;

      // Status filter
      if (selectedStatus !== 'All' && c.status !== selectedStatus) return false;

      // Date range filter
      if (fromDate && c.meetingDate < fromDate) return false;
      if (toDate && c.meetingDate > toDate) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesAccount = (c.accountName || '').toLowerCase().includes(q);
        const matchesOwner = (c.ownerName || '').toLowerCase().includes(q);
        const matchesMom = (c.mom || '').toLowerCase().includes(q);
        const matchesAttendee = (c.attendees || []).some(
          (a) =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q) ||
            (a.designation || '').toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesAccount && !matchesOwner && !matchesMom && !matchesAttendee) {
          return false;
        }
      }

      return true;
    });
  }, [connects, globalAccountId, selectedStatus, fromDate, toDate, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];
      if (sortField === 'meetingDate') {
        aVal = `${a.meetingDate} ${a.meetingTime || ''}`;
        bVal = `${b.meetingDate} ${b.meetingTime || ''}`;
      }
      return compareForSort(aVal, bVal, sortDirection);
    });
  }, [filtered, sortField, sortDirection]);

  // Paginated records
  const paginated = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sorted.slice(startIndex, startIndex + pageSize);
  }, [sorted, page, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await stakeholderConnectsApi.delete(deleteTarget.id);
      showToast({ kind: 'success', message: 'Stakeholder connect deleted successfully.' });
      setDeleteTarget(null);
      await fetchConnects();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete connect.');
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await stakeholderConnectsApi.restore(restoreTarget.id);
      showToast({ kind: 'success', message: 'Stakeholder connect restored successfully.' });
      setRestoreTarget(null);
      await fetchConnects();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to restore connect.');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = connects.length;
    const scheduled = connects.filter((c) => c.status === 'Scheduled').length;
    const completed = connects.filter((c) => c.status === 'Completed').length;
    const rescheduled = connects.filter((c) => c.status === 'Rescheduled').length;
    const cancelled = connects.filter((c) => c.status === 'Cancelled').length;
    return { total, scheduled, completed, rescheduled, cancelled };
  }, [connects]);

  if (crmLoading || (loading && connects.length === 0)) {
    return <LoadingState label="Loading Stakeholder Connects…" />;
  }

  return (
    <div className="space-y-6">
      {/* Back to Dashboard drill-down navigation */}
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Stakeholder Connects"
        subtitle="Manage client stakeholder meetings, record Minutes of Meeting (MoM), and track follow-ups."
        icon={<CalendarCheck className="w-5 h-5 text-blue-600" />}
        actions={
          canCreate ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Connect</span>
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Connects</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{metrics.total}</p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </Card>
        <Card className="p-3.5 flex items-center justify-between border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Scheduled</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">{metrics.scheduled}</p>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
        </Card>
        <Card className="p-3.5 flex items-center justify-between border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Completed</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{metrics.completed}</p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </Card>
        <Card className="p-3.5 flex items-center justify-between border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Rescheduled</p>
            <p className="text-xl font-bold text-purple-700 mt-0.5">{metrics.rescheduled}</p>
          </div>
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <CalendarClock className="w-4 h-4" />
          </div>
        </Card>
        <Card className="p-3.5 flex items-center justify-between border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Cancelled</p>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{metrics.cancelled}</p>
          </div>
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <Ban className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <FilterBar className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[260px] max-w-md">
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              setPage(1);
            }}
            placeholder="Search by title, account, host, attendee, MoM…"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Status"
            hideLabel
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setPage(1);
            }}
            options={[
              { value: 'All', label: 'All Statuses' },
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Completed', label: 'Completed' },
              { value: 'Rescheduled', label: 'Rescheduled' },
              { value: 'Cancelled', label: 'Cancelled' },
            ]}
          />

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-600 h-[38px] box-border">
            <span className="text-[10px] uppercase font-bold text-slate-400">Date:</span>
            <input
              type="date"
              className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer h-full"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              title="From Date"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer h-full"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              title="To Date"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                className="text-slate-400 hover:text-slate-600 ml-1 text-xs cursor-pointer"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </FilterBar>

      {/* Main Table Card */}
      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable storageKey="stakeholder-connects">
            <TableHead>
              <TableHeadCell columnId="meetingDate">
                <SortableHeader
                  label="Meeting Date & Time"
                  field="meetingDate"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHeadCell>
              <TableHeadCell columnId="title">
                <SortableHeader
                  label="Title / Agenda"
                  field="title"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHeadCell>
              <TableHeadCell columnId="accountName">
                <SortableHeader
                  label="Account"
                  field="accountName"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHeadCell>
              <TableHeadCell columnId="attendees">Attendees</TableHeadCell>
              <TableHeadCell columnId="ownerName">
                <SortableHeader
                  label="Meeting Host"
                  field="ownerName"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHeadCell>
              <TableHeadCell columnId="status">
                <SortableHeader
                  label="Status"
                  field="status"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHeadCell>
              <TableHeadCell columnId="followups">Follow-ups</TableHeadCell>
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>

            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <EmptyRow
                  colSpan={8}
                  message="No stakeholder connects match your search or filter criteria."
                />
              ) : (
                paginated.map((c) => {
                  const attendeeCount = c.attendees?.length || 0;
                  const draftCount = c.draftFollowUps?.length || 0;
                  const linkedCount = c.linkedActionItems?.length || 0;

                  return (
                    <TableRow
                      key={c.id}
                      onClick={() => setDetailsConnectId(c.id)}
                      className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <TableCell className="whitespace-nowrap font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{c.meetingDate}</span>
                          <span className="text-slate-400 text-xs">
                            {c.meetingTime?.slice(0, 5)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[260px]">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 truncate" title={c.title}>
                            {c.title}
                          </p>
                          {c.mom && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                              MoM: {c.mom}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-slate-700 font-medium">
                        {c.accountName || 'Unknown Account'}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-700 font-medium">
                            {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
                          </span>
                          {attendeeCount > 0 && c.attendees && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={c.attendees.map(a => a.name).join(', ')}>
                              ({c.attendees[0]?.name}{attendeeCount > 1 ? ` +${attendeeCount - 1}` : ''})
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-slate-700">
                        {c.ownerName || 'Unknown'}
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          value={c.status}
                          colorMap={CONNECT_STATUS_COLORS}
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          {draftCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded" title={`${draftCount} draft follow-ups`}>
                              {draftCount} draft
                            </span>
                          )}
                          {linkedCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded" title={`${linkedCount} linked action items`}>
                              {linkedCount} linked
                            </span>
                          )}
                          {draftCount === 0 && linkedCount === 0 && (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <RowActionButton
                            intent="view"
                            label="View connect details"
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setDetailsConnectId(c.id)}
                          />

                          {canEdit && (c.status === 'Scheduled' || c.status === 'Rescheduled') && (
                            <>
                              <RowActionButton
                                intent="edit"
                                label="Edit meeting"
                                icon={<Pencil className="w-3.5 h-3.5" />}
                                onClick={() => setEditConnect(c)}
                              />
                              <RowActionButton
                                intent="neutral"
                                label="Reschedule meeting"
                                icon={<CalendarClock className="w-3.5 h-3.5 text-purple-600" />}
                                onClick={() => setRescheduleConnect(c)}
                              />
                            </>
                          )}


                          {canDelete && (
                            <RowActionButton
                              intent="delete"
                              label="Delete connect"
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => setDeleteTarget(c)}
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

        {/* Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="meetings"
        />
      </Card>

      {/* Deactivated Section */}
      {canDelete && deactivatedConnects.length > 0 && (
        <DeactivatedSection
          count={deactivatedConnects.length}
          title="Deactivated Stakeholder Connects"
        >
          <Table>
            <TableHead>
              <TableHeadCell>Date & Time</TableHeadCell>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Account</TableHeadCell>
              <TableHeadCell>Host</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell align="center" sticky="right">Action</TableHeadCell>
            </TableHead>
            <tbody className="divide-y divide-slate-100">
              {deactivatedConnects.map((dc) => (
                <TableRow key={dc.id} className="opacity-75 bg-slate-50/50">
                  <TableCell className="font-mono text-xs">{dc.meetingDate} {dc.meetingTime?.slice(0, 5)}</TableCell>
                  <TableCell className="font-semibold text-slate-700">{dc.title}</TableCell>
                  <TableCell>{dc.accountName || 'Account'}</TableCell>
                  <TableCell>{dc.ownerName}</TableCell>
                  <TableCell>
                    <StatusBadge value={dc.status} colorMap={CONNECT_STATUS_COLORS} muted />
                  </TableCell>
                  <TableCell align="center" sticky="right" onClick={(e) => e.stopPropagation()}>
                    <RestoreButton
                      label="Restore connect"
                      onClick={() => setRestoreTarget(dc)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </DeactivatedSection>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <ConnectFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={async () => {
            await fetchConnects();
          }}
          accounts={accounts}
          stakeholders={stakeholders}
          serviceProviders={serviceProviders}
          currentUserId={currentUser}
          initialAccountId={globalAccountId !== 'All' ? globalAccountId : undefined}
        />
      )}

      {/* Edit Modal */}
      {editConnect && (
        <ConnectFormModal
          isOpen={!!editConnect}
          onClose={() => setEditConnect(null)}
          onSuccess={async () => {
            await fetchConnects();
          }}
          accounts={accounts}
          stakeholders={stakeholders}
          serviceProviders={serviceProviders}
          currentUserId={currentUser}
          editConnect={editConnect}
        />
      )}

      {/* Details Modal */}
      {detailsConnectId && (
        <ConnectDetailsModal
          isOpen={!!detailsConnectId}
          onClose={() => setDetailsConnectId(null)}
          connectId={detailsConnectId}
          accounts={accounts}
          stakeholders={stakeholders}
          serviceProviders={serviceProviders}
          actionItems={actionItems}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserId={currentUser}
          onConnectChanged={async () => {
            await fetchConnects();
            await refreshData();
          }}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleConnect && (
        <RescheduleModal
          isOpen={!!rescheduleConnect}
          onClose={() => setRescheduleConnect(null)}
          connect={rescheduleConnect}
          onSuccess={async () => {
            await fetchConnects();
          }}
        />
      )}

      {/* Cancel Modal */}
      {cancelConnect && (
        <CancelModal
          isOpen={!!cancelConnect}
          onClose={() => setCancelConnect(null)}
          connect={cancelConnect}
          onSuccess={async () => {
            await fetchConnects();
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Stakeholder Connect"
          message={`Are you sure you want to delete "${deleteTarget.title}"? The meeting will be soft-deleted and can be restored if necessary.`}
          confirmLabel="Delete Connect"
          tone="danger"
        />
      )}

      {/* Restore Dialog */}
      {restoreTarget && (
        <RestoreDialog
          isOpen={!!restoreTarget}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={handleRestore}
          title="Restore Stakeholder Connect"
          message={`Restore meeting "${restoreTarget.title}" back to active status? All attendees and relationships will be revalidated.`}
        />
      )}
    </div>
  );
};
