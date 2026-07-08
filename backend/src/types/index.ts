/** CRM entity type definitions for the NestJS backend. */

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
  revenue: number;
  industry: string;
  since: string;
  website: string;
  phone: string;
  email: string;
  address: string;
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
  status: OpportunityStatus;
  value: number;
  probability: number;
  owner: string;
  closeDate: string;
  description: string;
  startDate: string;
  endDate: string;
  crmValue: number;
  nextStep: string;
  /** Why the deal was Won or Lost; required when the status transitions to a closed state. */
  closeReason: string;
  /** When the deal first reached a closed status (Won/Lost); cleared if reopened. */
  closedAt?: string;
  tags: string[];
  team: string[];
  /** Derived (never stored): FY label computed from closeDate via the configured Financial Calendar. */
  financialYear: string;
  /** Derived (never stored): quarter computed from closeDate via the configured Financial Calendar. */
  quarter: string;
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
  dueDate: string;
  priority: PriorityLevel;
  status: ActionItemStatus;
  notes: string;
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
