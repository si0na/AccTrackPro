import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import {
  Bell, AlertCircle, AlertTriangle, Clock, Calendar, Archive, Filter,
  Building2, TrendingUp, CheckSquare, Users,
  FileText, MessageSquare, CheckCheck, Trash2,
  ChevronRight, ChevronDown, X,
} from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { notificationsApi, alertsApi } from '@/api/crm.api';
import { compareForSort, SortDirection } from '@/utils';
import {
  ALERT_SEVERITY_COLORS,
  NOTIFICATION_SEVERITY_COLORS,
  Button,
  CardSkeleton,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  FilterChip,
  FilterSelect,
  Pagination,
  PageHeader,
  RowActionButton,
  SearchBar,
  Skeleton,
  SortableHeader,
  StatusBadge,
} from '@/components/ui';
import type { CRMNotification, NotificationType, Alert } from '@/types';

const SEVERITY_STYLES = {
  critical: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    iconColor: 'text-red-500',
    strip: 'bg-red-500',
  },
  high: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    strip: 'bg-orange-500',
  },
  medium: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    strip: 'bg-amber-500',
  },
  low: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    strip: 'bg-blue-500',
  },
} as const;

const NOTIF_SEVERITY_STYLES = {
  Info:    { dot: 'bg-blue-500',  icon: 'text-blue-500'  },
  Success: { dot: 'bg-green-500', icon: 'text-green-500' },
  Warning: { dot: 'bg-amber-500', icon: 'text-amber-500' },
  Error:   { dot: 'bg-red-500',   icon: 'text-red-500'   },
} as const;

const SEVERITY_RANK: Record<string, number> = { Error: 4, Warning: 3, Success: 2, Info: 1 };

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

// Fixed display order for type-based grouping/filtering.
const TYPE_GROUP_ORDER: NotificationType[] = [
  'Account', 'Opportunity', 'ActionItem', 'Stakeholder', 'Document', 'Comment', 'System',
];

const TYPE_GROUP_LABEL: Record<NotificationType, string> = {
  Account:     'Accounts',
  Opportunity: 'Opportunities',
  ActionItem:  'Action Items',
  Stakeholder: 'Stakeholders',
  Document:    'Documents',
  Comment:     'Comments',
  System:      'System',
};

type GroupMode = 'priority' | 'type';
type SortField = 'date' | 'severity' | 'type';

interface NotifGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'default' | 'urgent';
  items: CRMNotification[];
}

interface AlertGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Alert[];
}

// Fixed display order for alert grouping. Each definition claims every alert
// whose `type` is listed; "System Notifications" is a catch-all for any type
// not claimed above it, so future alert rules never fall through unbucketed.
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
  { key: 'opp-updates',  label: 'Opportunity Updates',  icon: TrendingUp,   types: ['OpportunityClosingSoon', 'OpportunityNoActivity'] },
  { key: 'acct-updates', label: 'Account Updates',      icon: Building2,    types: ['CriticalAccount', 'AtRiskAccount'] },
  { key: 'system',       label: 'System Notifications', icon: Bell,         types: [] },
];

function alertEntityIcon(id: string) {
  if (id.includes('-ai-'))   return CheckSquare;
  if (id.includes('-opp-') || id.includes('closing') || id.includes('noactivity')) return TrendingUp;
  if (id.includes('-acct-') || id.includes('acct-')) return Building2;
  return AlertCircle;
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
 * Bucket notifications for the "Priority & Date" grouping. Unread Error/Warning
 * items surface as High Priority regardless of age; everything else falls into
 * date buckets so the same notification never appears twice.
 */
function buildPriorityGroups(notifications: CRMNotification[]): NotifGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const highPriority: CRMNotification[] = [];
  const rest: CRMNotification[] = [];
  for (const n of notifications) {
    if (!n.isRead && (n.severity === 'Error' || n.severity === 'Warning')) highPriority.push(n);
    else rest.push(n);
  }

  const todayItems: CRMNotification[]   = [];
  const weekItems: CRMNotification[]    = [];
  const earlierItems: CRMNotification[] = [];
  for (const n of rest) {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime())   todayItems.push(n);
    else if (d.getTime() > weekAgo.getTime()) weekItems.push(n);
    else                                    earlierItems.push(n);
  }

  const groups: NotifGroup[] = [];
  if (highPriority.length) groups.push({ key: 'high', label: 'High Priority', icon: AlertTriangle, accent: 'urgent', items: highPriority });
  if (todayItems.length)   groups.push({ key: 'today', label: 'Today', icon: Clock, accent: 'default', items: todayItems });
  if (weekItems.length)    groups.push({ key: 'week', label: 'This Week', icon: Calendar, accent: 'default', items: weekItems });
  if (earlierItems.length) groups.push({ key: 'earlier', label: 'Earlier', icon: Archive, accent: 'default', items: earlierItems });
  return groups;
}

