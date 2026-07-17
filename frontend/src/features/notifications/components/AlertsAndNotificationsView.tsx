import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Bell, AlertCircle, AlertTriangle, Clock, Calendar,
  Building2, TrendingUp, CheckSquare, Users,
  FileText, MessageSquare, CheckCheck, Trash2, ChevronRight, X,
} from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { notificationsApi, alertsApi } from '@/api/crm.api';
import { compareForSort, SortDirection } from '@/utils';
import {
  ALERT_SEVERITY_COLORS,
  Button,
  Card,
  ConfirmDialog,
  EmptyRow,
  FilterBar,
  FilterSelect,
  Pagination,
  PageHeader,
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
  TableSkeleton,
} from '@/components/ui';
import type { CRMNotification, NotificationType, Alert } from '@/types';

const NOTIF_SEVERITY_STYLES = {
  Info:    { dot: 'bg-blue-500' },
  Success: { dot: 'bg-green-500' },
  Warning: { dot: 'bg-amber-500' },
  Error:   { dot: 'bg-red-500' },
} as const;

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const READ_STATUS_COLORS: Record<string, string> = {
  Unread: 'bg-indigo-100 text-indigo-700',
  Read:   'bg-slate-100 text-slate-500',
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Account:     Building2,
  Opportunity: TrendingUp,
  ActionItem:  CheckSquare,
  Stakeholder: Users,
  Document:    FileText,
  Comment:     MessageSquare,
  System:      Bell,
};

const TYPE_LABEL: Record<string, string> = {
  Account:     'Account',
  Opportunity: 'Opportunity',
  ActionItem:  'Action Item',
  Stakeholder: 'Stakeholder',
  Document:    'Document',
  Comment:     'Comment',
  System:      'System',
};

// Fixed display order for the Type filter/column.
const TYPE_GROUP_ORDER: NotificationType[] = [
  'Account', 'Opportunity', 'ActionItem', 'Stakeholder', 'Document', 'Comment', 'System',
];

type SortField = 'date' | 'type' | 'severity';
type DateBucket = 'today' | 'week' | 'older';
type DateFilterValue = 'all' | DateBucket;
type ReadFilter = 'all' | 'unread' | 'read';

const DATE_FILTER_OPTIONS: Array<{ value: DateFilterValue; label: string }> = [
  { value: 'all',   label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'older', label: 'Older' },
];

// Fixed business-rule categories for alerts, in display/priority order. Each
// definition claims every alert whose `type` is listed; "System Alerts" is a
// catch-all for any type not claimed above it, so new alert rules never fall
// through unbucketed.
const ALERT_GROUP_DEFS: Array<{
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  types: string[];
}> = [
  { key: 'overdue-ai',   label: 'Overdue Action Items', icon: AlertTriangle, types: ['OverdueActionItem'] },
  { key: 'blocked-ai',   label: 'Blocked Action Items', icon: AlertCircle,   types: ['BlockedActionItem'] },
  { key: 'due-today-ai', label: 'Due Today',            icon: Clock,        types: ['DueTodayActionItem'] },
  { key: 'due-week-ai',  label: 'Due This Week',        icon: Calendar,     types: ['DueSoonActionItem'] },
  { key: 'acct-alerts',  label: 'Account Alerts',       icon: Building2,    types: ['CriticalAccount', 'AtRiskAccount'] },
  { key: 'opp-alerts',   label: 'Opportunity Alerts',   icon: TrendingUp,   types: ['OpportunityClosingSoon', 'OpportunityNoActivity'] },
  { key: 'system',       label: 'System Alerts',        icon: Bell,         types: [] },
];

