export type AccountType = 'Growth' | 'Pursuit' | 'Project';
export type AccountHealth = 'Healthy' | 'At Risk' | 'Critical';
export type OpportunityStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won';
/** Lifecycle status: an opportunity stays operationally visible until it is closed (Won or Lost). */
export type OpportunityStatus = 'Open' | 'Won' | 'Lost';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type ActionItemStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Completed';
export type InfluenceLevel = 'High' | 'Medium' | 'Low';
export type RelationshipStatus = 'Strong' | 'Neutral' | 'Weak';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  health: AccountHealth;
  owner: string;
  ownerId?: string;
  revenue: number;
  industry: string;
  since: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  /** Read-only, set by backend — used for "Recently Updated Accounts". */
  updatedAt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface FinancialYearQuarter {
  label: string;     // "Q1", "Q2", "Q3", "Q4"
  startDate: string; // "2026-04-01"
  endDate: string;   // "2026-06-30"
}

export interface FinancialYear {
  id: string;
  fyLabel: string;   // "2026-27"
  startYear: number; // 2026
  startDate: string; // "2026-04-01"
  endDate: string;   // "2027-03-31"
  isActive: boolean;
  quarters: FinancialYearQuarter[];
  /** Calendar config that was active when this FY was created — never changes after creation. */
  calendarStartMonth: number;
  calendarQuarters: FYQuarterDef[];
}

export interface Opportunity {
  id: string;
  name: string;
  accountId: string;
  /** Parent account display name (joined server-side; valid even when the account is deactivated). */
  accountName?: string;
  stage: OpportunityStage;
  /** Lifecycle status — defaults to 'Open'; backend syncs 'Won' with the stage. */
  status: OpportunityStatus;
  value: number;
  probability: number;
  owner: string;
  ownerId?: string;
  closeDate: string;
  description: string;
  startDate: string;
  endDate: string;
  crmValue: number;
  nextStep: string;
  /** Why the deal was Won or Lost; required when the status transitions to a closed state. */
  closeReason?: string;
  /** When the deal first reached a closed status (Won/Lost); cleared if reopened. Read-only. */
  closedAt?: string;
  tags: string[];
  team: string[];
  /** Read-only, derived by backend from closeDate via the configured Financial Calendar. Never sent on create/update. */
  financialYear?: string;
  /** Read-only, derived by backend from closeDate via the configured Financial Calendar. Never sent on create/update. */
  quarter?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ActionItem {
  id: string;
  title: string;
  accountId: string;
  /** Parent account display name (joined server-side; valid even when the account is deactivated). */
  accountName?: string;
  opportunityId?: string;
  owner: string;
  ownerId?: string;
  dueDate: string;
  priority: PriorityLevel;
  status: ActionItemStatus;
  notes: string;
  completedDate?: string;
  /** Read-only, derived by backend from dueDate via the configured Financial Calendar. Never sent on create/update. */
  financialYear?: string;
  /** Read-only, derived by backend from dueDate via the configured Financial Calendar. Never sent on create/update. */
  quarter?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Stakeholder {
  id: string;
  name: string;
  accountId: string;
  /** Parent account display name (joined server-side; valid even when the account is deactivated). */
  accountName?: string;
  designation: string;
  influence: InfluenceLevel;
  relationship: RelationshipStatus;
  email: string;
  phone: string;
}

export interface Activity {
  id: string;
  type: 'account' | 'opportunity' | 'actionItem' | 'stakeholder' | 'general';
  text: string;
  timestamp: string;
  user: string;
  accountId?: string;
  opportunityId?: string;
}

export interface Comment {
  id: string;
  targetType: 'account' | 'opportunity' | 'actionItem';
  targetId: string;
  user: string;
  userId?: string;
  text: string;
  timestamp: string;
}

export interface Document {
  id: string;
  accountId: string;
  /** Set when the document is attached to an opportunity rather than the account itself. */
  opportunityId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface CustomColumn {
  id: string;
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
}

export interface ColumnConfig {
  key: string;
  name: string;
  isStandard: boolean;
  isPinned: boolean;
  isDisplayed: boolean;
  type: 'text' | 'number' | 'date' | 'boolean' | 'custom';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarData: string;
  isActive: boolean;
}

export type NotificationType =
  | 'Account' | 'Opportunity' | 'ActionItem' | 'Stakeholder'
  | 'Document' | 'Comment' | 'System';

export type NotificationSeverity = 'Info' | 'Success' | 'Warning' | 'Error';
export type NotificationCategory = 'BUSINESS' | 'SYSTEM';

export interface CRMNotification {
  id: string;
  userId: string;
  notificationCategory: NotificationCategory;
  type: NotificationType;
  eventType: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  accountId?: string;
  opportunityId?: string;
  actionItemId?: string;
  stakeholderId?: string;
  documentId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, any>;
}

export interface ForecastData {
  summary: {
    pipelineValue: number;
    forecastRevenue: number;
    committedForecast: number;
    bestCaseForecast: number;
    opportunityCount: number;
    winCount: number;
    avgDealSize: number;
  };
  byQuarter: Array<{
    quarter: string;
    pipelineValue: number;
    forecastRevenue: number;
  }>;
  byAccount: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
    pipelineValue: number;
    forecastRevenue: number;
    opportunityCount: number;
  }>;
  byStage: Array<{
    stage: string;
    count: number;
    pipelineValue: number;
    forecastRevenue: number;
  }>;
}

// ── Administration types ──────────────────────────────────────────────────────

export interface FYQuarterDef {
  label: string;      // "Q1"
  startMonth: number; // 1-12
  endMonth: number;   // 1-12
}

export interface FinancialCalendar {
  startMonth: number;   // 1-12 (default 4 = April)
  quarters: FYQuarterDef[];
  updatedAt?: string;
}

export interface AdminSystemOverview {
  totalUsers: number;
  totalAccounts: number;
  totalOpportunities: number;
  totalDocuments: number;
  totalNotifications: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

export interface AdminSettings {
  fySelectorCount: string; // numeric string, e.g. "5"
  [key: string]: string;
}

export interface EmployeeMaster {
  id: string;
  email: string;
  /** Display name — used by Performance Evaluations. */
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceEvaluation {
  id: string;
  account: string;
  project: string;
  /** FK to EmployeeMaster — only whitelisted employees can be evaluated. */
  employeeId?: string;
  /** Denormalized display name (kept in sync with the Employee Master). */
  employeeName: string;
  manager: string;
  month: string;
  hasReportees: boolean;
  deliveryExcellence: number;
  qualityStandards: number;
  technicalCapability: number;
  communication: number;
  sla: number;
  teamCollaboration: number;
  reliability: number;
  innovation: number;
  ideation: number;
  behavioural: number;
  leadership?: number;
  customerFeedback: string;
  employeeFeedback: string;
  trainingRequired: string;
  strength: string;
  improvementArea: string;
  keyContributionDetails: string;
  ideaDetails: string;
  overallComment: string;
  actionItemNextMonth: string;
  retentionRisk: 'High' | 'Medium' | 'Low';
  createdAt?: string;
  updatedAt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  accountId?: string;
  accountName?: string;
  opportunityId?: string;
  opportunityName?: string;
  actionItemId?: string;
  actionItemTitle?: string;
  dueDate?: string;
  createdAt: string;
}
