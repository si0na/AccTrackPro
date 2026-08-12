import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useCRMData } from '@/hooks/useCRMData';
import { authApi, rbacApi, serviceProvidersApi, projectManagersApi } from '@/api/crm.api';
import type {
  Account, Opportunity, ActionItem, Stakeholder, Activity, Comment, CustomColumn, ColumnConfig,
  User, FinancialYear, FinancialCalendar, AdminSettings, Project, MyPermissions, ServiceProviderUser,
} from '@/types';

// ─── User profiles ────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  role: string;
  avatarUrl: string;
  email: string;
}

// ─── View types ───────────────────────────────────────────────────────────────

export type ViewType =
  | 'dashboard'
  | 'accounts'
  | 'account-details'
  | 'opportunities'
  | 'opportunity-details'
  | 'opportunity-forecast'
  | 'projects'
  | 'project-details'
  | 'actionItems'
  | 'projectActionItems'
  | 'stakeholders'
  | 'forecast'
  | 'executive'
  | 'reports'
  | 'notifications'
  | 'administration'
  | 'audit-log'
  | 'performance-evaluation';

/**
 * The page that triggered deep-link navigation so target views can render a
 * "Back to …" button.  'dashboard' is handled separately via cameFromDashboard.
 */
export type NavSource = 'notifications' | 'audit-log';

/** Extra navigation intent for setView. */
export interface SetViewOptions {
  /** True when the navigation originates from a dashboard card/funnel click. */
  fromDashboard?: boolean;
  /** Set when the navigation originates from the Notifications or Audit Log page. */
  source?: NavSource;
}

