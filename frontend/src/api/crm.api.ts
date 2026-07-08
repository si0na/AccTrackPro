import apiClient from './apiClient';
import type {
  Account, Opportunity, ActionItem, Stakeholder,
  Activity, Comment, ColumnConfig, CustomColumn, User, Document, FinancialYear,
  CRMNotification, Alert, ForecastData,
  AdminSystemOverview, AdminUser, FinancialCalendar, AdminSettings, FYQuarterDef,
  PerformanceEvaluation, EmployeeMaster,
} from '@/types';

/** Owner scoping only — for entities that are never fiscal-period-filtered. */
export interface OwnerFilter {
  userId?: string; // Authenticated user UUID (replaces display-name 'owner')
}

/**
 * Reporting filter: the Global Period Selector plus owner scoping. Sent only
 * to reporting endpoints (analytics/forecast), where the fiscal period is
 * derived from business dates via the configured Financial Calendar.
 * Operational endpoints (accounts, opportunities, action items, stakeholders,
 * documents, notifications, activities) never receive fiscal-period params.
 */
export interface PeriodFilter extends OwnerFilter {
  financialYear?: string;
  quarter?: string;
}

/**
 * Server-side pagination envelope. List endpoints return a plain array by
 * default; sending ?page=&pageSize= opts in to this shape instead.
 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const accountsApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<Account[]>('/accounts', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<Account[]>('/accounts/deactivated', { params: f }).then((r) => r.data),
  getById: (id: string) => apiClient.get<Account>(`/accounts/${id}`).then((r) => r.data),
  create: (data: Omit<Account, 'id'>) => apiClient.post<Account>('/accounts', data).then((r) => r.data),
  update: (id: string, data: Account) => apiClient.put<Account>(`/accounts/${id}`, data).then((r) => r.data),
  restore: (id: string) => apiClient.patch<Account>(`/accounts/${id}/restore`).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/accounts/${id}`).then((r) => r.data),
};

export const opportunitiesApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<Opportunity[]>('/opportunities', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<Opportunity[]>('/opportunities/deactivated', { params: f }).then((r) => r.data),
  create: (data: Omit<Opportunity, 'id'>) => apiClient.post<Opportunity>('/opportunities', data).then((r) => r.data),
  update: (id: string, data: Opportunity) => apiClient.put<Opportunity>(`/opportunities/${id}`, data).then((r) => r.data),
  restore: (id: string) => apiClient.patch<Opportunity>(`/opportunities/${id}/restore`).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/opportunities/${id}`).then((r) => r.data),
};

export const actionItemsApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<ActionItem[]>('/action-items', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<ActionItem[]>('/action-items/deactivated', { params: f }).then((r) => r.data),
  create: (data: Omit<ActionItem, 'id'>) => apiClient.post<ActionItem>('/action-items', data).then((r) => r.data),
  update: (id: string, data: ActionItem) => apiClient.put<ActionItem>(`/action-items/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/action-items/${id}`).then((r) => r.data),
};

export const stakeholdersApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<Stakeholder[]>('/stakeholders', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<Stakeholder[]>('/stakeholders/deactivated', { params: f }).then((r) => r.data),
  create: (data: Omit<Stakeholder, 'id'>) => apiClient.post<Stakeholder>('/stakeholders', data).then((r) => r.data),
  update: (id: string, data: Stakeholder) => apiClient.put<Stakeholder>(`/stakeholders/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/stakeholders/${id}`).then((r) => r.data),
};

export const activitiesApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<Activity[]>('/activities', { params: f }).then((r) => r.data),
  /** Server-side pagination — newest first. */
  getPage: (page: number, pageSize = 50) =>
    apiClient.get<Paginated<Activity>>('/activities', { params: { page, pageSize } }).then((r) => r.data),
  create: (data: Omit<Activity, 'id' | 'timestamp'>) =>
    apiClient.post<Activity>('/activities', data).then((r) => r.data),
};

