/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { OPPORTUNITY_STAGE_STYLE } from '@/constants';
import { deriveOppStatus, isDueThisWeek, isOpenActionItemStatus } from '@/utils';
import {
  Building2,
  Briefcase,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
  CheckCircle2,
  Activity,
  Users,
  Radio,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  SummaryCard,
  Table,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
  StatusBadge,
  PRIORITY_COLORS,
  ACTION_STATUS_COLORS,
  EmptyState,
  Button,
  Pagination,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
} from '@/components/ui';

// Every valid `stage` value, shown as its own bar in the pipeline below.
const STAGE_ORDER = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Lost'] as const;

// Per-stage descriptions for the pipeline rows. Colours come from the shared
// OPPORTUNITY_STAGE_STYLE token so the Dashboard and Reports pipelines stay in
// lockstep (icon avatar + bar fill identical for the same stage everywhere).
const STAGE_DESCRIPTION: Record<(typeof STAGE_ORDER)[number], string> = {
  Lead:               'New inquiries',
  Qualified:          'Qualified leads',
  Proposal:           'Proposal presented',
  Negotiation:        'Under negotiation',
  'Verbal Agreement': 'Verbally agreed',
  Won:                'Successfully closed',
  Blocked:            'Currently blocked',
  Delayed:            'Delayed opportunities',
  Lost:               'Unsuccessful',
};

// Every bar gets a floor width so a small-but-nonzero count still renders a
// visible sliver. A 0-count stage renders no fill at all (see `pct` below).
const MIN_BAR_PCT = 8;

// Action Items Due This Week table page size — sized so a full page keeps the
// card height in step with the Recent Activity card beside it.
const ACTION_ITEMS_PAGE_SIZE = 4;

const ActivityIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'account': return <Building2 className="w-3.5 h-3.5" />;
    case 'opportunity': return <Briefcase className="w-3.5 h-3.5" />;
    case 'actionItem': return <CheckSquare className="w-3.5 h-3.5" />;
    case 'stakeholder': return <Users className="w-3.5 h-3.5" />;
    default: return <Radio className="w-3.5 h-3.5" />;
  }
};