/** A single record a list view should be narrowed to (set when opening a notification). */
export interface FocusedRecord {
  type: 'actionItem' | 'stakeholder';
  id: string;
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface CRMContextProps {
  // Data
  financialYears: FinancialYear[];
  financialCalendar: FinancialCalendar | null;
  adminSettings: AdminSettings | null;
  accounts: Account[];
  opportunities: Opportunity[];
  projects: Project[];
  actionItems: ActionItem[];
  stakeholders: Stakeholder[];
  activities: Activity[];
  comments: Comment[];
  loading: boolean;
  /** All system users as Service Provider options (no is_active filter). */
  serviceProviders: ServiceProviderUser[];
  /** Active System Users who hold the Project Manager role. */
  projectManagers: ServiceProviderUser[];

  // Auth
  currentUser: string;
  currentUserId: string;
  isLoggedIn: boolean;
  authLoading: boolean;
  currentUserProfile: UserProfile;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfilePicture: (dataUrl: string) => void;

  // RBAC — permission gating (source of truth is the backend; this mirrors it)
  /** The logged-in user's primary role key (e.g. 'admin', 'sales'), or null. */
  roleKey: string | null;
  /** Every role key the user holds (multi-role). */
  roleKeys: string[];
  /** Whether the effective-permissions fetch has completed at least once. */
  permissionsLoaded: boolean;
  /** True when the user is granted `${module}:${permission}`. */
  can: (module: string, permission: string) => boolean;
  /** Re-fetch the current user's effective permissions (after an admin edits the matrix). */
  refreshPermissions: () => Promise<void>;

  // Navigation
  currentView: ViewType;
  setView: (view: ViewType, opts?: SetViewOptions) => void;
  focusedRecord: FocusedRecord | null;
  setFocusedRecord: (focus: FocusedRecord | null) => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  selectedOpportunityId: string | null;
  setSelectedOpportunityId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  /** When true, the Opportunity Details view auto-opens its Create Project modal on mount (set by the list "Create Project" action, then cleared). */
  createProjectIntent: boolean;
  setCreateProjectIntent: (val: boolean) => void;
  oppDetailsSourceView: ViewType | null;
  setOppDetailsSourceView: (view: ViewType | null) => void;
  accountDetailsActiveTab: string;
  setAccountDetailsActiveTab: (tab: string) => void;
  cameFromDashboard: boolean;
  setCameFromDashboard: (val: boolean) => void;
  /** Page that triggered the current deep-link navigation (null when navigating normally). */
  navSource: NavSource | null;
  selectedStage: string;
  setSelectedStage: (stage: string) => void;
  /** Account Health filter applied to the Accounts list — driven by the filter dropdown or a dashboard drill-down. */
  selectedHealth: string;
  setSelectedHealth: (health: string) => void;
  dashboardStageHighlight: string;
  setDashboardStageHighlight: (stage: string) => void;
  /** True when the Action Items list should show only items due this week (dashboard drill-down). */
  dueThisWeekFilter: boolean;
  setDueThisWeekFilter: (val: boolean) => void;
  /** 'Open' | 'All' — status filter applied when drilling into Opportunities from a dashboard card. */
  dashboardOppStatusFilter: string;
  setDashboardOppStatusFilter: (val: string) => void;
  /** True when the Action Items list should show only non-completed items (dashboard "My Action Items" drill-down). */
  openActionItemsFilter: boolean;
  setOpenActionItemsFilter: (val: boolean) => void;
  /** True when the Action Items list should show only overdue items (dashboard "Overdue Tasks" drill-down). */
  overdueActionItemsFilter: boolean;
  setOverdueActionItemsFilter: (val: boolean) => void;

  // Global period filter
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  selectedQuarter: string;
  setSelectedQuarter: (quarter: string) => void;

  // Global Account Selector — scopes every module to a single account (or 'All').
  globalAccountId: string;
  setGlobalAccountId: (id: string) => void;

  // UI
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Re-read the signed-in user (/auth/me) so identity edits reflect immediately. */
  refreshCurrentUser: () => Promise<void>;

  // Custom columns
  accountColumns: CustomColumn[];
  opportunityColumns: CustomColumn[];
  actionItemColumns: CustomColumn[];
  performanceEvaluationColumns: CustomColumn[];
  addCustomColumn: (module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation', name: string, type: 'text' | 'number' | 'date' | 'boolean') => Promise<void>;
  deleteCustomColumn: (module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation', id: string) => Promise<void>;

  // Column configs
  accountsColumnConfig: ColumnConfig[];
  opportunitiesColumnConfig: ColumnConfig[];
  actionItemsColumnConfig: ColumnConfig[];
  performanceEvaluationColumnConfig: ColumnConfig[];
  updateColumnConfig: (module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation', config: ColumnConfig[]) => Promise<void>;
  resetColumnConfig: (module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation') => Promise<void>;

  // Notifications
  unreadNotificationCount: number;
  refreshUnreadCount: () => void;

  // CRUD
  loadConfig: () => Promise<void>;
  refreshData: () => Promise<void>;
  deactivatedAccounts: Account[];
  addAccount: (account: Omit<Account, 'id'>) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  restoreAccount: (id: string) => Promise<void>;
  deactivatedOpportunities: Opportunity[];
  addOpportunity: (opportunity: Omit<Opportunity, 'id'>) => Promise<Opportunity>;
  updateOpportunity: (opportunity: Opportunity) => Promise<void>;
  deleteOpportunity: (id: string) => Promise<void>;
  restoreOpportunity: (id: string) => Promise<void>;
  deactivatedProjects: Project[];
  addProject: (project: Omit<Project, 'id'>) => Promise<Project>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  /** Manually create a Project from a Won opportunity (user-initiated conversion). */
  createProjectFromOpportunity: (opportunityId: string, data: Partial<Project>) => Promise<Project>;
  /** Refetch one project — for writes that change it outside updateProject (e.g. a Health Tracker update). */
  refreshProject: (id: string) => Promise<void>;
  deactivatedActionItems: ActionItem[];
  addActionItem: (actionItem: Omit<ActionItem, 'id'>) => Promise<ActionItem>;
  updateActionItem: (actionItem: ActionItem) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;
  deactivatedStakeholders: Stakeholder[];
  addStakeholder: (stakeholder: Omit<Stakeholder, 'id'>) => Promise<Stakeholder>;
  updateStakeholder: (stakeholder: Stakeholder) => Promise<void>;
  deleteStakeholder: (id: string) => Promise<void>;
  associateServiceProvider: (userId: string, accountId: string) => Promise<void>;
  addComment: (targetType: Comment['targetType'], targetId: string, text: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
}

// ─── Context & Provider ───────────────────────────────────────────────────────

const CRMContext = createContext<CRMContextProps | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jwtUser, setJwtUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<string>(
    () => localStorage.getItem('crm_current_user') || 'User',
  );
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [myPermissions, setMyPermissions] = useState<MyPermissions | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);

  const loadPermissions = useCallback(async (): Promise<void> => {
    try {
      const perms = await rbacApi.getMyPermissions();
      setMyPermissions(perms);
    } catch {
      setMyPermissions(null);
    } finally {
      setPermissionsLoaded(true);
    }
  }, []);

  // ── Session restoration ──────────────────────────────────────────────────────
  // The axios interceptor automatically handles access token expiry by calling
  // /auth/refresh. If both tokens are invalid, it fires 'crm:auth:logout'.
  useEffect(() => {
    const restore = async () => {
      try {
        const user = await authApi.me();
        setJwtUser(user);
        setCurrentUser(user.name);
        setIsLoggedIn(true);
        await loadPermissions();
      } catch {
        // Not authenticated — show login screen
      } finally {
        setAuthLoading(false);
      }
    };
    restore();
  }, [loadPermissions]);

  // ── Force-logout from 401 interceptor ────────────────────────────────────────
  useEffect(() => {
    const onForceLogout = () => {
      setIsLoggedIn(false);
      setJwtUser(null);
      setMyPermissions(null);
      localStorage.removeItem('crm_current_user');
    };
    window.addEventListener('crm:auth:logout', onForceLogout);
    return () => window.removeEventListener('crm:auth:logout', onForceLogout);
  }, []);

  // Re-read the signed-in user so identity edits (e.g. from the Service Provider
  // profile modal) are reflected in the header/menu without a full reload.
  const refreshCurrentUser = useCallback(async (): Promise<void> => {
    try {
      const user = await authApi.me();
      setJwtUser(user);
      setCurrentUser(user.name);
    } catch {
      // Non-blocking: a failed refresh leaves the existing user state in place.
    }
  }, []);

  // ── Auth profile (no sensitive data exposed) ─────────────────────────────────
  const currentUserProfile: UserProfile = jwtUser
    ? { name: jwtUser.name, email: jwtUser.email, role: jwtUser.role, avatarUrl: jwtUser.avatarData || '' }
    : { name: currentUser, role: '', avatarUrl: '', email: '' };

  // ── Auth actions ──────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<void> => {
    const { user } = await authApi.login(email, password);
    // Tokens are set as HttpOnly cookies by the server — nothing stored here
    localStorage.setItem('crm_current_user', user.name);
    setJwtUser(user);
    setCurrentUser(user.name);
    setIsLoggedIn(true);
    await loadPermissions();
  };

  const register = async (name: string, email: string, password: string): Promise<void> => {
    // Creates account only — user must sign in manually afterward
    await authApi.register(name, email, password);
  };

  const logout = (): void => {
    // Best-effort: revoke refresh token server-side (clears cookies too)
    authApi.logout();
    localStorage.removeItem('crm_current_user');
    setIsLoggedIn(false);
    setJwtUser(null);
    setMyPermissions(null);
    setPermissionsLoaded(false);
  };

  // ── RBAC permission helper ───────────────────────────────────────────────────
  const permissionSet = useMemo(
    () => new Set(myPermissions?.permissions ?? []),
    [myPermissions],
  );
  const can = useCallback(
    (module: string, permission: string): boolean => permissionSet.has(`${module}:${permission}`),
    [permissionSet],
  );

  const updateProfilePicture = (dataUrl: string): void => {
    setJwtUser((prev) => (prev ? { ...prev, avatarData: dataUrl } : prev));
    authApi.updateAvatar(dataUrl).catch(console.error);
  };

  // ── Global reporting period selector ──────────────────────────────────────────
  // selectedYear = FY label (e.g. "2026-27") or "All". Never a raw start year.
  // Quarter definitions come from the selected FY's stored calendar (database-driven).
  // The selector affects REPORTING ONLY (forecasts, KPIs, dashboard analytics) —
  // operational data (accounts, opportunities, tasks, …) is never filtered by it.
  const [selectedYear, setSelectedYearState] = useState<string>(
    () => localStorage.getItem('crm_selected_year') ?? 'All',
  );

  const [selectedQuarter, setSelectedQuarterState] = useState<string>(
    () => localStorage.getItem('crm_selected_quarter') || 'All',
  );

  // ── Global Account Selector ──────────────────────────────────────────────────
  // Scopes every operational module (Dashboard, Accounts, Opportunities,
  // Stakeholders, Action Items, Reports) to a single account, or 'All'.
  const [globalAccountId, setGlobalAccountIdState] = useState<string>(
    () => localStorage.getItem('crm_global_account_id') ?? 'All',
  );

  // Derive the authenticated user's UUID (empty string when not logged in).
  const currentUserId = jwtUser?.id ?? '';

  // Operational data — independent of the reporting period selector.
  const crmData = useCRMData(currentUser, currentUserId, isLoggedIn);

  // ── Initial State Parsers (Deep Linking) ────────────────────────────────────
  const getInitialView = (): ViewType => {
    const path = window.location.pathname;
    if (path.startsWith('/accounts/')) return 'account-details';
    if (path.startsWith('/opportunities/')) {
      if (path.endsWith('/forecast')) return 'opportunity-forecast';
      return 'opportunity-details';
    }
    if (path.startsWith('/projects/')) return 'project-details';
    if (path === '/accounts') return 'accounts';
    if (path === '/opportunities') return 'opportunities';
    if (path === '/projects') return 'projects';
    if (path === '/action-items') return 'actionItems';
    if (path === '/stakeholders') return 'stakeholders';
    if (path === '/forecast') return 'forecast';
    if (path === '/reports') return 'reports';
    if (path === '/notifications') return 'notifications';
    if (path === '/administration') return 'administration';
    if (path === '/audit-log') return 'audit-log';
    if (path === '/performance') return 'performance-evaluation';
    return 'dashboard';
  };

  const getInitialId = (prefix: string): string | null => {
    const path = window.location.pathname;
    if (path.startsWith(prefix)) {
      const match = path.match(new RegExp(`^${prefix}([^/]+)`));
      return match ? match[1] : null;
    }
    return null;
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<ViewType>(getInitialView);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => getInitialId('/accounts/'));
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(() => getInitialId('/opportunities/'));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => getInitialId('/projects/'));
  const [createProjectIntent, setCreateProjectIntent] = useState<boolean>(false);
  const [oppDetailsSourceView, setOppDetailsSourceView] = useState<ViewType | null>(null);
  const [accountDetailsActiveTab, setAccountDetailsActiveTab] = useState<string>('overview');
  const [cameFromDashboard, setCameFromDashboard] = useState<boolean>(false);
  const [navSource, setNavSource] = useState<NavSource | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [selectedHealth, setSelectedHealth] = useState<string>('All');
  const [dashboardStageHighlight, setDashboardStageHighlight] = useState<string>('');
  const [dueThisWeekFilter, setDueThisWeekFilter] = useState<boolean>(false);
  const [dashboardOppStatusFilter, setDashboardOppStatusFilter] = useState<string>('All');
  const [openActionItemsFilter, setOpenActionItemsFilter] = useState<boolean>(false);
  const [overdueActionItemsFilter, setOverdueActionItemsFilter] = useState<boolean>(false);
  const [focusedRecord, setFocusedRecord] = useState<FocusedRecord | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(
    () => localStorage.getItem('crm_sidebar_collapsed') === 'true',
  );

  const [isServiceProviderProfileOpen, setServiceProviderProfileOpen] = useState<boolean>(false);
  const openServiceProviderProfile = () => setServiceProviderProfileOpen(true);
  const closeServiceProviderProfile = () => setServiceProviderProfileOpen(false);

  // Service Providers — all system users regardless of active status
  const [serviceProviders, setServiceProviders] = useState<ServiceProviderUser[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    serviceProvidersApi.getAll()
      .then(setServiceProviders)
      .catch(() => {}); // non-blocking
  }, [isLoggedIn]);

  // Project Managers — active users with the project-manager role
  const [projectManagers, setProjectManagers] = useState<ServiceProviderUser[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    projectManagersApi.getAll()
      .then(setProjectManagers)
      .catch(() => {}); // non-blocking
  }, [isLoggedIn]);

