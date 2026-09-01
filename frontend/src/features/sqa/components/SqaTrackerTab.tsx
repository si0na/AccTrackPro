/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { SqaTrackerSnapshot } from '@/types';
import { sqaApi } from '@/api/crm.api';
import {
  History, Search, Calendar, Filter, LayoutGrid, Table as TableIcon,
  User, Building2, FolderKanban, AlertCircle, CheckCircle2, ShieldAlert
} from 'lucide-react';
import {
  Card,
  EmptyRow,
  FilterBar,
  HEALTH_COLORS,
  PRIORITY_COLORS,
  Pagination,
  SearchBar,
  SortableHeader,
  StatusBadge,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
} from '@/components/ui';
import { compareForSort, SortDirection } from '@/utils';
import { LoadingState } from '@/components/common/LoadingState';

export interface SqaTrackerTabProps {
  sqaRecordId?: string;
  storageKey?: string;
}

export const SqaTrackerTab: React.FC<SqaTrackerTabProps> = ({ sqaRecordId, storageKey = 'sqa-tracker' }) => {
  const [snapshots, setSnapshots] = useState<SqaTrackerSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<string>('week');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    let active = true;
    const fetchHistory = () => {
      sqaApi.getTrackerHistory(sqaRecordId)
        .then((data) => {
          if (!active) return;
          if (Array.isArray(data)) {
            setSnapshots(data);
          } else if (data && Array.isArray((data as any).items)) {
            setSnapshots((data as any).items);
          } else {
            setSnapshots([]);
          }
        })
        .catch(() => {
          if (active) setSnapshots([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    setLoading(true);
    fetchHistory();

    const handleUpdate = () => fetchHistory();
    window.addEventListener('sqa-updated', handleUpdate);

    return () => {
      active = false;
      window.removeEventListener('sqa-updated', handleUpdate);
    };
  }, [sqaRecordId]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return snapshots.filter((s) => {
      if (healthFilter !== 'All' && s.healthStatus !== healthFilter) return false;
      if (!q) return true;
      return (
        (s.projectName || '').toLowerCase().includes(q) ||
        (s.accountName || '').toLowerCase().includes(q) ||
        (s.pmName || '').toLowerCase().includes(q) ||
        (s.updatedByName || '').toLowerCase().includes(q) ||
        (s.currentWeekUpdate || '').toLowerCase().includes(q) ||
        (s.sqaRemarks || '').toLowerCase().includes(q) ||
        `week ${s.weekNumber}`.includes(q) ||
        `${s.isoYear}`.includes(q)
      );
    });
  }, [snapshots, searchQuery, healthFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];

      if (sortField === 'week') {
        valA = a.isoYear * 100 + a.weekNumber;
        valB = b.isoYear * 100 + b.weekNumber;
      }
      return compareForSort(valA, valB, sortDirection);
    });
  }, [filtered, sortField, sortDirection]);

  // Trend Updates (most recent 5 weeks, in chronological order)
  const trendSnapshots = useMemo(() => {
    return [...snapshots]
      .sort((a, b) => (a.isoYear * 100 + a.weekNumber) - (b.isoYear * 100 + b.weekNumber))
      .slice(-5);
  }, [snapshots]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) return <LoadingState label="Loading SQA tracker history…" />;

  return (
    <div className="space-y-6">
      {/* Top Header: Health Trend Trail + View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        <div>
          {trendSnapshots.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weekly Health Trend:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {trendSnapshots.map((h, i) => (
                  <React.Fragment key={h.id}>
                    <div className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm text-xs font-semibold">
                      <span className="text-slate-500 text-[11px]">W{h.weekNumber}</span>
                      {h.healthStatus ? (
                        <StatusBadge value={h.healthStatus} colorMap={HEALTH_COLORS} />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                    {i < trendSnapshots.length - 1 && <span className="text-slate-300 font-bold">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium">Historical weekly snapshots timeline</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-slate-500">View:</span>
          <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar>
        <SearchBar
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setPage(1); }}
          placeholder="Search SQA history by project, account, PM, week, remarks..."
          className="flex-1 min-w-[240px]"
        />

        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-500">Health:</label>
          <select
            value={healthFilter}
            onChange={(e) => { setHealthFilter(e.target.value); setPage(1); }}
            className="text-xs border border-slate-200 rounded-md py-1.5 px-2 bg-white text-slate-700 font-semibold cursor-pointer"
          >
            <option value="All">All Health</option>
            <option value="Green">Green</option>
            <option value="Amber">Amber</option>
            <option value="Red">Red</option>
          </select>
        </div>
      </FilterBar>

      {/* CARDS VIEW MODE */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {sorted.length === 0 ? (
            <Card>
              <div className="text-center py-10 text-slate-500">
                No historical SQA snapshots found matching your criteria.
              </div>
            </Card>
          ) : (
            paged.map((s) => (
              <Card key={s.id} className="overflow-hidden border border-slate-200/90 hover:border-slate-300 transition-all shadow-sm">
                {/* Snapshot Card Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg font-black text-xs tracking-tight">
                      Week {s.weekNumber} ({s.isoYear})
                    </div>
                    <div className="text-xs font-semibold text-slate-500 font-mono">
                      {s.snapshotDate}
                    </div>

                    {s.healthStatus && (
                      <StatusBadge value={s.healthStatus} colorMap={HEALTH_COLORS} />
                    )}

                    <StatusBadge value={s.importance} colorMap={PRIORITY_COLORS} />

                    {s.clientEscalation && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                        <ShieldAlert className="w-3 h-3 shrink-0" />
                        Client Escalation
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.wsrPublished ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      WSR: {s.wsrPublished ? 'Published' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-slate-500 font-medium">
                      Updated by <span className="font-bold text-slate-800">{s.updatedByName || 'System'}</span>
                    </div>
                    {s.projectName && (
                      <div className="flex items-center gap-1 text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-md">
                        <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.projectName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-100 text-xs mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Account</span>
                    <span className="font-bold text-slate-800 truncate block">{s.accountName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">PM</span>
                    <span className="font-bold text-slate-800 truncate block">{s.pmName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">FTE</span>
                    <span className="font-mono font-bold text-slate-900">
                      {s.fteOverride !== undefined ? (
                        <span title="FTE Override">{s.fteOverride} <span className="text-[9px] text-amber-600 font-bold">(Override)</span></span>
                      ) : (
                        s.fte !== undefined ? s.fte : '—'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Revenue</span>
                    <span className="font-mono font-bold text-slate-900">
                      {s.revenue !== undefined
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(s.revenue)
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Billing Model</span>
                    <span className="font-semibold text-slate-700 truncate block">{s.billingModelOverride || s.billingModel || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Tower</span>
                    <span className="font-semibold text-slate-700 truncate block">{s.towerOverride || s.tower || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Delivery Model</span>
                    <span className="font-semibold text-slate-700 truncate block">{s.deliveryModel || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">SDLC Phase</span>
                    <span className="font-semibold text-slate-700 truncate block">{s.currentSdlcPhase || '—'}</span>
                  </div>
                </div>

                {/* Narrative Text Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {s.currentWeekUpdate && (
                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wide">Update for Current Week</span>
                      <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{s.currentWeekUpdate}</p>
                    </div>
                  )}
                  {s.nextWeekPlan && (
                    <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wide">Plan for Next Week</span>
                      <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{s.nextWeekPlan}</p>
                    </div>
                  )}
                  {s.issuesChallenges && (
                    <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                      <span className="font-bold text-amber-800 block mb-1 text-[11px] uppercase tracking-wide">Issues / Challenges</span>
                      <p className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{s.issuesChallenges}</p>
                    </div>
                  )}
                  {s.pathToGreen && (
                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                      <span className="font-bold text-emerald-800 block mb-1 text-[11px] uppercase tracking-wide">Path to Green</span>
                      <p className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{s.pathToGreen}</p>
                    </div>
                  )}
                  {s.sqaRemarks && (
                    <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wide">SQA Remarks</span>
                      <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{s.sqaRemarks}</p>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}

          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={sorted.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            itemLabel="snapshot entries"
          />
        </div>
      ) : (
        /* TABLE VIEW MODE */
        <Card padding="none" clip>
          <div className="overflow-x-auto">
            <Table resizable={!!storageKey} storageKey={storageKey}>
              <TableHead>
                <TableHeadCell>
                  <SortableHeader label="Week / Date" field="week" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader label="Account" field="accountName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader label="Project" field="projectName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
                <TableHeadCell align="center">
                  <SortableHeader label="Health" field="healthStatus" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader label="Importance" field="importance" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                </TableHeadCell>
                <TableHeadCell>Delivery Model</TableHeadCell>
                <TableHeadCell>Billing Model</TableHeadCell>
                <TableHeadCell>Tower</TableHeadCell>
                <TableHeadCell align="right">
                  <SortableHeader label="FTE" field="fte" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-end w-full" />
                </TableHeadCell>
                <TableHeadCell align="right">
                  <SortableHeader label="Revenue" field="revenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-end w-full" />
                </TableHeadCell>
                <TableHeadCell>PM</TableHeadCell>
                <TableHeadCell align="center">WSR Published</TableHeadCell>
                <TableHeadCell align="center">Escalation</TableHeadCell>
                <TableHeadCell>Current Week Update</TableHeadCell>
                <TableHeadCell>Updated By</TableHeadCell>
              </TableHead>
              <tbody>
                {sorted.length === 0 ? (
                  <EmptyRow colSpan={15} message="No historical SQA snapshots found." />
                ) : (
                  paged.map((s) => (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-800 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-blue-700">Week {s.weekNumber} ({s.isoYear})</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.snapshotDate}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-700">{s.accountName || '—'}</TableCell>
                      <TableCell className="font-bold text-slate-900">{s.projectName || '—'}</TableCell>
                      <TableCell align="center">
                        {s.healthStatus ? (
                          <StatusBadge value={s.healthStatus} colorMap={HEALTH_COLORS} />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">{s.importance}</TableCell>
                      <TableCell className="text-slate-600">{s.deliveryModel || '—'}</TableCell>
                      <TableCell className="text-slate-600">
                        {s.billingModelOverride ? (
                          <span title="Override">{s.billingModelOverride} <span className="text-[10px] text-amber-600 font-bold">(Override)</span></span>
                        ) : (
                          s.billingModel || '—'
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {s.towerOverride ? (
                          <span title="Override">{s.towerOverride} <span className="text-[10px] text-amber-600 font-bold">(Override)</span></span>
                        ) : (
                          s.tower || '—'
                        )}
                      </TableCell>
                      <TableCell align="right" className="font-mono text-slate-800 font-semibold">
                        {s.fteOverride !== undefined ? (
                          <span title="FTE Override">{s.fteOverride} <span className="text-[10px] text-amber-600 font-bold">(Override)</span></span>
                        ) : (
                          s.fte !== undefined ? s.fte : '—'
                        )}
                      </TableCell>
                      <TableCell align="right" className="font-mono text-slate-900 font-bold">
                        {s.revenue !== undefined
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(s.revenue)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-slate-700 font-medium">{s.pmName || '—'}</TableCell>
                      <TableCell align="center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.wsrPublished ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.wsrPublished ? 'Yes' : 'No'}
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.clientEscalation ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.clientEscalation ? 'Yes' : 'No'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs max-w-[220px] truncate" title={s.currentWeekUpdate}>
                        {s.currentWeekUpdate || '—'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs font-medium">
                        {s.updatedByName || 'System'}
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
            totalItems={sorted.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            itemLabel="snapshot entries"
          />
        </Card>
      )}
    </div>
  );
};