/** Bucket notifications by entity type, in a fixed display order. */
function buildTypeGroups(notifications: CRMNotification[]): NotifGroup[] {
  const groups: NotifGroup[] = [];
  for (const t of TYPE_GROUP_ORDER) {
    const items = notifications.filter((n) => n.type === t);
    if (items.length) {
      groups.push({ key: t, label: TYPE_GROUP_LABEL[t], icon: TYPE_ICON[t] ?? Bell, accent: 'default', items });
    }
  }
  return groups;
}

/** Bucket alerts into the fixed business-rule categories, in display order. */
function buildAlertGroups(alerts: Alert[]): AlertGroup[] {
  const claimedTypes = new Set(ALERT_GROUP_DEFS.flatMap((def) => def.types));
  const groups: AlertGroup[] = [];
  for (const def of ALERT_GROUP_DEFS) {
    const items = def.types.length
      ? alerts.filter((a) => def.types.includes(a.type))
      : alerts.filter((a) => !claimedTypes.has(a.type));
    if (items.length) groups.push({ key: def.key, label: def.label, icon: def.icon, items });
  }
  return groups;
}

interface GroupSectionProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  unreadCount: number;
  accent: 'default' | 'urgent';
  defaultExpanded: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible card for one alert or notification group — mirrors the app's
 * standard collapsible-section chrome (see DeactivatedSection) with an added
 * type icon and unread badge so priority stands out at a glance.
 */