function alertCategoryOf(alert: Alert) {
  for (const def of ALERT_GROUP_DEFS) {
    if (def.types.includes(alert.type)) return def;
  }
  return ALERT_GROUP_DEFS[ALERT_GROUP_DEFS.length - 1]; // System Alerts catch-all
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Classifies an ISO timestamp into Today / This Week (last 7 days, excluding
 * today) / Older using local midnight boundaries. Shared by the Date filters
 * on both tabs so "This Week" means the same thing everywhere.
 */
function dateBucketOf(iso: string): DateBucket {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (d.getTime() === today.getTime())    return 'today';
  if (d.getTime() > weekAgo.getTime())    return 'week';
  return 'older';
}

/** Related-entity cell shared by both tables: stacked account + opportunity name. */
const RelatedTo: React.FC<{ accountName?: string; opportunityName?: string }> = ({ accountName, opportunityName }) => {
  if (!accountName && !opportunityName) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="space-y-1">
      {accountName && (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">{accountName}</span>
        </div>
      )}
      {opportunityName && (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-500 truncate max-w-[180px]">{opportunityName}</span>
        </div>
      )}
    </div>
  );
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const AlertsAndNotificationsView: React.FC = () => {
  const {
    currentUserId, accounts, opportunities,
    setView, setSelectedAccountId, setSelectedOpportunityId, setFocusedRecord,
    refreshUnreadCount,
  } = useCRM();

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const opportunityNameById = useMemo(() => new Map(opportunities.map((o) => [o.id, o.name])), [opportunities]);
  // Opportunity → parent account, used to make the Opportunity filters depend
  // on the selected Account filter.
  const oppAccountById = useMemo(() => new Map(opportunities.map((o) => [o.id, o.accountId])), [opportunities]);

  const NOTIF_PAGE_SIZE = 50;

  const [alerts, setAlerts]             = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<CRMNotification[]>([]);
  const [notifTotal, setNotifTotal]     = useState(0);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Alerts vs Notifications are presented as separate tabs so each can carry
  // its own dense filter bar without the page turning into one long scroll.
  const [activeSection, setActiveSection] = useState<'alerts' | 'notifications'>('alerts');

  // Read/unread is resolved server-side (index-backed) for the "unread" case;
  // "read" filters client-side over an unfiltered fetch, matching the shape
  // of every other client-side filter below.
  const filterParams = useCallback((f: ReadFilter) => ({
    ...(f === 'unread' ? { unread: true } : {}),
  }), []);

  // Client-side organisation layered on top of whatever has been loaded so
  // far (search/type/account/opportunity/date/sort never re-hit the server —
  // they only reshape the already-fetched page(s)).
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'All'>('All');
  const [notifAccountFilter, setNotifAccountFilter] = useState<string>('All');
  const [notifOpportunityFilter, setNotifOpportunityFilter] = useState<string>('All');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [notifDateFilter, setNotifDateFilter] = useState<DateFilterValue>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [notifPage, setNotifPage] = useState(1);
  const [notifPageSize, setNotifPageSize] = useState(10);

  // Alerts are fully loaded up front (no server pagination), so search/category/
  // account/opportunity/date filters are plain client-side reshaping.
  const [alertSearchQuery, setAlertSearchQuery] = useState('');
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<string>('All');
  const [alertAccountFilter, setAlertAccountFilter] = useState<string>('All');
  const [alertOpportunityFilter, setAlertOpportunityFilter] = useState<string>('All');
  const [alertDateFilter, setAlertDateFilter] = useState<DateFilterValue>('all');
  const [alertSortField, setAlertSortField] = useState<SortField>('severity');
  const [alertSortDirection, setAlertSortDirection] = useState<SortDirection>('desc');
  const [alertPage, setAlertPage] = useState(1);
  const [alertPageSize, setAlertPageSize] = useState(10);

  const clearAlertFilters = () => {
    setAlertSearchQuery('');
    setAlertCategoryFilter('All');
    setAlertAccountFilter('All');
    setAlertOpportunityFilter('All');
    setAlertDateFilter('all');
  };

  const clearNotifFilters = () => {
    setSearchQuery('');
    setTypeFilter('All');
    setNotifAccountFilter('All');
    setNotifOpportunityFilter('All');
    setReadFilter('all');
    setNotifDateFilter('all');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleAlertSort = (field: SortField) => {
    if (alertSortField === field) {
      setAlertSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setAlertSortField(field);
      setAlertSortDirection('desc');
    }
  };

  // Reset to page 1 whenever a filter narrows/widens the result set, so the
  // user is never stranded on a now-empty page.
  useEffect(() => { setAlertPage(1); }, [alertSearchQuery, alertCategoryFilter, alertAccountFilter, alertOpportunityFilter, alertDateFilter]);
  useEffect(() => { setNotifPage(1); }, [searchQuery, typeFilter, notifAccountFilter, notifOpportunityFilter, readFilter, notifDateFilter]);

  // Depth of notification pages loaded so far. A ref (not state) so fetchData
  // keeps a stable identity — the mount effect must not re-fire on Load More.
  const notifPageRef = useRef(1);

  // Alerts and notifications are user-scoped only — never fiscal-period-filtered.
  // Notifications are fetched server-side paginated; polling re-reads only the
  // first page and merges, so deep pages already loaded aren't re-downloaded
  // every 30 seconds.
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [alertsData, notifsPage] = await Promise.all([
        alertsApi.getAll({ userId: currentUserId || undefined }),
        notificationsApi.getPage(1, NOTIF_PAGE_SIZE, filterParams(readFilter)),
      ]);
      setAlerts(alertsData);
      if (silent) {
        // Merge-prepend new items; keep already-loaded deeper pages in place.
        setNotifications((prev) => {
          const seen = new Set(notifsPage.data.map((n) => n.id));
          return [...notifsPage.data, ...prev.filter((n) => !seen.has(n.id))];
        });
      } else {
        setNotifications(notifsPage.data);
        notifPageRef.current = 1;
      }
      setNotifTotal(notifsPage.total);
    } catch {
      // silently fail — backend may not have data yet
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentUserId, readFilter, filterParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLoadMoreNotifications = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await notificationsApi.getPage(
        notifPageRef.current + 1, NOTIF_PAGE_SIZE, filterParams(readFilter),
      );
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...res.data.filter((n) => !seen.has(n.id))];
      });
      setNotifTotal(res.total);
      notifPageRef.current = res.page;
    } catch {
      // ignore — pagination stays on the current page for a retry
    } finally {
      setLoadingMore(false);
    }
  }, [readFilter, filterParams]);

  // Poll every 30 seconds so new notifications appear without a manual
  // refresh. Skipped while the tab is hidden — the refetch on the next visible
  // tick catches up.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchData(true);
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    setActionLoading(id);
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      refreshUnreadCount();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    setActionLoading(`del-${id}`);
    try {
      await notificationsApi.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnreadCount();
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading('mark-all');
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearRead = async () => {
    setActionLoading('clear-read');
    try {
      await notificationsApi.clearRead();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      refreshUnreadCount();
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Navigate to the single record an alert/notification refers to.
   * Accounts and opportunities open their details view; action items and
   * stakeholders open their module narrowed to that one record via focusedRecord.
   * (setFocusedRecord must be called AFTER setView — setView resets the focus.)
   */
  const openRecord = (ref: {
    accountId?: string;
    opportunityId?: string;
    actionItemId?: string;
    stakeholderId?: string;
  }) => {
    if (ref.actionItemId) {
      setView('actionItems', { source: 'notifications' });
      setFocusedRecord({ type: 'actionItem', id: ref.actionItemId });
    } else if (ref.opportunityId) {
      setSelectedOpportunityId(ref.opportunityId);
      setView('opportunity-details', { source: 'notifications' });
    } else if (ref.stakeholderId) {
      setView('stakeholders', { source: 'notifications' });
      setFocusedRecord({ type: 'stakeholder', id: ref.stakeholderId });
    } else if (ref.accountId) {
      setSelectedAccountId(ref.accountId);
      setView('account-details', { source: 'notifications' });
    }
  };

  const navigateToAlert = (alert: Alert) => openRecord(alert);

  const openNotification = (notif: CRMNotification) => {
    if (!notif.isRead) handleMarkRead(notif.id);
    openRecord(notif);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount   = notifications.filter((n) =>  n.isRead).length;
  const criticalAlertCount = alerts.filter((a) => a.severity === 'critical').length;

  // ── Notifications: filter options derived from whatever has loaded so far ──
  const notifAccountOptions = useMemo(() => {
    const ids = Array.from(new Set(notifications.map((n) => n.accountId).filter(Boolean))) as string[];
    return ids
      .map((id) => ({ value: id, label: accountNameById.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [notifications, accountNameById]);

  // Dependent filter: when an Account is selected, only that account's
  // opportunities are offered (resolved via the notification's own accountId,
  // falling back to the opportunity's parent account).
  const notifOpportunityOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const n of notifications) {
      if (!n.opportunityId) continue;
      const oppAccount = n.accountId ?? oppAccountById.get(n.opportunityId);
      if (notifAccountFilter !== 'All' && oppAccount !== notifAccountFilter) continue;
      seen.add(n.opportunityId);
    }
    return Array.from(seen)
      .map((id) => ({ value: id, label: opportunityNameById.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [notifications, opportunityNameById, notifAccountFilter, oppAccountById]);

  // Search + type/account/opportunity/read/date filters + sort are purely
  // client-side reshaping of whatever pages have been loaded from the server
  // so far.
  const filteredNotifications = notifications.filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) return false;
    }
    if (typeFilter !== 'All' && n.type !== typeFilter) return false;
    if (notifAccountFilter !== 'All' && n.accountId !== notifAccountFilter) return false;
    if (notifOpportunityFilter !== 'All' && n.opportunityId !== notifOpportunityFilter) return false;
    if (readFilter === 'read' && !n.isRead) return false;
    if (readFilter === 'unread' && n.isRead) return false;
    if (notifDateFilter !== 'all' && dateBucketOf(n.createdAt) !== notifDateFilter) return false;
    return true;
  });
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    if (sortField === 'type') return compareForSort(a.type, b.type, sortDirection);
    return compareForSort(a.createdAt, b.createdAt, sortDirection);
  });

  const notifFiltersActive = searchQuery.trim() !== '' || typeFilter !== 'All'
    || notifAccountFilter !== 'All' || notifOpportunityFilter !== 'All'
    || readFilter !== 'all' || notifDateFilter !== 'all';

  // When no filter narrows the loaded set, pagination can range over the full
  // server-side total (paging forward transparently loads more); once a
  // filter is active, pagination is bounded to what has been loaded so far.
  const notifPaginationTotal = notifFiltersActive ? sortedNotifications.length : notifTotal;
  const notifTotalPages = Math.max(1, Math.ceil(notifPaginationTotal / notifPageSize));
  const notifCurrentPage = Math.min(notifPage, notifTotalPages);
  const pagedNotifications = sortedNotifications.slice(
    (notifCurrentPage - 1) * notifPageSize, notifCurrentPage * notifPageSize,
  );

  const handleNotifPageChange = async (p: number) => {
    setNotifPage(p);
    if (!notifFiltersActive && p * notifPageSize > notifications.length && notifications.length < notifTotal && !loadingMore) {
      await handleLoadMoreNotifications();
    }
  };

  // ── Alerts: filter options derived from live alert data ────────────────────
  const alertAccountOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of alerts) if (a.accountId) seen.set(a.accountId, a.accountName ?? a.accountId);
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [alerts]);

  // Dependent filter: constrained to the selected Account's opportunities.
  const alertOpportunityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of alerts) {
      if (!a.opportunityId) continue;
      const oppAccount = a.accountId ?? oppAccountById.get(a.opportunityId);
      if (alertAccountFilter !== 'All' && oppAccount !== alertAccountFilter) continue;
      seen.set(a.opportunityId, a.opportunityName ?? a.opportunityId);
    }
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [alerts, alertAccountFilter, oppAccountById]);

  // Search + category/account/opportunity/date filters narrow the pool; sort
  // defaults to business severity (matches the backend's default ordering).
  const filteredAlerts = alerts.filter((a) => {
    if (alertSearchQuery.trim()) {
      const q = alertSearchQuery.trim().toLowerCase();
      const haystack = `${a.title} ${a.description} ${a.accountName ?? ''} ${a.opportunityName ?? ''} ${a.actionItemTitle ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (alertCategoryFilter !== 'All' && alertCategoryOf(a).key !== alertCategoryFilter) return false;
    if (alertAccountFilter !== 'All' && a.accountId !== alertAccountFilter) return false;
    if (alertOpportunityFilter !== 'All' && a.opportunityId !== alertOpportunityFilter) return false;
    if (alertDateFilter !== 'all' && dateBucketOf(a.createdAt) !== alertDateFilter) return false;
    return true;
  });
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    if (alertSortField === 'date') return compareForSort(a.createdAt, b.createdAt, alertSortDirection);
    return compareForSort(SEVERITY_RANK[a.severity] ?? 0, SEVERITY_RANK[b.severity] ?? 0, alertSortDirection);
  });

  const alertFiltersActive = alertSearchQuery.trim() !== '' || alertCategoryFilter !== 'All'
    || alertAccountFilter !== 'All' || alertOpportunityFilter !== 'All' || alertDateFilter !== 'all';

  const alertTotalPages = Math.max(1, Math.ceil(sortedAlerts.length / alertPageSize));
  const alertCurrentPage = Math.min(alertPage, alertTotalPages);
  const pagedAlerts = sortedAlerts.slice((alertCurrentPage - 1) * alertPageSize, alertCurrentPage * alertPageSize);

  const renderAlertRow = (alert: Alert) => {
    const category = alertCategoryOf(alert);
    const CategoryIcon = category.icon;
    const hasLink = alert.accountId || alert.opportunityId || alert.actionItemId;

    return (
      <TableRow key={alert.id} className="hover:bg-slate-50/50">
        <TableCell>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <CategoryIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-500">{category.label}</span>
          </div>
        </TableCell>
        <TableCell className="min-w-[240px]">
          <p className="text-sm font-bold text-slate-800 leading-snug">{alert.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.description}</p>
        </TableCell>
        <TableCell>
          <RelatedTo accountName={alert.accountName} opportunityName={alert.opportunityName} />
        </TableCell>
        <TableCell>
          <StatusBadge value={alert.severity} colorMap={ALERT_SEVERITY_COLORS} className="uppercase" />
        </TableCell>
        <TableCell className="whitespace-nowrap text-[11px] text-slate-400 font-medium">
          {formatTs(alert.createdAt)}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center">
            {hasLink && (
              <button
                onClick={() => navigateToAlert(alert)}
                className="flex items-center gap-0.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Open <ChevronRight className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderNotifRow = (notif: CRMNotification) => {
    const Icon = TYPE_ICON[notif.type] ?? Bell;
    const sev  = NOTIF_SEVERITY_STYLES[notif.severity] ?? NOTIF_SEVERITY_STYLES.Info;
    const isDeleting = actionLoading === `del-${notif.id}`;
    const isMarking  = actionLoading === notif.id;

    return (
      <TableRow
        key={notif.id}
        className={notif.isRead ? 'hover:bg-slate-50/50' : 'bg-indigo-50/25 hover:bg-indigo-50/40'}
      >
        <TableCell>
          <div
            className={`w-2 h-2 rounded-full ${notif.isRead ? 'bg-slate-200' : sev.dot}`}
            aria-hidden="true"
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Icon className={`w-4 h-4 shrink-0 ${notif.isRead ? 'text-slate-300' : 'text-slate-500'}`} aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-500">{TYPE_LABEL[notif.type] ?? notif.type}</span>
          </div>
        </TableCell>
        <TableCell className="min-w-[240px]">
          <p
            className={`text-sm leading-snug ${
              notif.isRead ? 'font-medium text-slate-500' : 'font-bold text-slate-800'
            }`}
          >
            {notif.title}
          </p>
          <p
            className={`text-xs mt-0.5 leading-relaxed ${
              notif.isRead ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {notif.message}
          </p>
        </TableCell>
        <TableCell>
          <RelatedTo
            accountName={notif.accountId ? accountNameById.get(notif.accountId) ?? notif.accountId : undefined}
            opportunityName={notif.opportunityId ? opportunityNameById.get(notif.opportunityId) ?? notif.opportunityId : undefined}
          />
        </TableCell>
        <TableCell>
          <StatusBadge value={notif.isRead ? 'Read' : 'Unread'} colorMap={READ_STATUS_COLORS} />
        </TableCell>
        <TableCell className="whitespace-nowrap text-[11px] text-slate-400 font-medium">
          {formatTs(notif.createdAt)}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center gap-1">
            {(notif.accountId || notif.opportunityId || notif.actionItemId || notif.stakeholderId) && (
              <button
                onClick={() => openNotification(notif)}
                title="Open the related record"
                className="flex items-center gap-0.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Open <ChevronRight className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
            {!notif.isRead && (
              <RowActionButton
                intent="view"
                label="Mark as read"
                icon={<CheckCheck className="w-3.5 h-3.5" />}
                onClick={() => handleMarkRead(notif.id)}
                disabled={isMarking}
              />
            )}
            <RowActionButton
              intent="delete"
              label="Delete notification"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDelete(notif.id)}
              disabled={isDeleting}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const SECTION_TABS: Array<{
    id: 'alerts' | 'notifications';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Notifications"
        subtitle="Real-time alerts from business rules and a log of all account activity events."
      />

      {/* ── Summary ─────────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Active Alerts"
            value={
              <span className="inline-flex items-baseline gap-2">
                {alerts.length}
                {criticalAlertCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                    {criticalAlertCount} critical
                  </span>
                )}
              </span>
            }
            icon={<AlertTriangle className="w-4.5 h-4.5" aria-hidden="true" />}
            tone="amber"
          />
          <SummaryCard
            label="Unread Notifications"
            value={
              <span className="inline-flex items-baseline gap-2">
                {unreadCount}
                {unreadCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                    needs review
                  </span>
                )}
              </span>
            }
            icon={<Bell className="w-4.5 h-4.5" aria-hidden="true" />}
            tone="indigo"
          />
          <SummaryCard
            label="Total Notifications"
            value={notifTotal}
            icon={<Bell className="w-4.5 h-4.5" aria-hidden="true" />}
            tone="blue"
          />
        </div>
      )}

      {/* ── Section tabs ────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex items-center overflow-x-auto select-none space-x-1">
        {SECTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}{!loading && (tab.id === 'alerts' ? ` (${alerts.length})` : ` (${notifTotal})`)}</span>
              {tab.id === 'alerts' && !loading && criticalAlertCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                  {criticalAlertCount}
                </span>
              )}
              {tab.id === 'notifications' && !loading && unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {unreadCount} unread
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Alerts tab ─────────────────────────────────────────────────────────── */}
      {activeSection === 'alerts' && (
        <section className="space-y-4">
          <FilterBar className="flex flex-wrap items-center gap-3">
            <SearchBar
              value={alertSearchQuery}
              onChange={setAlertSearchQuery}
              placeholder="Search alerts..."
              className="max-w-xs w-full"
            />
            <FilterSelect
              label="Category"
              hideLabel
              value={alertCategoryFilter}
              onChange={setAlertCategoryFilter}
              options={[
                { value: 'All', label: 'All Categories' },
                ...ALERT_GROUP_DEFS.map((d) => ({ value: d.key, label: d.label })),
              ]}
              className="w-52"
            />
            <FilterSelect
              label="Account"
              hideLabel
              value={alertAccountFilter}
              onChange={(v) => {
                setAlertAccountFilter(v);
                // Dependent filter: the opportunity list is rebuilt for the
                // new account, so any previous selection is cleared.
                setAlertOpportunityFilter('All');
              }}
              options={[{ value: 'All', label: 'All Accounts' }, ...alertAccountOptions]}
              className="w-44"
            />
            <FilterSelect
              label="Opportunity"
              hideLabel
              value={alertOpportunityFilter}
              onChange={setAlertOpportunityFilter}
              options={[{ value: 'All', label: 'All Opportunities' }, ...alertOpportunityOptions]}
              className="w-48"
            />
            <FilterSelect
              label="Date"
              hideLabel
              value={alertDateFilter}
              onChange={(v) => setAlertDateFilter(v as DateFilterValue)}
              options={DATE_FILTER_OPTIONS}
              className="w-36"
            />
            {alertFiltersActive && (
              <Button variant="secondary" size="xs" onClick={clearAlertFilters} className="ml-auto">
                Clear filters
              </Button>
            )}
          </FilterBar>

          {alertFiltersActive && (
            <p className="text-xs text-slate-500 font-medium px-1">
              Showing {sortedAlerts.length} of {alerts.length} alerts
            </p>
          )}

          {loading ? (
            <TableSkeleton rows={6} />
          ) : (
            <Card padding="none" clip>
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableHeadCell>Category</TableHeadCell>
                    <TableHeadCell>Alert</TableHeadCell>
                    <TableHeadCell>Related To</TableHeadCell>
                    <TableHeadCell>
                      <SortableHeader<SortField>
                        label="Severity"
                        field="severity"
                        sortField={alertSortField}
                        sortDirection={alertSortDirection}
                        onSort={handleAlertSort}
                      />
                    </TableHeadCell>
                    <TableHeadCell>
                      <SortableHeader<SortField>
                        label="Date"
                        field="date"
                        sortField={alertSortField}
                        sortDirection={alertSortDirection}
                        onSort={handleAlertSort}
                      />
                    </TableHeadCell>
                    <TableHeadCell align="center">Actions</TableHeadCell>
                  </TableHead>
                  <tbody>
                    {sortedAlerts.length === 0 ? (
                      <EmptyRow
                        colSpan={6}
                        message={
                          alerts.length === 0
                            ? 'No active alerts — all accounts, opportunities, and action items are on track.'
                            : 'No alerts match your filters.'
                        }
                      />
                    ) : (
                      pagedAlerts.map(renderAlertRow)
                    )}
                  </tbody>
                </Table>
              </div>

              {sortedAlerts.length > 0 && (
                <Pagination
                  page={alertCurrentPage}
                  pageSize={alertPageSize}
                  totalItems={sortedAlerts.length}
                  onPageChange={setAlertPage}
                  onPageSizeChange={(size) => { setAlertPageSize(size); setAlertPage(1); }}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  itemLabel="alerts"
                />
              )}
            </Card>
          )}
        </section>
      )}

      {/* ── Notifications tab ─────────────────────────────────────────────────── */}
      {activeSection === 'notifications' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Notifications</h3>
              {!loading && unreadCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                icon={<CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={handleMarkAllRead}
                disabled={actionLoading === 'mark-all' || unreadCount === 0}
              >
                Mark All Read
              </Button>
              <Button
                variant="secondary"
                size="xs"
                icon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={handleClearRead}
                disabled={actionLoading === 'clear-read' || readCount === 0}
              >
                Clear Read
              </Button>
            </div>
          </div>

          <FilterBar className="flex flex-wrap items-center gap-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search notifications..."
              className="max-w-xs w-full"
            />
            <FilterSelect
              label="Type"
              hideLabel
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as NotificationType | 'All')}
              options={[
                { value: 'All', label: 'All Types' },
                ...TYPE_GROUP_ORDER.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
              ]}
              className="w-40"
            />
            <FilterSelect
              label="Account"
              hideLabel
              value={notifAccountFilter}
              onChange={(v) => {
                setNotifAccountFilter(v);
                // Dependent filter: the opportunity list is rebuilt for the
                // new account, so any previous selection is cleared.
                setNotifOpportunityFilter('All');
              }}
              options={[{ value: 'All', label: 'All Accounts' }, ...notifAccountOptions]}
              className="w-44"
            />
            <FilterSelect
              label="Opportunity"
              hideLabel
              value={notifOpportunityFilter}
              onChange={setNotifOpportunityFilter}
              options={[{ value: 'All', label: 'All Opportunities' }, ...notifOpportunityOptions]}
              className="w-48"
            />
            <FilterSelect
              label="Read/Unread"
              hideLabel
              value={readFilter}
              onChange={(v) => setReadFilter(v as ReadFilter)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'Unread' },
                { value: 'read', label: 'Read' },
              ]}
              className="w-36"
            />
            <FilterSelect
              label="Date"
              hideLabel
              value={notifDateFilter}
              onChange={(v) => setNotifDateFilter(v as DateFilterValue)}
              options={DATE_FILTER_OPTIONS}
              className="w-36"
            />
            {notifFiltersActive && (
              <Button variant="secondary" size="xs" onClick={clearNotifFilters} className="ml-auto">
                Clear filters
              </Button>
            )}
          </FilterBar>

          {notifFiltersActive && (
            <p className="text-xs text-slate-500 font-medium px-1">
              Showing {sortedNotifications.length} of {notifications.length} loaded notifications
            </p>
          )}

          {loading ? (
            <TableSkeleton rows={6} />
          ) : (
            <Card padding="none" clip>
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableHeadCell className="w-8" aria-hidden="true" />
                    <TableHeadCell>
                      <SortableHeader<SortField>
                        label="Type"
                        field="type"
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHeadCell>
                    <TableHeadCell>Notification</TableHeadCell>
                    <TableHeadCell>Related To</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell>
                      <SortableHeader<SortField>
                        label="Date"
                        field="date"
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHeadCell>
                    <TableHeadCell align="center">Actions</TableHeadCell>
                  </TableHead>
                  <tbody>
                    {sortedNotifications.length === 0 ? (
                      <EmptyRow
                        colSpan={7}
                        message={notifications.length === 0 ? "No notifications — you're all caught up." : 'No notifications match your filters.'}
                      />
                    ) : (
                      pagedNotifications.map(renderNotifRow)
                    )}
                  </tbody>
                </Table>
              </div>

              {sortedNotifications.length > 0 && (
                <Pagination
                  page={notifCurrentPage}
                  pageSize={notifPageSize}
                  totalItems={notifPaginationTotal}
                  onPageChange={handleNotifPageChange}
                  onPageSizeChange={(size) => { setNotifPageSize(size); setNotifPage(1); }}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  itemLabel="notifications"
                />
              )}
            </Card>
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Notification"
        message="Delete this notification? It will be removed from your notifications list."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
