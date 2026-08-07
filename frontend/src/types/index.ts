import type { SERVICE_LINE_OPTIONS } from '@/constants';

export type AccountType = 'Strategic' | 'Non Strategic' | 'New';
export type AccountHealth = 'Green' | 'Amber' | 'Red';
export type OpportunityStage =
  | 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Verbal Agreement' | 'Won'
  | 'Blocked' | 'Delayed' | 'Lost';
export type OpportunityType = 'Growth' | 'Pursuit' | 'Whitespace' | 'New' | 'Extension';
export type ServiceLine = (typeof SERVICE_LINE_OPTIONS)[number];
export type OpportunityHealth = 'Green' | 'Amber' | 'Red';
export type RevenueModel = 'T&E' | 'Fixed Bid' | 'Fixed Capacity' | 'Managed Services';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type ActionItemStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Completed' | 'Cancelled';
export type InfluenceLevel = 'High' | 'Medium' | 'Low';
export type RelationshipStatus = 'Strong' | 'Neutral' | 'Weak';
export type StakeholderType = 'CLIENT' | 'SERVICE_PROVIDER';
export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Cancelled';
export type ProjectMethodology = 'Agile' | 'Waterfall';
export type ProjectHealth = 'Green' | 'Amber' | 'Red';
export type MilestoneStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Delayed';
export type RiskStatus = 'Open' | 'Mitigated' | 'Closed' | 'Accepted';
export type AssumptionValidationStatus = 'Unvalidated' | 'Validated' | 'Invalidated';
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type DependencyStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  health: AccountHealth;
  owner: string;
  ownerId?: string;
  /** Role-ownership FKs driving account visibility (joined names alongside). */
  accountManagerId?: string | null;
  accountManagerName?: string;
  practiceLeadId?: string | null;
  practiceLeadName?: string;
  clientPartnerId?: string | null;
  clientPartnerName?: string;
  verticalHeadId?: string | null;
  verticalHeadName?: string;
  revenue: number;
  industry: string;
  since: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  location: string;
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
  value: number;
  probability: number;
  ownerId?: string;
  description: string;
  allocationStartDate: string;
  allocationEndDate: string;
  dealStartDate?: string;
  dealCloseDate?: string;
  crmValue: number;
  nextStep: string;
  /** Known risks or blocking dependencies for this opportunity. */
  risksAndDependencies: string;
  /** Why the deal was Won or Lost; required when the stage transitions to a closed state. */
  closeReason?: string;
  /** Why the opportunity cannot currently progress; only meaningful while stage is 'Blocked'. Separate from risksAndDependencies. */
  blockedReason?: string;
  /** Why progress has been postponed; only meaningful while stage is 'Delayed'. Separate from risksAndDependencies. */
  delayedReason?: string;
  /** When the deal first reached a closed stage (Won/Lost); cleared if reopened. Read-only. */
  closedAt?: string;
  tags: string[];
  team: string[];
  /** Read-only, derived by backend from allocationEndDate via the configured Financial Calendar. Never sent on create/update. */
  financialYear?: string;
  /** Read-only, derived by backend from allocationEndDate via the configured Financial Calendar. Never sent on create/update. */
  quarter?: string;
  clientStakeholderId?: string;
  /** Joined display fields (server-side). */
  clientStakeholderName?: string;
  clientStakeholderDesignation?: string;
  serviceProviderStakeholderId?: string;
  serviceProviderStakeholderName?: string;
  serviceProviderStakeholderDesignation?: string;
  opportunityType: OpportunityType;
  /** Whether this opportunity has an approved AOP (Annual Operating Plan) year. */
  aopAvailable: boolean;
  /** AOP year range in YYYY-YYYY format (e.g. "2026-2027"); only meaningful (and stored) when aopAvailable is true. */
  aopYear?: string | null;
  serviceLine?: ServiceLine;
  opportunityHealth?: OpportunityHealth;
  revenueModel?: RevenueModel;
  location?: string;
  cost?: number;
  grossMargin?: number;
  /** Linked Project id (joined server-side), populated once this opportunity has gone Won. Null when none exists. */
  projectId?: string | null;
  // ── Persisted forecast + actuals (joined server-side from opportunity_forecasts) ──
  // Read-only on the Opportunity object; edited via the Opportunity Forecast page.
  /** Forecast (expected) close date for the deal. */
  forecastDate?: string;
  /** Forecast (expected) deal value. */
  forecastValue?: number;
  /** Date the actual revenue was realised. */
  actualDate?: string;
  /** Actual realised revenue amount. */
  actualValue?: number;
  /** Optional remarks captured with the actuals. */
  forecastRemarks?: string;
  /** When the forecast record was last saved (ISO). */
  forecastUpdatedAt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Current forecast + actuals for a single opportunity (Opportunity Forecast page). */
