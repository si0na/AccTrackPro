/** CRM entity type definitions for the NestJS backend. */

import { SERVICE_LINE_OPTIONS } from '../common/utils/dto-transforms.util';

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
  /** Ownership FKs driving role-based account visibility (joined names alongside). */
  accountManagerId?: string;
  accountManagerName?: string;
  practiceLeadId?: string;
  practiceLeadName?: string;
  clientPartnerId?: string;
  clientPartnerName?: string;
  verticalHeadId?: string;
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
  [key: string]: any;
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
  closeReason: string;
  /** Why the opportunity cannot currently progress; only meaningful while stage is 'Blocked'. Separate from risksAndDependencies. */
  blockedReason?: string;
  /** Why progress has been postponed; only meaningful while stage is 'Delayed'. Separate from risksAndDependencies. */
  delayedReason?: string;
  /** When the deal first reached a closed stage (Won/Lost); cleared if reopened. */
  closedAt?: string;
  tags: string[];
  team: string[];
  /** Derived (never stored): FY label computed from allocationEndDate via the configured Financial Calendar. */
  financialYear: string;
  /** Derived (never stored): quarter computed from allocationEndDate via the configured Financial Calendar. */
  quarter: string;
  clientStakeholderId?: string;
  /** Joined display fields (server-side); valid even when not eagerly requested. */
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
  // Persisted forecast + actuals (joined from opportunity_forecasts). Read-only
  // on this payload — edited via the dedicated opportunity-forecast endpoint.
  forecastDate?: string;
  forecastValue?: number;
  actualDate?: string;
  actualValue?: number;
  forecastRemarks?: string;
  forecastUpdatedAt?: string;
  [key: string]: any;
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
  [key: string]: any;
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
  /** Derived (never stored): FY label computed from dueDate via the configured Financial Calendar. */
  financialYear: string;
  /** Derived (never stored): quarter computed from dueDate via the configured Financial Calendar. */
  quarter: string;
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
  /** Set on auto-registered Service Provider stakeholders — links back to the user they represent. */
  userId?: string;
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
  text: string;
  timestamp: string;
}

export interface Document {
  id: string;
  accountId: string;
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

/** Shape of the persisted JSON database file */
export interface CRMDatabase {
  accounts: Account[];
  opportunities: Opportunity[];
  actionItems: ActionItem[];
  stakeholders: Stakeholder[];
  activities: Activity[];
  comments: Comment[];
  accountColumns: CustomColumn[];
  opportunityColumns: CustomColumn[];
  actionItemColumns: CustomColumn[];
  rawAccountsConfig: ColumnConfig[];
  rawOpportunitiesConfig: ColumnConfig[];
  rawActionItemsConfig: ColumnConfig[];
}

export type NotificationType =
  | 'Account' | 'Opportunity' | 'ActionItem' | 'Stakeholder'
  | 'Document' | 'Comment' | 'System';

export type NotificationEventType =
  | 'Created' | 'Updated' | 'Deactivated' | 'Restored'
  | 'Assigned' | 'StageChanged' | 'Uploaded' | 'CommentAdded'
  | 'StatusChanged' | 'Completed' | 'Registered' | 'ProfileUpdated' | 'FYCreated';

export type NotificationSeverity = 'Info' | 'Success' | 'Warning' | 'Error';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  eventType: NotificationEventType;
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