const GroupSection: React.FC<GroupSectionProps> = ({
  label, icon: Icon, count, unreadCount, accent, defaultExpanded, children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();

  return (
    <div className={`bg-white rounded-xl border overflow-hidden shadow-sm ${accent === 'urgent' ? 'border-red-200' : 'border-slate-200/80'}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
          )}
          <Icon className={`w-4 h-4 ${accent === 'urgent' ? 'text-red-500' : 'text-slate-400'}`} aria-hidden="true" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${accent === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
            {count}
          </span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {unreadCount} unread
            </span>
          )}
        </div>
      </button>
      {expanded && <div id={bodyId} className="border-t border-slate-100">{children}</div>}
    </div>
  );
};

const GROUP_PAGE_SIZE = 8;
const ALERT_GROUP_PAGE_SIZE = 6;

export const AlertsAndNotificationsView: React.FC = () => {
  const {
    currentUserId,
    setView, setSelectedAccountId, setSelectedOpportunityId, setFocusedRecord,
    refreshUnreadCount,
  } = useCRM();

  const NOTIF_PAGE_SIZE = 50;

  const [alerts, setAlerts]             = useState<Alert[]>([]);
  const [alertGroupPages, setAlertGroupPages] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<CRMNotification[]>([]);
  const [notifTotal, setNotifTotal]     = useState(0);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // List filter — resolved server-side (index-backed), not by trimming pages
  // client-side, so counts and "Load more" stay correct.
  type NotifFilter = 'all' | 'unread' | 'business' | 'system';
  const [notifFilter, setNotifFilter] = useState<NotifFilter>('all');
  const filterParams = useCallback((f: NotifFilter) => ({
    ...(f === 'business' ? { category: 'BUSINESS' as const } : {}),
    ...(f === 'system' ? { category: 'SYSTEM' as const } : {}),
    ...(f === 'unread' ? { unread: true } : {}),
  }), []);

  // Client-side organisation layered on top of whatever has been loaded so
  // far (search/type/sort/grouping never re-hit the server — they only
  // reshape the already-fetched page(s)).
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'All'>('All');
  const [groupMode, setGroupMode] = useState<GroupMode>('priority');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'type' ? 'asc' : 'desc');
    }
  };

  // Depth of notification pages loaded so far. A ref (not state) so fetchData
  // keeps a stable identity — the mount effect must not re-fire on Load More.
  const notifPageRef = useRef(1);

  // Alerts and notifications are user-scoped only — never fiscal-period-filtered.
  // Notifications are fetched server-side paginated; polling re-reads only the
  // first page and merges, so deep "Load more" reads aren't re-downloaded
  // every 30 seconds.
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [alertsData, notifsPage] = await Promise.all([
        alertsApi.getAll({ userId: currentUserId || undefined }),
        notificationsApi.getPage(1, NOTIF_PAGE_SIZE, filterParams(notifFilter)),
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
  }, [currentUserId, notifFilter, filterParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLoadMoreNotifications = async () => {
    setLoadingMore(true);
    try {
      const res = await notificationsApi.getPage(
        notifPageRef.current + 1, NOTIF_PAGE_SIZE, filterParams(notifFilter),
      );
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...res.data.filter((n) => !seen.has(n.id))];
      });
      setNotifTotal(res.total);
      notifPageRef.current = res.page;
    } catch {
      // ignore — the button stays visible for a retry
    } finally {
      setLoadingMore(false);
    }
  };

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

  // Search + type filter + sort are purely client-side reshaping of whatever
  // pages have been loaded from the server so far.
  const searchedNotifications = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
  });
  const visibleNotifications = typeFilter === 'All'
    ? searchedNotifications
    : searchedNotifications.filter((n) => n.type === typeFilter);
  const sortedNotifications = [...visibleNotifications].sort((a, b) => {
    if (sortField === 'severity') {
      return compareForSort(SEVERITY_RANK[a.severity] ?? 0, SEVERITY_RANK[b.severity] ?? 0, sortDirection);
    }
    if (sortField === 'type') return compareForSort(a.type, b.type, sortDirection);
    return compareForSort(a.createdAt, b.createdAt, sortDirection);
  });

  const notifGroups = groupMode === 'priority'
    ? buildPriorityGroups(sortedNotifications)
    : buildTypeGroups(sortedNotifications);

  const filtersActive = searchQuery.trim() !== '' || typeFilter !== 'All';

  const alertGroups = buildAlertGroups(alerts);

  const renderAlertCard = (alert: Alert) => {
    const s = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
    const EntityIcon = alertEntityIcon(alert.id);
    return (
      <div
        key={alert.id}
        className={`bg-white border ${s.border} rounded-xl shadow-sm overflow-hidden flex`}
      >
        <div className={`w-1 shrink-0 ${s.strip}`} aria-hidden="true" />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`mt-0.5 p-1.5 rounded-lg ${s.bg} shrink-0`}>
                <EntityIcon className={`w-4 h-4 ${s.iconColor}`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <StatusBadge
                  value={alert.severity}
                  colorMap={ALERT_SEVERITY_COLORS}
                  className="uppercase"
                />
                <p className="text-sm font-bold text-slate-800 mt-1.5 leading-snug">{alert.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.description}</p>
                {(alert.actionItemTitle || alert.opportunityName || alert.accountName) && (
                  <p className="text-[11px] text-slate-400 font-medium mt-1.5 truncate">
                    {alert.actionItemTitle || alert.opportunityName || alert.accountName}
                  </p>
                )}
              </div>
            </div>
            {(alert.accountId || alert.opportunityId || alert.actionItemId) && (
              <button
                onClick={() => navigateToAlert(alert)}
                className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Open <ChevronRight className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderNotifRow = (notif: CRMNotification) => {
    const Icon = TYPE_ICON[notif.type] ?? Bell;
    const sev  = NOTIF_SEVERITY_STYLES[notif.severity] ?? NOTIF_SEVERITY_STYLES.Info;
    const isDeleting = actionLoading === `del-${notif.id}`;
    const isMarking  = actionLoading === notif.id;

    return (
      <tr
        key={notif.id}
        className={`border-b border-slate-50 last:border-0 transition-colors ${
          notif.isRead ? 'hover:bg-slate-50/50' : 'bg-indigo-50/25 hover:bg-indigo-50/40'
        }`}
      >
        <td className="py-3.5 pl-5 pr-2">
          <div
            className={`w-2 h-2 rounded-full ${notif.isRead ? 'bg-slate-200' : sev.dot}`}
            aria-hidden="true"
          />
        </td>
        <td className="py-3.5 px-3">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Icon className={`w-4 h-4 shrink-0 ${notif.isRead ? 'text-slate-300' : sev.icon}`} aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-500">{TYPE_LABEL[notif.type] ?? notif.type}</span>
          </div>
        </td>
        <td className="py-3.5 px-3 min-w-[240px]">
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
        </td>
        <td className="py-3.5 px-3">
          <StatusBadge value={notif.severity} colorMap={NOTIFICATION_SEVERITY_COLORS} />
        </td>
        <td className="py-3.5 px-3 whitespace-nowrap text-[11px] text-slate-400 font-medium">
          {formatTs(notif.createdAt)}
        </td>
        <td className="py-3.5 pr-5 pl-3">
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
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alerts & Notifications"
        subtitle="Real-time alerts from business rules and a log of all account activity events."
      />

      {/* ── Active Alerts ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Active Alerts</h3>
          {!loading && alerts.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
              {alerts.length}
            </span>
          )}
        </div>

        {loading ? (
          <CardSkeleton cards={4} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" />
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <EmptyState
              icon={<CheckCheck className="w-6 h-6 text-green-300" aria-hidden="true" />}
              title="No active alerts"
              hint="All accounts, opportunities, and action items are on track."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {alertGroups.map((group) => {
              const accent: 'default' | 'urgent' = group.items.some((a) => a.severity === 'critical') ? 'urgent' : 'default';
              const pageNum = alertGroupPages[group.key] ?? 1;
              const totalPages = Math.max(1, Math.ceil(group.items.length / ALERT_GROUP_PAGE_SIZE));
              const currentPage = Math.min(pageNum, totalPages);
              const pagedItems = group.items.slice(
                (currentPage - 1) * ALERT_GROUP_PAGE_SIZE,
                currentPage * ALERT_GROUP_PAGE_SIZE,
              );

              return (
                <GroupSection
                  key={group.key}
                  label={group.label}
                  icon={group.icon}
                  count={group.items.length}
                  unreadCount={0}
                  accent={accent}
                  defaultExpanded={accent === 'urgent' || group.items.length <= ALERT_GROUP_PAGE_SIZE}
                >
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pagedItems.map(renderAlertCard)}
                  </div>
                  {group.items.length > ALERT_GROUP_PAGE_SIZE && (
                    <Pagination
                      page={currentPage}
                      pageSize={ALERT_GROUP_PAGE_SIZE}
                      totalItems={group.items.length}
                      onPageChange={(p) => setAlertGroupPages((prev) => ({ ...prev, [group.key]: p }))}
                      itemLabel="alerts"
                    />
                  )}
                </GroupSection>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Notification"
        message="Delete this notification? It will be removed from your notifications list."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Notifications ─────────────────────────────────────────────────────── */}
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

        {/* Control panel — search, type, grouping, and server-side filter chips */}
        <FilterBar className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
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
                ...TYPE_GROUP_ORDER.map((t) => ({ value: t, label: TYPE_GROUP_LABEL[t] })),
              ]}
              className="w-44"
            />
            <div className="flex items-center gap-1.5 sm:ml-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Group by</span>
              <FilterChip label="Priority & Date" active={groupMode === 'priority'} onClick={() => setGroupMode('priority')} />
              <FilterChip label="Type" active={groupMode === 'type'} onClick={() => setGroupMode('type')} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              ['all', 'All'],
              ['unread', 'Unread'],
              ['business', 'Business'],
              ['system', 'System'],
            ] as const).map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                active={notifFilter === key}
                onClick={() => setNotifFilter(key)}
              />
            ))}
          </div>
        </FilterBar>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <EmptyState
              icon={<Bell className="w-6 h-6 text-slate-300" aria-hidden="true" />}
              title="No notifications"
              hint="You're all caught up."
            />
          </div>
        ) : notifGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <EmptyState
              icon={<Filter className="w-6 h-6 text-slate-300" aria-hidden="true" />}
              title="No notifications match your filters"
              hint="Try adjusting the search, type, or filter chips above."
            />
            {filtersActive && (
              <div className="flex justify-center pb-6">
                <Button variant="secondary" size="xs" onClick={() => { setSearchQuery(''); setTypeFilter('All'); }}>
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {notifGroups.map((group) => {
              const groupUnread = group.items.filter((n) => !n.isRead).length;
              const pageNum = groupPages[group.key] ?? 1;
              const totalPages = Math.max(1, Math.ceil(group.items.length / GROUP_PAGE_SIZE));
              const currentPage = Math.min(pageNum, totalPages);
              const pagedItems = group.items.slice(
                (currentPage - 1) * GROUP_PAGE_SIZE,
                currentPage * GROUP_PAGE_SIZE,
              );

              return (
                <GroupSection
                  key={group.key}
                  label={group.label}
                  icon={group.icon}
                  count={group.items.length}
                  unreadCount={groupUnread}
                  accent={group.accent}
                  defaultExpanded={group.accent === 'urgent' || group.items.length <= 5}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 select-none text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 pl-5 pr-2 w-8" aria-hidden="true" />
                          <th className="py-2.5 px-3">
                            <SortableHeader<SortField>
                              label="Type"
                              field="type"
                              sortField={sortField}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="py-2.5 px-3">Notification</th>
                          <th className="py-2.5 px-3">
                            <SortableHeader<SortField>
                              label="Severity"
                              field="severity"
                              sortField={sortField}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="py-2.5 px-3">
                            <SortableHeader<SortField>
                              label="Time"
                              field="date"
                              sortField={sortField}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                            />
                          </th>
                          <th className="py-2.5 pr-5 pl-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedItems.map(renderNotifRow)}
                      </tbody>
                    </table>
                  </div>
                  {group.items.length > GROUP_PAGE_SIZE && (
                    <Pagination
                      page={currentPage}
                      pageSize={GROUP_PAGE_SIZE}
                      totalItems={group.items.length}
                      onPageChange={(p) => setGroupPages((prev) => ({ ...prev, [group.key]: p }))}
                      itemLabel="notifications"
                    />
                  )}
                </GroupSection>
              );
            })}

            {notifications.length < notifTotal && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadMoreNotifications}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : `Load more (${notifications.length} of ${notifTotal})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