export const commentsApi = {
  getAll: () => apiClient.get<Comment[]>('/comments').then((r) => r.data),
  create: (data: Omit<Comment, 'id' | 'timestamp'>) =>
    apiClient.post<Comment>('/comments', data).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/comments/${id}`).then((r) => r.data),
};

export const customColumnsApi = {
  getAll: () =>
    apiClient
      .get<{ accountColumns: CustomColumn[]; opportunityColumns: CustomColumn[]; actionItemColumns: CustomColumn[]; performanceEvaluationColumns: CustomColumn[] }>(
        '/custom-columns',
      )
      .then((r) => r.data),
  create: (data: { module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation'; name: string; type: 'text' | 'number' | 'date' | 'boolean' }) =>
    apiClient.post<CustomColumn>('/custom-columns', data).then((r) => r.data),
  delete: (module: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/custom-columns/${module}/${id}`).then((r) => r.data),
};

export const financialYearsApi = {
  getAll: () => apiClient.get<FinancialYear[]>('/financial-years').then((r) => r.data),
  create: (data: { startYear: number }, userId?: string) =>
    apiClient.post<FinancialYear>('/financial-years', data, { params: userId ? { userId } : undefined }).then((r) => r.data),
  activate:       (id: string) => apiClient.patch<FinancialYear>(`/financial-years/${id}/activate`).then((r) => r.data),
  deactivate:     (id: string) => apiClient.patch<FinancialYear>(`/financial-years/${id}/deactivate`).then((r) => r.data),
  updateCalendar: (id: string, data: { startMonth: number; quarters: FYQuarterDef[] }) =>
    apiClient.patch<FinancialYear>(`/financial-years/${id}/calendar`, data).then((r) => r.data),
};

export const administrationApi = {
  getSystemOverview:        () =>
    apiClient.get<AdminSystemOverview>('/administration/system-overview').then((r) => r.data),
  getUsers:                 () =>
    apiClient.get<AdminUser[]>('/administration/users').then((r) => r.data),
  getFinancialCalendar:     () =>
    apiClient.get<FinancialCalendar>('/administration/financial-calendar').then((r) => r.data),
  updateFinancialCalendar:  (data: FinancialCalendar) =>
    apiClient.put<FinancialCalendar>('/administration/financial-calendar', data).then((r) => r.data),
  getSettings:              () =>
    apiClient.get<AdminSettings>('/administration/settings').then((r) => r.data),
  updateSettings:           (data: Partial<AdminSettings>) =>
    apiClient.put<AdminSettings>('/administration/settings', data).then((r) => r.data),
};

export const columnConfigsApi = {
  getAll: () =>
    apiClient
      .get<{ rawAccountsConfig: ColumnConfig[]; rawOpportunitiesConfig: ColumnConfig[]; rawActionItemsConfig: ColumnConfig[]; rawPerformanceEvaluationConfig: ColumnConfig[] }>(
        '/column-configs',
      )
      .then((r) => r.data),
  save: (data: { rawAccountsConfig?: ColumnConfig[]; rawOpportunitiesConfig?: ColumnConfig[]; rawActionItemsConfig?: ColumnConfig[]; rawPerformanceEvaluationConfig?: ColumnConfig[] }) =>
    apiClient.post<{ success: boolean }>('/column-configs', data).then((r) => r.data),
};

/** A document is attached to exactly one business entity. */
export interface DocumentTarget {
  accountId?: string;
  opportunityId?: string;
}

