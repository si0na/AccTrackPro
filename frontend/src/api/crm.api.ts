import apiClient from './apiClient';
import type {
  Account, Opportunity, ActionItem, Stakeholder,
  Activity, Comment, ColumnConfig, CustomColumn, User, Document, FinancialYear,
  CRMNotification, Alert, ForecastData,
  AdminSystemOverview, AdminUser, FinancialCalendar, AdminSettings, FYQuarterDef,
  PerformanceEvaluation, EmployeeMaster, Project, ProjectTeamMember,
  ProjectMilestone, ProjectRisk, ProjectAssumption, ProjectIssue, ProjectDependency,
  OpportunityForecastResult, OpportunityForecastPayload,
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

/** Bulk-import duplicate handling — mirrors the backend DuplicateMode. */
export type DuplicateMode = 'skip' | 'update' | 'create-new';

export interface BulkRowResult {
  index: number;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  id?: string;
  message?: string;
}

export interface BulkImportOutcome {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: BulkRowResult[];
}

/** Per-row verdict returned by the backend dry-run validation endpoint. */
export interface ValidatedImportRow {
  index: number;
  rowNumber: number;
  status: 'valid' | 'invalid' | 'duplicate';
  errors: string[];
  existsInSystem: boolean;
  fileDupGroup: string | null;
  payload: Record<string, any>;
  refNames: Record<string, string>;
}

/** Aggregate result of a bulk validation dry-run (drives the import preview grid). */
export interface BulkValidationResult {
  rows: ValidatedImportRow[];
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesExisting: number;
  importable: number;
  missingRequiredColumns: string[];
  unknownColumns: string[];
}

/** The four modules that share the single Import/Export workbook. */
export type IEModuleKey = 'accounts' | 'stakeholders' | 'opportunities' | 'actionItems';

/** One parsed worksheet posted for validation. */
export interface WorkbookSheet {
  rows: Record<string, any>[];
  headers: string[];
}
export type WorkbookSheets = Partial<Record<IEModuleKey, WorkbookSheet>>;
/** Per-module dry-run verdicts returned by POST /import-export/validate. */
export type WorkbookValidation = Partial<Record<IEModuleKey, BulkValidationResult>>;
/** Kept-row payloads per module, posted to POST /import-export/import. */
export type WorkbookImportRequest = Partial<Record<IEModuleKey, Record<string, any>[]>>;
/** Per-module commit outcomes returned by POST /import-export/import. */
export type WorkbookImportResult = Partial<Record<IEModuleKey, BulkImportOutcome>>;

/** A single row of the Import/Export audit trail. */
export interface ImportExportAuditRow {
  id: string;
  userId?: string;
  userName?: string;
  module: string;
  action: 'import' | 'export';
  fileFormat?: string;
  totalRecords: number;
  createdRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  status: string;
  createdAt: string;
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

export const opportunityForecastApi = {
  /** GET /api/opportunity-forecast/:id — forecast + actuals + revision history for one opportunity. */
  get: (opportunityId: string) =>
    apiClient.get<OpportunityForecastResult>(`/opportunity-forecast/${opportunityId}`).then((r) => r.data),
  /** PUT /api/opportunity-forecast/:id — upsert the forecast card (forecast + actuals). */
  upsert: (opportunityId: string, data: OpportunityForecastPayload) =>
    apiClient.put<OpportunityForecastResult>(`/opportunity-forecast/${opportunityId}`, data).then((r) => r.data),
};

export const actionItemsApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<ActionItem[]>('/action-items', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<ActionItem[]>('/action-items/deactivated', { params: f }).then((r) => r.data),
  create: (data: Omit<ActionItem, 'id'>) => apiClient.post<ActionItem>('/action-items', data).then((r) => r.data),
  update: (id: string, data: ActionItem) => apiClient.put<ActionItem>(`/action-items/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/action-items/${id}`).then((r) => r.data),
};

export const projectsApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<Project[]>('/projects', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<Project[]>('/projects/deactivated', { params: f }).then((r) => r.data),
  getById: (id: string) => apiClient.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: Omit<Project, 'id'>) => apiClient.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: Project) => apiClient.put<Project>(`/projects/${id}`, data).then((r) => r.data),
  restore: (id: string) => apiClient.patch<Project>(`/projects/${id}/restore`).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/projects/${id}`).then((r) => r.data),
};

export const projectTeamApi = {
  getAll: (projectId: string) =>
    apiClient.get<ProjectTeamMember[]>(`/projects/${projectId}/team`).then((r) => r.data),
  create: (projectId: string, data: Omit<ProjectTeamMember, 'id' | 'projectId'>) =>
    apiClient.post<ProjectTeamMember>(`/projects/${projectId}/team`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: Omit<ProjectTeamMember, 'id' | 'projectId'>) =>
    apiClient.put<ProjectTeamMember>(`/projects/${projectId}/team/${id}`, data).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/team/${id}`).then((r) => r.data),
};