  const setSelectedYear = (year: string) => {
    setSelectedYearState(year);
    localStorage.setItem('crm_selected_year', year);
  };

  const setSelectedQuarter = (quarter: string) => {
    setSelectedQuarterState(quarter);
    localStorage.setItem('crm_selected_quarter', quarter);
  };

  const setGlobalAccountId = (id: string) => {
    setGlobalAccountIdState(id);
    localStorage.setItem('crm_global_account_id', id);
  };

  // Reset the global account filter if the persisted id no longer belongs to
  // the current user's accounts (e.g. the account was deactivated, or a
  // different user logged in on a shared browser).
  useEffect(() => {
    if (globalAccountId !== 'All' && !crmData.loading && !crmData.accounts.some(a => a.id === globalAccountId)) {
      setGlobalAccountId('All');
    }
  }, [crmData.accounts, crmData.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem('crm_sidebar_collapsed', String(collapsed));
  };

  const setView = (view: ViewType, opts?: SetViewOptions) => {
    // Drilling into a details view (or returning from one to its list) must not
    // discard the dashboard context, otherwise the back button disappears mid-flow.
    const detailsRoundTrip =
      view === 'account-details' ||
      view === 'opportunity-details' ||
      view === 'project-details' ||
      (view === 'accounts' && currentView === 'account-details') ||
      (view === 'opportunities' && currentView === 'opportunity-details') ||
      (view === 'projects' && currentView === 'project-details');

    if (opts?.fromDashboard) {
      // Navigation originating from a dashboard card/funnel keeps its drill-down
      // context so the target list shows the "Back to Dashboard" button.
      setCameFromDashboard(true);
    } else if (!detailsRoundTrip) {
      setCameFromDashboard(false);
      setDashboardStageHighlight('');
      setSelectedStage('All');
      setSelectedHealth('All');
      setDueThisWeekFilter(false);
      setDashboardOppStatusFilter('All');
      setOpenActionItemsFilter(false);
      setOverdueActionItemsFilter(false);
    }

    // Track which page triggered this navigation so target views can render
    // "Back to Notifications" / "Back to Audit Log" buttons.
    if (opts?.source) {
      setNavSource(opts.source);
    } else if (!detailsRoundTrip) {
      setNavSource(null);
    }

    // A notification-driven single-record focus never survives a navigation.
    // (Handlers that open a notification set the focus after calling setView.)
    setFocusedRecord(null);
    setCurrentView(view);
  };

  return (
    <CRMContext.Provider
      value={{
        ...crmData,
        currentUser,
        currentUserId,
        isLoggedIn,
        authLoading,
        currentUserProfile,
        login,
        register,
        logout,
        updateProfilePicture,
        roleKey: myPermissions?.roleKey ?? null,
        roleKeys: myPermissions?.roleKeys ?? [],
        permissionsLoaded,
        can,
        refreshPermissions: loadPermissions,
        currentView,
        setView,
        focusedRecord,
        setFocusedRecord,
        selectedAccountId,
        setSelectedAccountId,
        selectedOpportunityId,
        setSelectedOpportunityId,
        selectedProjectId,
        setSelectedProjectId,
        createProjectIntent,
        setCreateProjectIntent,
        oppDetailsSourceView,
        setOppDetailsSourceView,
        accountDetailsActiveTab,
        setAccountDetailsActiveTab,
        cameFromDashboard,
        setCameFromDashboard,
        navSource,
        selectedStage,
        setSelectedStage,
        selectedHealth,
        setSelectedHealth,
        dashboardStageHighlight,
        setDashboardStageHighlight,
        dueThisWeekFilter,
        setDueThisWeekFilter,
        dashboardOppStatusFilter,
        setDashboardOppStatusFilter,
        openActionItemsFilter,
        setOpenActionItemsFilter,
        overdueActionItemsFilter,
        setOverdueActionItemsFilter,
        selectedYear,
        setSelectedYear,
        selectedQuarter,
        setSelectedQuarter,
        globalAccountId,
        setGlobalAccountId,
        sidebarCollapsed,
        setSidebarCollapsed,
        refreshCurrentUser,
        serviceProviders,
        projectManagers,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = (): CRMContextProps => {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within a CRMProvider');
  return ctx;
};
