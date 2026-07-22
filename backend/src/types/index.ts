/** CRM entity type definitions for the NestJS backend. */

export type AccountType = 'Strategic' | 'Non Strategic' | 'New';
export type AccountHealth = 'Green' | 'Amber' | 'Red';
export type OpportunityStage =
  | 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Verbal Agreement' | 'Won'
  | 'Blocked' | 'Delayed' | 'Lost';
export type OpportunityType = 'Growth' | 'Pursuit' | 'Whitespace' | 'New' | 'Extension';
export type ServiceLine =
  | 'Data' | 'AI' | 'Cloud' | 'Application Development' | 'Application Support'
  | 'Infrastructure' | 'Cyber Security' | 'SharePoint';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type ActionItemStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Completed' | 'Cancelled';
export type InfluenceLevel = 'High' | 'Medium' | 'Low';
export type RelationshipStatus = 'Strong' | 'Neutral' | 'Weak';
export type StakeholderType = 'CLIENT' | 'SERVICE_PROVIDER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  health: AccountHealth;
  owner: string;
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
  closeDate: string;
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
  /** Derived (never stored): FY label computed from closeDate via the configured Financial Calendar. */
  financialYear: string;
  /** Derived (never stored): quarter computed from closeDate via the configured Financial Calendar. */
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