// Clock-style timestamp (e.g. "09:15 AM") shown beside each activity entry.
function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Groups the timeline into Today / Yesterday / calendar-date headers.
function activityDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const DashboardView: React.FC = () => {
  const {
    accounts,
    opportunities,
    actionItems,
    activities,
    setView,
    setSelectedAccountId,
    setSelectedStage,
    setDashboardStageHighlight,
    setDueThisWeekFilter,
    setDashboardOppStatusFilter,
    setOpenActionItemsFilter,
    setOverdueActionItemsFilter,
    setSelectedHealth,
    currentUserProfile,
    refreshData,
    loading,
  } = useCRM();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [actionItemsPage, setActionItemsPage] = useState(1);

  // Drives the pipeline bars' width transition from 0 → target on mount.
  const [barsAnimated, setBarsAnimated] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBarsAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
      setLastUpdated(new Date());
    }
  };

  // ── Operational metrics — always live, never fiscal-period-filtered ─────────
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  const totalAccountsVal = accounts.length;
  const myOpenOpps = opportunities.filter(o => deriveOppStatus(o.stage) === 'Open');
  const myOpenTasks = actionItems.filter(ai => isOpenActionItemStatus(ai.status));
  const overdueTasks = myOpenTasks.filter(
    ai => ai.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(ai.dueDate) && ai.dueDate < todayStr,
  );
  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  // Per-stage counts/values across every stage, including Lost.
  const stageCounts = STAGE_ORDER.map(stage => opportunities.filter(o => o.stage === stage).length);
  const stageValues = STAGE_ORDER.map(stage => opportunities.filter(o => o.stage === stage).reduce((sum, o) => sum + o.value, 0));
  const maxStageCount = Math.max(1, ...stageCounts);

  const funnelStages = STAGE_ORDER.map((stage, i) => ({
    key: stage,
    label: stage,
    description: STAGE_DESCRIPTION[stage],
    count: stageCounts[i],
    value: stageValues[i],
    // 0 opportunities → 0% width (no fill). Otherwise proportional, with a
    // floor so a small-but-nonzero bar stays visible.
    pct: stageCounts[i] === 0 ? 0 : Math.min(100, Math.max(MIN_BAR_PCT, (stageCounts[i] / maxStageCount) * 100)),
    fill: OPPORTUNITY_STAGE_STYLE[stage].bar,
    iconBg: OPPORTUNITY_STAGE_STYLE[stage].iconBg,
    iconText: OPPORTUNITY_STAGE_STYLE[stage].iconText,
    onClick: () => {
      setSelectedStage(stage);
      setDashboardStageHighlight(stage);
      setView('opportunities', { fromDashboard: true });
    },
  }));

  // Pipeline summary metrics (bottom strip). Forecast Value follows the same
  // model as the Revenue Forecast report: probability-weighted value of every
  // non-Lost opportunity.
  const totalPipelineValue = opportunities.reduce((sum, o) => sum + o.value, 0);
  const wonCount = opportunities.filter(o => o.stage === 'Won').length;
  const conversionRate = opportunities.length > 0 ? Math.round((wonCount / opportunities.length) * 100) : 0;
  const forecastValue = opportunities
    .filter(o => o.stage !== 'Lost')
    .reduce((sum, o) => sum + o.value * (o.probability / 100), 0);

  // Account Health distribution.
  const C = 502.7; // 2 * π * 80 (SVG circle radius = 80)
  const healthTotal   = accounts.length;
  const greenCount = accounts.filter(a => a.health === 'Green').length;
  const amberCount = accounts.filter(a => a.health === 'Amber').length;
  const redCount   = accounts.filter(a => a.health === 'Red').length;
  const greenPct = healthTotal > 0 ? greenCount / healthTotal : 0;
  const amberPct = healthTotal > 0 ? amberCount / healthTotal : 0;
  const redPct   = healthTotal > 0 ? redCount   / healthTotal : 0;
  const greenPctRounded = Math.round(greenPct * 100);
  const healthMessage = healthTotal === 0
    ? 'No account health data available yet.'
    : redCount > 0
    ? `Focus on ${redCount} red account${redCount === 1 ? '' : 's'} to improve overall health.`
    : amberCount > 0
    ? `Monitor ${amberCount} amber account${amberCount === 1 ? '' : 's'} to prevent decline.`
    : 'All accounts are currently green — great work maintaining strong relationships.';

  // Open action items due in the current calendar week (same rule as the
  // Action Items drill-down filter).
  const dueThisWeekItems = actionItems.filter(
    ai => isOpenActionItemStatus(ai.status) && isDueThisWeek(ai.dueDate),
  );
  const actionItemsTotalPages = Math.max(1, Math.ceil(dueThisWeekItems.length / ACTION_ITEMS_PAGE_SIZE));
  const actionItemsPageClamped = Math.min(actionItemsPage, actionItemsTotalPages);
  const pagedActionItems = dueThisWeekItems.slice(
    (actionItemsPageClamped - 1) * ACTION_ITEMS_PAGE_SIZE,
    actionItemsPageClamped * ACTION_ITEMS_PAGE_SIZE,
  );

  // Timeline grouping (Today / Yesterday / date headers). A fixed set of
  // recent activities fits the card without an internal scrollbar.
  const activityRows = activities.slice(0, 5).map(actv => ({ actv, group: activityDayLabel(actv.timestamp) }));

  const headerActions = (
    <>
      <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
        Updated{' '}
        <span className="text-slate-600 font-semibold">
          {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </span>
      <Button
        variant="secondary"
        size="xs"
        onClick={handleRefresh}
        disabled={refreshing}
        icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
      >
        Refresh
      </Button>
    </>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard Overview"
          subtitle="Loading your workspace…"
          actions={headerActions}
        />
        <CardSkeleton cards={4} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <TableSkeleton rows={4} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col items-center space-y-4">
              <Skeleton className="h-3 w-28 self-start" />
              <Skeleton className="h-36 w-36 rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
            <TableSkeleton rows={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        subtitle={`Welcome back, ${currentUserProfile.name}. Here is the latest on your enterprise account pipeline.`}
        actions={headerActions}
      />

      {/* Operational Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <SummaryCard
          label="Total Accounts"
          value={totalAccountsVal}
          icon={<Building2 className="w-5 h-5" />}
          tone="blue"
          actionLabel="View all accounts"
          onAction={() => setView('accounts', { fromDashboard: true })}
        />
        <SummaryCard
          label="My Open Opportunities"
          value={myOpenOpps.length}
          icon={<Briefcase className="w-5 h-5" />}
          tone="indigo"
          actionLabel="View opportunities"
          onAction={() => { setDashboardOppStatusFilter('Open'); setView('opportunities', { fromDashboard: true }); }}
        />
        <SummaryCard
          label="My Action Items"
          value={myOpenTasks.length}
          icon={<CheckSquare className="w-5 h-5" />}
          tone="emerald"
          actionLabel="View action items"
          onAction={() => { setOpenActionItemsFilter(true); setView('actionItems', { fromDashboard: true }); }}
        />
        <SummaryCard
          label="Overdue Tasks"
          value={<span className={overdueTasks.length > 0 ? 'text-red-600' : ''}>{overdueTasks.length}</span>}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone="amber"
          urgent={overdueTasks.length > 0}
          actionLabel="View overdue tasks"
          onAction={() => { setOverdueActionItemsFilter(true); setView('actionItems', { fromDashboard: true }); }}
        />
      </div>

      {/* Main Grid — wide left column (Pipeline + Action Items), narrow right
          column (Account Health + Recent Activity), mirroring the reference. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* ── Left Column ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Opportunity Pipeline — one row per stage, table-style */}
          <Card
            title="Opportunity Pipeline"
            subtitle="Track your opportunities across every stage of the sales process."
            className="flex-1 flex flex-col"
            bodyClassName="flex-1 flex flex-col min-h-0"
          >
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[36px_1fr_1.4fr_110px_16px] items-center gap-4 px-2 pb-2 mb-1 border-b border-slate-100">
              <span aria-hidden="true" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stage</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opportunities</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Pipeline Value</span>
              <span aria-hidden="true" />
            </div>

            {/* Stage rows — bar width proportional to opportunity count. A
                0-count stage renders no colored fill, just the empty track. */}
            <div className="flex-1 flex flex-col">
              {funnelStages.map((stage, i) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={stage.onClick}
                  className="group w-full grid grid-cols-[36px_1fr_1.4fr_110px_16px] items-center gap-4 rounded-lg px-2 py-2.5 cursor-pointer text-left transition-colors duration-150 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${stage.iconBg} ${stage.iconText}`}>
                    <Users className="w-4 h-4" />
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{stage.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{stage.description}</p>
                  </div>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      {stage.pct > 0 && (
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all ease-out duration-700 group-hover:brightness-110 ${stage.fill}`}
                          style={{
                            width: barsAnimated ? `${stage.pct}%` : '0%',
                            transitionDelay: barsAnimated ? `${i * 70}ms` : '0ms',
                          }}
                        />
                      )}
                    </div>
                    <span className="w-5 shrink-0 text-right text-xs font-bold text-slate-600 font-mono tabular-nums">
                      {stage.count}
                    </span>
                  </div>

                  <span className="text-right text-sm font-bold text-slate-700 font-mono tabular-nums">
                    {formatCurrency(stage.value)}
                  </span>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 justify-self-end" />
                </button>
              ))}
            </div>

            {/* Summary footer — three even metrics along the bottom of the card,
                separated by subtle vertical dividers, aligned to the pipeline width. */}
            <div className="mt-3 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-y-4 sm:gap-y-0 sm:divide-x sm:divide-slate-100">
              {[
                { label: 'Total Pipeline Value', value: formatCurrency(totalPipelineValue), icon: <Building2 className="w-4 h-4" />, chip: 'bg-blue-100 text-blue-600' },
                { label: 'Conversion Rate', value: `${conversionRate}%`, icon: <CheckCircle2 className="w-4 h-4" />, chip: 'bg-emerald-100 text-emerald-600' },
                { label: 'Forecast Value', value: formatCurrency(forecastValue), icon: <Activity className="w-4 h-4" />, chip: 'bg-indigo-100 text-indigo-600' },
              ].map(metric => (
                <div key={metric.label} className="flex items-center gap-3 min-w-0 px-2 sm:px-4 sm:first:pl-2 sm:last:pr-2">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${metric.chip}`}>
                    {metric.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{metric.label}</p>
                    <p className="text-lg font-extrabold text-slate-900 tracking-tight font-mono tabular-nums truncate">{metric.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Action Items Due This Week */}
          <Card
            title={
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <h3 className="text-section-title font-semibold text-slate-800 tracking-tight">Action Items Due This Week</h3>
              </div>
            }
            padding="none"
            clip
            actions={
              <button
                onClick={() => {
                  setDueThisWeekFilter(true);
                  setView('actionItems', { fromDashboard: true });
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded"
              >
                View all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            }
          >
            {dueThisWeekItems.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CheckSquare className="w-6 h-6 text-slate-400" />}
                  title="All caught up"
                  hint="No open action items are due this week."
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableHeadCell>Title</TableHeadCell>
                      <TableHeadCell>Account</TableHeadCell>
                      <TableHeadCell>Owner</TableHeadCell>
                      <TableHeadCell>Due Date</TableHeadCell>
                      <TableHeadCell align="center">Priority</TableHeadCell>
                      <TableHeadCell align="center">Status</TableHeadCell>
                    </TableHead>
                    <tbody>
                      {pagedActionItems.map(item => {
                        const isOverdue = item.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.dueDate < todayStr;
                        const accountName = accounts.find(a => a.id === item.accountId)?.name || 'Account';
                        return (
                          <TableRow key={item.id} className={isOverdue ? 'bg-red-50/40' : ''}>
                            <TableCell>
                              <p className="font-semibold text-slate-700 truncate max-w-[160px]">{item.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">{accountName}</p>
                            </TableCell>
                            <TableCell className="text-slate-600 font-medium">
                              <span className="truncate block max-w-[120px]">{accountName}</span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {(item.owner || '?').charAt(0).toUpperCase()}
                                </span>
                                <span className="text-slate-600 font-medium truncate max-w-[130px]">{item.owner}</span>
                              </span>
                            </TableCell>
                            <TableCell className={`font-mono whitespace-nowrap ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                              {item.dueDate}
                            </TableCell>
                            <TableCell align="center">
                              <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="pill" />
                            </TableCell>
                            <TableCell align="center">
                              <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="pill" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
                <Pagination
                  page={actionItemsPageClamped}
                  pageSize={ACTION_ITEMS_PAGE_SIZE}
                  totalItems={dueThisWeekItems.length}
                  onPageChange={setActionItemsPage}
                  itemLabel="action items"
                />
              </>
            )}
          </Card>
        </div>

        {/* ── Right Column ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Account Health — doughnut left, per-status cards right, insight
              banner along the bottom. */}
          <Card
            title="Account Health"
            actions={
              <button
                type="button"
                onClick={() => setView('reports', { fromDashboard: true })}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded"
              >
                View full report <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
            bodyClassName="flex flex-col"
          >
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-5 py-2">
              {/* SVG Radial Circle Graph — driven by live account data */}
              <div className="relative shrink-0">
                <svg viewBox="0 0 192 192" className="w-40 h-40 transform -rotate-90">
                  <circle cx="96" cy="96" r="80" stroke="#f1f5f9" strokeWidth="17" fill="none" />
                  {/* Green arc */}
                  <circle cx="96" cy="96" r="80" stroke="#10b981" strokeWidth="17" fill="none" strokeLinecap="round"
                          strokeDasharray={C} strokeDashoffset={C * (1 - greenPct)} />
                  {/* Amber arc — starts where Green ends */}
                  <circle cx="96" cy="96" r="80" stroke="#f97316" strokeWidth="17" fill="none" strokeLinecap="round"
                          strokeDasharray={C} strokeDashoffset={C * (1 - amberPct)}
                          transform={`rotate(${greenPct * 360} 96 96)`} />
                  {/* Red arc — starts where Amber ends */}
                  <circle cx="96" cy="96" r="80" stroke="#ef4444" strokeWidth="17" fill="none" strokeLinecap="round"
                          strokeDasharray={C} strokeDashoffset={C * (1 - redPct)}
                          transform={`rotate(${(greenPct + amberPct) * 360} 96 96)`} />
                </svg>
                {/* Center Text — leads with the Green share rather than a bare total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{greenPctRounded}%</span>
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mt-0.5">Green</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{healthTotal} accounts total</span>
                </div>
              </div>

              {/* Per-status summary cards — stacked beside the chart. Same
                  drill-down behavior as before. */}
              <div className="flex-1 w-full space-y-2.5">
                {([
                  { health: 'Green' as const, label: 'Green', count: greenCount, pct: greenPct, dot: 'bg-emerald-500', text: 'text-emerald-700', card: 'bg-gradient-to-r from-emerald-50/80 to-white border-emerald-200/70' },
                  { health: 'Amber' as const, label: 'Amber', count: amberCount, pct: amberPct, dot: 'bg-orange-500', text: 'text-orange-700', card: 'bg-gradient-to-r from-orange-50/80 to-white border-orange-200/70' },
                  { health: 'Red' as const, label: 'Red', count: redCount, pct: redPct, dot: 'bg-red-500', text: 'text-red-700', card: 'bg-gradient-to-r from-red-50/80 to-white border-red-200/70' },
                ]).map(cat => (
                  <button
                    key={cat.health}
                    type="button"
                    onClick={() => { setSelectedHealth(cat.health); setView('accounts', { fromDashboard: true }); }}
                    className={`relative overflow-hidden w-full rounded-xl border px-4 py-2.5 text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 flex items-center justify-between gap-3 ${cat.card}`}
                  >
                    {cat.health === 'Red' && redCount > 0 && (
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                    )}
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cat.dot}`} />
                      <span className={`text-xs font-bold uppercase tracking-wide ${cat.text}`}>{cat.label}</span>
                    </span>
                    <span className="flex items-baseline gap-1.5 shrink-0">
                      <span className="text-xl font-extrabold text-slate-900">{cat.count}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{Math.round(cat.pct * 100)}%</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Insight banner */}
            <div className="flex items-center gap-3 rounded-xl bg-blue-50/70 border border-blue-100 px-4 py-3 mt-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-blue-600 shadow-sm shrink-0">
                <Building2 className="w-4 h-4" />
              </span>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{healthMessage}</p>
            </div>
          </Card>

          {/* Recent Activity — grouped timeline feed */}
          <Card
            title={
              <div className="flex items-center gap-2.5">
                <h3 className="text-section-title font-semibold text-slate-800 tracking-tight">Recent Activity</h3>
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Real-time
                </span>
              </div>
            }
            className="flex-1 flex flex-col"
            bodyClassName="flex-1 min-h-0"
            actions={
              <button
                type="button"
                onClick={() => setView('audit-log', { fromDashboard: true })}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded"
              >
                View all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            }
          >
            {activityRows.length === 0 ? (
              <EmptyState
                icon={<Radio className="w-6 h-6 text-slate-400" />}
                title="No recent activity"
                hint="Account, opportunity, and task changes will show up here."
              />
            ) : (
              <div className="space-y-1">
                {activityRows.map((row, idx) => {
                  const { actv, group } = row;
                  const account = accounts.find(a => a.id === actv.accountId);
                  const showGroupHeader = idx === 0 || group !== activityRows[idx - 1].group;

                  return (
                    <React.Fragment key={actv.id}>
                      {showGroupHeader && (
                        <p className={`flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-1.5 ${idx === 0 ? '' : 'pt-3.5'}`}>
                          <span className="w-2 h-px bg-slate-300" aria-hidden="true" />
                          {group}
                        </p>
                      )}
                      <div className="flex items-start gap-3 rounded-lg -m-1.5 p-1.5 hover:bg-slate-50/70 transition-colors duration-150">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-800 text-white shadow-sm">
                          <ActivityIcon type={actv.type} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 pb-2.5">
                          <p className="text-xs leading-snug">
                            <span className="text-slate-400 font-mono mr-2">{formatActivityTime(actv.timestamp)}</span>
                            <span className="text-slate-700 font-semibold">{actv.text}</span>
                          </p>
                          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-1 text-[11px]">
                            {account && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedAccountId(account.id);
                                    setView('account-details');
                                  }}
                                  className="text-blue-600 hover:underline font-semibold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded"
                                >
                                  {account.name}
                                </button>
                                <span className="text-slate-300">•</span>
                              </>
                            )}
                            <span className="text-slate-500 font-medium">{actv.user}</span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

    </div>
  );
};