export interface OpportunityForecast {
  opportunityId: string;
  accountId: string | null;
  forecastDate: string | null;
  forecastValue: number | null;
  actualDate: string | null;
  actualValue: number | null;
  remarks: string | null;
  updatedById: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** One forecast-revision snapshot in the audit trail. */
export interface OpportunityForecastHistoryEntry {
  id: string;
  forecastDate: string | null;
  forecastValue: number | null;
  updatedByName: string | null;
  updatedAt: string;
}

/** Full payload returned by the per-opportunity forecast endpoint. */
export interface OpportunityForecastResult {
  opportunity: Opportunity;
  forecast: OpportunityForecast | null;
  history: OpportunityForecastHistoryEntry[];
}

/** Editable payload sent when saving an opportunity's forecast card. */
export interface OpportunityForecastPayload {
  forecastDate?: string;
  forecastValue?: number;
  actualDate?: string;
  actualValue?: number;
  remarks?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  accountId: string;
  /** Parent account display name (joined server-side). */
  accountName?: string;
  /** Originating Opportunity — every project traces back to exactly one Won opportunity. */
  opportunityId: string;
  /** Joined display field (server-side) for the originating opportunity. */
  opportunityName?: string;
  ownerId?: string;
  /** Joined display field (server-side) for ownerId. */
  ownerName?: string;
  startDate?: string;
  endDate?: string;
  methodology: ProjectMethodology;
  /** Service Provider Project Manager — FK to users. */
  serviceProviderPmId?: string;
  serviceProviderPmName?: string;
  practiceLeadId?: string;
  practiceLeadName?: string;
  /** "Client Name" contact — FK to stakeholders. */
  clientStakeholderId?: string;
  clientStakeholderName?: string;
  clientStakeholderDesignation?: string;
  /** Client Project Manager — FK to stakeholders. */
  clientPmStakeholderId?: string;
  clientPmStakeholderName?: string;
  clientPmStakeholderDesignation?: string;
  status: ProjectStatus;
  health: ProjectHealth;
  asOnDate?: string;
  plannedCompletionPct?: number;
  actualCompletionPct?: number;
  plannedEffortHours?: number;
  actualEffortHours?: number;
  plannedCost?: number;
  actualCost?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ProjectHealthUpdate {
  id: string;
  projectId: string;
  health: ProjectHealth;
  statusSummary: string;
  keyAchievements?: string;
  currentChallenges?: string;
  risksImpactingHealth?: string;
  mitigationPlan?: string;
  supportRequired?: string;
  nextReviewDate?: string;
  overallConfidencePct?: number;
  reviewedById?: string;
  reviewedByName?: string;
  updatedById?: string;
  updatedByName?: string;
  createdAt: string;
}

export interface ProjectTeamMember {
  id: string;
  projectId: string;
  role: string;
  /** Free text — no FK to users, so external consultants/contractors can be entered. */
  employeeName: string;
  seniorityLevel?: string;
  location?: string;
  createdAt?: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  /** Essential planning fields captured on the simplified Create Milestone form. */
  milestoneNo?: string;
  activities?: string;
  deliverables?: string;
  acceptanceCriteria?: string;
  paymentTrigger?: string;
  /** Percentage of contract value released at this milestone (0–100). */
  paymentPct?: number;
  paymentAmount?: number;
  /** Planned target/due date (ISO yyyy-mm-dd). */
  targetDate?: string;
  /** Free text, e.g. "Sprint 3-4". */
  sprints?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  status: MilestoneStatus;
  remarks: string;
  effortPlanned?: number;
  effortSpent?: number;
  costPlanned?: number;
  costSpent?: number;
  completionPct?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectRisk {
  id: string;
  projectId: string;
  priority: PriorityLevel;
  description: string;
  impact?: string;
  likelihood?: string;
  severity?: string;
  /** FK to users. */
  ownerId?: string;
  /** Joined display field (server-side) for ownerId. */
  ownerName?: string;
  mitigationPlan: string;
  status: RiskStatus;
  targetResolutionDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectAssumption {
  id: string;
  projectId: string;
  priority: PriorityLevel;
  description: string;
  impactIfFalse?: string;
  validationStatus: AssumptionValidationStatus;
  /** FK to users. */
  ownerId?: string;
  /** Joined display field (server-side) for ownerId. */
  ownerName?: string;
  dateIdentified?: string;
  targetValidationDate?: string;
  remarks: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectIssue {
  id: string;
  projectId: string;
  priority: PriorityLevel;
  description: string;
  impact?: string;
  /** FK to users. */
  ownerId?: string;
  /** Joined display field (server-side) for ownerId. */
  ownerName?: string;
  dateIdentified?: string;
  status: IssueStatus;
  resolutionPlan: string;
  targetResolutionDate?: string;
  remarks: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectDependency {
  id: string;
  projectId: string;
  priority: PriorityLevel;
  description: string;
  dependencyType?: string;
  dependentTask?: string;
  /** FK to users. */
  ownerId?: string;
  /** Joined display field (server-side) for ownerId. */
  ownerName?: string;
  externalParty?: string;
  status: DependencyStatus;
  targetResolutionDate?: string;
  remarks: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  accountId: string;
  /** Parent account display name (joined server-side; valid even when the account is deactivated). */
  accountName?: string;
  opportunityId?: string;
  /** Linked Project (optional) — populated once the parent Opportunity has gone Won. */
  projectId?: string;
  /** Joined display field (server-side) for the linked Project. */
  projectName?: string;
  /** Legacy free-text owner name — read-only fallback for rows a stakeholder backfill couldn't resolve. */
  owner?: string;
  ownerId?: string;
  ownerStakeholderId?: string;
  /** Joined display fields (server-side); derived from the owner stakeholder. */
  ownerName?: string;
  ownerDesignation?: string;
  ownerStakeholderType?: StakeholderType;
  /** When the task was opened; defaults to the creation date but is user-editable. */
  openDate: string;
  dueDate: string;
  priority: PriorityLevel;
  status: ActionItemStatus;
  notes: string;
  /** Known risks or blocking dependencies for this action item. */
  risksAndDependencies: string;
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
  stakeholderType: StakeholderType;
  department?: string;
}

export interface Activity {
  id: string;
  type: 'account' | 'opportunity' | 'actionItem' | 'stakeholder' | 'general' | 'permission';
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
  roleId?: string | null;
  roleKey?: string | null;
  employeeId?: string | null;
  department?: string | null;
  designation?: string | null;
  avatarData: string;
  isActive: boolean;
}

// ── RBAC ────────────────────────────────────────────────────────────────────
export interface Role {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  accountScopeField: string | null;
}

export interface RbacModule {
  key: string;
  name: string;
  sortOrder: number;
}

export interface RbacPermission {
  key: string;
  name: string;
  sortOrder: number;
}

export interface PermissionMatrixCell {
  roleId: string;
  moduleKey: string;
  permissionKey: string;
  isAllowed: boolean;
  isLocked: boolean;
}

export interface PermissionMatrix {
  roles: Array<Pick<Role, 'id' | 'key' | 'name' | 'isSystem' | 'accountScopeField'>>;
  modules: RbacModule[];
  permissions: RbacPermission[];
  cells: PermissionMatrixCell[];
}

/** The logged-in user's effective permissions (drives menu/button gating). */
export interface MyPermissions {
  roleKey: string | null;
  roleName: string | null;
  /** Every role key the user holds (multi-role). */
  roleKeys: string[];
  accountScopeField: string | null;
  /** Every account ownership scope field across the user's roles. */
  accountScopeFields: string[];
  canViewAllAccounts: boolean;
  permissions: string[]; // `${moduleKey}:${permissionKey}`
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
    /** Sum of persisted actual revenue across the filtered opportunities. */
    actualRevenue: number;
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
  roleId?: string | null;
  roleKey?: string | null;
  roleName?: string | null;
  /** Every role the user holds (multi-role). */
  roleIds?: string[];
  roleKeys?: string[];
  employeeId?: string | null;
  department?: string | null;
  designation?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  failedAttempts?: number;
  lockedUntil?: string | null;
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
  /** Pre-assigned RBAC attributes applied at registration. */
  roleId?: string | null;
  employeeId?: string | null;
  department?: string | null;
  designation?: string | null;
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