export const documentsApi = {
  getByAccount: (accountId: string) =>
    apiClient.get<Document[]>(`/documents?accountId=${accountId}`).then((r) => r.data),

  getByOpportunity: (opportunityId: string) =>
    apiClient.get<Document[]>(`/documents?opportunityId=${opportunityId}`).then((r) => r.data),

  getByTarget: (target: DocumentTarget) =>
    target.opportunityId
      ? documentsApi.getByOpportunity(target.opportunityId)
      : documentsApi.getByAccount(target.accountId ?? ''),

  upload: async (target: DocumentTarget, file: File, uploadedBy: string): Promise<Document> => {
    const fd = new FormData();
    fd.append('file', file);
    if (target.opportunityId) fd.append('opportunityId', target.opportunityId);
    else if (target.accountId) fd.append('accountId', target.accountId);
    fd.append('uploadedBy', uploadedBy);
    // Use native fetch so the browser sets Content-Type: multipart/form-data with the
    // correct boundary automatically — Axios's instance-level 'application/json' default
    // header overrides the multipart header and breaks multer parsing on the server.
    const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
    const res = await fetch(`${baseURL}/documents`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) throw { response: { data: json } };
    return json as Document;
  },

  /**
   * Fetch the file contents as a Blob through the authenticated API client,
   * so viewing/downloading benefits from auth cookies, silent token refresh,
   * and the configured VITE_API_URL base — unlike a raw window.open('/api/…').
   */
  getFileBlob: (id: string) =>
    apiClient
      .get<Blob>(`/documents/${id}/download`, { responseType: 'blob' })
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/documents/${id}`).then((r) => r.data),
};

// ── Auth API ──────────────────────────────────────────────────────────────────
// Tokens are managed as HttpOnly cookies — the API layer never handles them.

export const authApi = {
  /** Sets crm_access + crm_refresh cookies; returns { user } (no token in body) */
  login: (email: string, password: string) =>
    apiClient.post<{ user: User }>('/auth/login', { email, password }).then((r) => r.data),

  /** Creates account; caller must redirect to login separately */
  register: (name: string, email: string, password: string, avatarData?: string) =>
    apiClient.post<User>('/auth/register', { name, email, password, avatarData }).then((r) => r.data),

  /** Returns current user from cookie session */
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),

  /** Silently rotates access + refresh token pair (called by interceptor) */
  refresh: () => apiClient.post('/auth/refresh'),

  /** Revokes refresh token server-side and clears cookies */
  logout: () => apiClient.post('/auth/logout').catch(() => { /* best-effort */ }),

  updateAvatar: (avatarData: string) =>
    apiClient.put<User>('/auth/me/avatar', { avatarData }).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { token, newPassword }),
};

export const notificationsApi = {
  // Notifications are scoped by the auth cookie server-side — no query params.
  getAll: () =>
    apiClient.get<CRMNotification[]>('/notifications').then((r) => r.data),

  /** Server-side pagination — newest first. Optional index-backed filters. */
  getPage: (page: number, pageSize = 50, filters?: { category?: 'BUSINESS' | 'SYSTEM'; unread?: boolean }) =>
    apiClient.get<Paginated<CRMNotification>>('/notifications', {
      params: {
        page,
        pageSize,
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.unread ? { unread: 'true' } : {}),
      },
    }).then((r) => r.data),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),

  markRead: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.patch<{ success: boolean }>('/notifications/read-all', null).then((r) => r.data),

  clearRead: () =>
    apiClient.delete<{ success: boolean }>('/notifications/clear-read').then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/notifications/${id}`).then((r) => r.data),
};

export const alertsApi = {
  getAll: (f?: OwnerFilter) =>
    apiClient.get<Alert[]>('/alerts', { params: f }).then((r) => r.data),
};

export const analyticsApi = {
  /** GET /api/analytics/forecast — all metrics computed server-side; fiscal period derived from close dates */
  getForecast: (f?: PeriodFilter & { accountId?: string }) =>
    apiClient.get<ForecastData>('/analytics/forecast', { params: f }).then((r) => r.data),
};

export const employeeMasterApi = {
  getAll: () =>
    apiClient.get<EmployeeMaster[]>('/employee-master').then((r) => r.data),
  create: (email: string, name?: string) =>
    apiClient.post<EmployeeMaster>('/employee-master', { email, name }).then((r) => r.data),
  update: (id: string, email: string, name?: string) =>
    apiClient.put<EmployeeMaster>(`/employee-master/${id}`, { email, name }).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/employee-master/${id}`).then((r) => r.data),
};

/** Per-employee aggregates for the Performance Evaluation reporting header. */
export interface PerformanceEvaluationSummaryRow {
  employeeId?: string;
  employeeName: string;
  evaluations: number;
  averageScore: number;
  latestMonth: string;
  latestRetentionRisk: 'High' | 'Medium' | 'Low';
}

export const performanceEvaluationsApi = {
  getAll: (f?: OwnerFilter) =>
    apiClient.get<PerformanceEvaluation[]>('/performance-evaluations', { params: f }).then((r) => r.data),
  getById: (id: string) =>
    apiClient.get<PerformanceEvaluation>(`/performance-evaluations/${id}`).then((r) => r.data),
  create: (data: Omit<PerformanceEvaluation, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<PerformanceEvaluation>('/performance-evaluations', data).then((r) => r.data),
  update: (id: string, data: Omit<PerformanceEvaluation, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiClient.put<PerformanceEvaluation>(`/performance-evaluations/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/performance-evaluations/${id}`).then((r) => r.data),
  summary: () =>
    apiClient.get<PerformanceEvaluationSummaryRow[]>('/performance-evaluations/summary').then((r) => r.data),
};
