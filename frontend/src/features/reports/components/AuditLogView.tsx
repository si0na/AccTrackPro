/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { activitiesApi } from '@/api/crm.api';
import { LoadingState } from '@/components/common/LoadingState';
import { Activity } from '@/types';
import {
  ShieldCheck,
  Building2,
  TrendingUp,
  CheckSquare,
  Users,
  Settings,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  Card,
  EmptyRow,
  FilterBar,
  FilterChip,
  PageHeader,
  Pagination,
  SearchBar,
  SortableHeader,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';
import { compareForSort, SortDirection } from '@/utils';

/** Chunk size for incremental server fetches (the display page size is user-selectable). */
const SERVER_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const AuditLogView: React.FC = () => {
  const {
    accounts, opportunities,
    setView, setSelectedAccountId, setSelectedOpportunityId, setAccountDetailsActiveTab,
  } = useCRM();
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Column sort state — null means "keep the server's chronological order"
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };

  // Server-side pagination: the audit trail grows without bound, so the view
  // loads pages incrementally instead of pulling the whole table.
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [serverPage, setServerPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Display pagination (shared Pagination component) layered over the
  // incrementally-loaded rows; paging forward transparently loads more.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    activitiesApi.getPage(1, SERVER_PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setActivities(res.data);
        setTotal(res.total);
        setServerPage(1);
      })
      .catch(() => { /* view shows its empty state; reads fail quietly */ })
      .finally(() => { if (!cancelled) setInitialLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await activitiesApi.getPage(serverPage + 1, SERVER_PAGE_SIZE);
      setActivities((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...res.data.filter((a) => !seen.has(a.id))];
      });
      setTotal(res.total);
      setServerPage(res.page);
    } catch {
      // ignore — pagination stays on the current page for a retry
    } finally {
      setLoadingMore(false);
    }
  };

  // Reset to page 1 whenever a filter narrows/widens the result set, so the
  // user is never stranded on a now-empty page.
  useEffect(() => { setPage(1); }, [filterType, searchQuery]);

  // Navigate to the most specific view for this activity, tagged so the target
  // page renders a "Back to Audit Log" button.
  const handleActivityClick = (act: Activity) => {
    if (act.type === 'opportunity' && act.opportunityId && opportunities.some(o => o.id === act.opportunityId)) {
      setSelectedOpportunityId(act.opportunityId);
      setView('opportunity-details', { source: 'audit-log' });
    } else if (act.accountId && accounts.some(a => a.id === act.accountId)) {
      setSelectedAccountId(act.accountId);
      if (act.type === 'actionItem') {
        setAccountDetailsActiveTab('action-items');
      } else if (act.type === 'stakeholder') {
        setAccountDetailsActiveTab('stakeholders');
      }
      setView('account-details', { source: 'audit-log' });
    }
  };

  const filteredActivities = activities.filter(act => {
    // Type filtering
    const matchesType =
      filterType === 'All' ||
      (filterType === 'account' && act.type === 'account') ||
      (filterType === 'opportunity' && act.type === 'opportunity') ||
      (filterType === 'actionItem' && act.type === 'actionItem') ||
      (filterType === 'stakeholder' && act.type === 'stakeholder') ||
      (filterType === 'general' && act.type === 'general');

    // Search query filtering
    const matchesSearch =
      act.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.user.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  const sortedActivities = sortField
    ? [...filteredActivities].sort((a, b) => compareForSort((a as any)[sortField], (b as any)[sortField], sortDirection))
    : filteredActivities;

  const filtersActive = filterType !== 'All' || searchQuery.trim() !== '';

  // When no filter narrows the loaded set, pagination ranges over the full
  // server-side total (paging forward transparently loads more); once a
  // filter is active, pagination is bounded to what has been loaded so far.
  const paginationTotal = filtersActive ? sortedActivities.length : total;
  const totalPages = Math.max(1, Math.ceil(paginationTotal / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedActivities = sortedActivities.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = async (p: number) => {
    setPage(p);
    if (!filtersActive && p * pageSize > activities.length && activities.length < total && !loadingMore) {
      await handleLoadMore();
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'account':
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'opportunity':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case 'actionItem':
        return <CheckSquare className="w-4 h-4 text-indigo-600" />;
      case 'stakeholder':
        return <Users className="w-4 h-4 text-purple-600" />;
      default:
        return <Settings className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Audit Logs"
        subtitle="Chronological audit logs tracking modifications, workflow updates, stakeholder changes, and metadata customizations."
        accent="slate"
        icon={<ShieldCheck className="w-6 h-6 text-slate-900" aria-hidden="true" />}
      />

      {/* Filter and Search Bar */}
      <FilterBar className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" /> Filter Type:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'All', label: 'All Activities' },
              { id: 'account', label: 'Accounts' },
              { id: 'opportunity', label: 'Opportunities' },
              { id: 'actionItem', label: 'Action Items' },
              { id: 'stakeholder', label: 'Stakeholders' },
              { id: 'general', label: 'System / Others' }
            ].map(type => (
              <FilterChip
                key={type.id}
                label={type.label}
                active={filterType === type.id}
                onClick={() => setFilterType(type.id)}
              />
            ))}
          </div>
        </div>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search log details..."
          className="w-full md:w-64 shrink-0"
        />
      </FilterBar>

      {/* Logs Table */}
      <Card padding="none" clip>
        {initialLoading && <LoadingState label="Loading audit trail…" />}
        <div className={`overflow-x-auto ${initialLoading ? 'hidden' : ''}`}>
          <Table>
            <TableHead>
              <TableHeadCell className="w-16"><SortableHeader label="Event" field="type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Action Details" field="text" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell className="w-40"><SortableHeader label="Performed By" field="user" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell className="w-36"><SortableHeader label="Time Elapsed" field="timestamp" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell align="right" className="w-28">Action</TableHeadCell>
            </TableHead>
            <tbody>
              {sortedActivities.length === 0 ? (
                <EmptyRow colSpan={5} message="No matching audit activities found in system telemetry logs." />
              ) : (
                pagedActivities.map(act => {
                  const hasLink = (act.accountId && accounts.some(a => a.id === act.accountId)) ||
                                  (act.opportunityId && opportunities.some(o => o.id === act.opportunityId));
                  return (
                    <TableRow key={act.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          {getActivityIcon(act.type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 text-sm leading-snug">{act.text}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold tracking-wide">
                            <span className="uppercase">{act.type}</span>
                            {act.accountId && accounts.find(a => a.id === act.accountId) && (
                              <span className="bg-slate-100 text-slate-500 px-1 rounded">{accounts.find(a => a.id === act.accountId)?.name}</span>
                            )}
                            {act.opportunityId && opportunities.find(o => o.id === act.opportunityId) && (
                              <span className="bg-slate-100 text-slate-500 px-1 rounded">{opportunities.find(o => o.id === act.opportunityId)?.name}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 font-semibold">
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 select-none">
                            {act.user.charAt(0)}
                          </div>
                          <span>{act.user}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{act.timestamp}</span>
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        {hasLink ? (
                          <button
                            onClick={() => handleActivityClick(act)}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-extrabold cursor-pointer transition-all"
                          >
                            Investigate
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">System</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {!initialLoading && sortedActivities.length > 0 && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={paginationTotal}
            onPageChange={handlePageChange}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            itemLabel="log entries"
          />
        )}
      </Card>
    </div>
  );
};
