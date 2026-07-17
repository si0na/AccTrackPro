import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCRMData } from '@/hooks/useCRMData';
import { authApi } from '@/api/crm.api';
import type {
  Account, Opportunity, ActionItem, Stakeholder, Activity, Comment, CustomColumn, ColumnConfig,
  User, FinancialYear, FinancialCalendar, AdminSettings,
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
  | 'actionItems'
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
  actionItems: ActionItem[];
  stakeholders: Stakeholder[];
  activities: Activity[];
  comments: Comment[];
  loading: boolean;

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

  // Navigation
  currentView: ViewType;
  setView: (view: ViewType, opts?: SetViewOptions) => void;
  focusedRecord: FocusedRecord | null;
  setFocusedRecord: (focus: FocusedRecord | null) => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  selectedOpportunityId: string | null;
  setSelectedOpportunityId: (id: string | null) => void;
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

  // UI
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

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
  deactivatedActionItems: ActionItem[];
  addActionItem: (actionItem: Omit<ActionItem, 'id'>) => Promise<ActionItem>;
  updateActionItem: (actionItem: ActionItem) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;
  deactivatedStakeholders: Stakeholder[];
  addStakeholder: (stakeholder: Omit<Stakeholder, 'id'>) => Promise<Stakeholder>;
  updateStakeholder: (stakeholder: Stakeholder) => Promise<void>;
  deleteStakeholder: (id: string) => Promise<void>;
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
      } catch {
        // Not authenticated — show login screen
      } finally {
        setAuthLoading(false);
      }
    };
    restore();
  }, []);

  // ── Force-logout from 401 interceptor ────────────────────────────────────────
  useEffect(() => {
    const onForceLogout = () => {
      setIsLoggedIn(false);
      setJwtUser(null);
      localStorage.removeItem('crm_current_user');
    };
    window.addEventListener('crm:auth:logout', onForceLogout);
    return () => window.removeEventListener('crm:auth:logout', onForceLogout);
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
  };

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

  // Derive the authenticated user's UUID (empty string when not logged in).
  const currentUserId = jwtUser?.id ?? '';

  // Operational data — independent of the reporting period selector.
  const crmData = useCRMData(currentUser, currentUserId, isLoggedIn);

  // ── Navigation state ──────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
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

  const setSelectedYear = (year: string) => {
    setSelectedYearState(year);
    localStorage.setItem('crm_selected_year', year);
  };

  const setSelectedQuarter = (quarter: string) => {
    setSelectedQuarterState(quarter);
    localStorage.setItem('crm_selected_quarter', quarter);
  };

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
      (view === 'accounts' && currentView === 'account-details') ||
      (view === 'opportunities' && currentView === 'opportunity-details');

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
        currentView,
        setView,
        focusedRecord,
        setFocusedRecord,
        selectedAccountId,
        setSelectedAccountId,
        selectedOpportunityId,
        setSelectedOpportunityId,
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
        sidebarCollapsed,
        setSidebarCollapsed,
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