export const projectMilestonesApi = {
  getAllForProject: (projectId: string) =>
    apiClient.get<ProjectMilestone[]>(`/projects/${projectId}/milestones`).then((r) => r.data),
  create: (projectId: string, data: Omit<ProjectMilestone, 'id' | 'projectId'>) =>
    apiClient.post<ProjectMilestone>(`/projects/${projectId}/milestones`, data).then((r) => r.data),
  // Update*Dto requires `id` in the body (validated but otherwise unused —
  // the service updates the row addressed by the URL param), so it's sent here.
  update: (projectId: string, id: string, data: Omit<ProjectMilestone, 'id' | 'projectId'>) =>
    apiClient.put<ProjectMilestone>(`/projects/${projectId}/milestones/${id}`, { ...data, id }).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/milestones/${id}`).then((r) => r.data),
};

export const projectRisksApi = {
  getAllForProject: (projectId: string) =>
    apiClient.get<ProjectRisk[]>(`/projects/${projectId}/risks`).then((r) => r.data),
  create: (projectId: string, data: Omit<ProjectRisk, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.post<ProjectRisk>(`/projects/${projectId}/risks`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: Omit<ProjectRisk, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.put<ProjectRisk>(`/projects/${projectId}/risks/${id}`, { ...data, id }).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/risks/${id}`).then((r) => r.data),
};

export const projectAssumptionsApi = {
  getAllForProject: (projectId: string) =>
    apiClient.get<ProjectAssumption[]>(`/projects/${projectId}/assumptions`).then((r) => r.data),
  create: (projectId: string, data: Omit<ProjectAssumption, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.post<ProjectAssumption>(`/projects/${projectId}/assumptions`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: Omit<ProjectAssumption, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.put<ProjectAssumption>(`/projects/${projectId}/assumptions/${id}`, { ...data, id }).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/assumptions/${id}`).then((r) => r.data),
};

export const projectIssuesApi = {
  getAllForProject: (projectId: string) =>
    apiClient.get<ProjectIssue[]>(`/projects/${projectId}/issues`).then((r) => r.data),
  create: (projectId: string, data: Omit<ProjectIssue, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.post<ProjectIssue>(`/projects/${projectId}/issues`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: Omit<ProjectIssue, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.put<ProjectIssue>(`/projects/${projectId}/issues/${id}`, { ...data, id }).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/issues/${id}`).then((r) => r.data),
};

export const projectDependenciesApi = {
  getAllForProject: (projectId: string) =>
    apiClient.get<ProjectDependency[]>(`/projects/${projectId}/dependencies`).then((r) => r.data),
  create: (projectId: string, data: Omit<ProjectDependency, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.post<ProjectDependency>(`/projects/${projectId}/dependencies`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: Omit<ProjectDependency, 'id' | 'projectId' | 'ownerName'>) =>
    apiClient.put<ProjectDependency>(`/projects/${projectId}/dependencies/${id}`, { ...data, id }).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete<{ success: boolean }>(`/projects/${projectId}/dependencies/${id}`).then((r) => r.data),
};

export const stakeholdersApi = {
  getAll: (f?: OwnerFilter) => apiClient.get<Stakeholder[]>('/stakeholders', { params: f }).then((r) => r.data),
  getDeactivated: (f?: OwnerFilter) => apiClient.get<Stakeholder[]>('/stakeholders/deactivated', { params: f }).then((r) => r.data),
  create: (data: Omit<Stakeholder, 'id'>) => apiClient.post<Stakeholder>('/stakeholders', data).then((r) => r.data),
  update: (id: string, data: Stakeholder) => apiClient.put<Stakeholder>(`/stakeholders/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete<{ success: boolean }>(`/stakeholders/${id}`).then((r) => r.data),
};

/**
 * Global Import/Export — one workbook, four worksheets. The client parses the
 * .xlsx into per-module rows; the backend validates every populated worksheet
 * (in dependency order, resolving cross-sheet parents), then commits the kept
 * rows. Exports are generated client-side and reported here for the audit trail.
 */
export const importExportApi = {
  validate: (sheets: WorkbookSheets) =>
    apiClient.post<WorkbookValidation>('/import-export/validate', { sheets }).then((r) => r.data),
  importWorkbook: (modules: WorkbookImportRequest, duplicateMode: DuplicateMode = 'skip') =>
    apiClient.post<WorkbookImportResult>('/import-export/import', { modules, duplicateMode }).then((r) => r.data),
  logExport: (modules: { module: IEModuleKey; count: number }[]) =>
    apiClient
      .post<{ success: boolean }>('/import-export/export-log', { modules })
      .then((r) => r.data)
      .catch(() => ({ success: false })), // audit logging must never block the download
  getAudit: () => apiClient.get<ImportExportAuditRow[]>('/import-export/audit').then((r) => r.data),
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
