/**
 * Per-module import field schemas — the backend's authoritative definition of
 * the columns a bulk import accepts, their types, required-ness, allowed enum
 * values and formats. These mirror the columns in the client-generated import
 * template (`frontend/src/features/import-export/moduleConfigs.ts`); the two
 * must agree on headers, exactly as they already must for a single-record
 * create. Coercion + validation is driven from here by `runBulkValidate`.
 */
import type { ImportFieldDef } from '../../common/utils/bulk-validate.util';
import { AOP_YEAR_OPTIONS, SERVICE_LINE_OPTIONS } from '../../common/utils/dto-transforms.util';

// Enum option sets — kept in step with the Create DTO `@IsIn(...)` lists.
const ACCOUNT_TYPE = ['Internal', 'New', 'Non Strategic', 'Strategic'] as const;
const ACCOUNT_HEALTH = ['Green', 'Amber', 'Red'] as const;
const OPPORTUNITY_STAGE = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Hold', 'Lost'] as const;
const OPPORTUNITY_TYPE = ['Growth', 'Pursuit', 'Whitespace', 'New', 'Extension'] as const;
const SERVICE_LINE = SERVICE_LINE_OPTIONS;
const OPPORTUNITY_HEALTH = ['Green', 'Amber', 'Red'] as const;
const ACTION_ITEM_STATUS = ['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled'] as const;
const ACTION_ITEM_TYPE = ['Account mining', 'Proposals', 'Stakeholder connect'] as const;
const PRIORITY = ['High', 'Medium', 'Low'] as const;
const INFLUENCE = ['High', 'Medium', 'Low'] as const;
const RELATIONSHIP = ['Strong', 'Neutral', 'Weak'] as const;
const STAKEHOLDER_TYPE = ['CLIENT', 'SERVICE_PROVIDER'] as const;
const TOWER = ['Others', 'Tower 1', 'Tower 2'] as const;
const DELIVERY_MODEL = ['Staff Aug', 'Fixed Bid', 'Managed', 'Fixed Capacity', 'Others'] as const;
const BILLING_MODEL = ['T&M', 'Milestone Based', 'Monthly Fixed', 'Others'] as const;
const INDUSTRY = [
  'Accounting, Audit & Tax',
  'Automotive',
  'BFSI',
  'Construction & Engineering',
  'Energy & Utilities',
  'FinTech',
  'Healthcare',
  'Manufacturing',
  'Media & Entertainment',
  'Nonprofit & Associations',
  'Oil & Gas',
  'Others',
  'Professional Services',
  'Retail',
  'Technology & Software',
  'Telecommunications',
  'Transportation & Logistics',
  'Wearhouse management',
] as const;

export type IEModuleKey = 'accounts' | 'opportunities' | 'stakeholders' | 'actionItems';

export const ACCOUNT_FIELDS: ImportFieldDef[] = [
  { key: 'name', header: 'Account Name', headerAliases: ['Target Corporate Account', 'Account'], type: 'string', required: true },
  { key: 'type', header: 'Account Type', type: 'enum', options: ACCOUNT_TYPE, required: true },
  { key: 'health', header: 'Health', type: 'enum', options: ACCOUNT_HEALTH, required: true },
  { key: 'healthReason', header: 'Reason for Health', type: 'string' },
  { key: 'industry', header: 'Industry', type: 'enum', options: INDUSTRY, default: 'Others' },
  { key: 'revenue', header: 'Revenue', type: 'number', default: 0 },
  { key: 'location', header: 'Location', type: 'string' },
  { key: 'since', header: 'Customer Since', type: 'string' },
  { key: 'website', header: 'Website', type: 'string', format: 'website' },
  { key: 'phone', header: 'Phone', type: 'string', format: 'phone' },
  { key: 'email', header: 'Email', type: 'string', format: 'email' },
  { key: 'address', header: 'Address', type: 'string' },
  { key: 'description', header: 'Description', type: 'string' },
  { key: 'tower', header: 'Tower', type: 'enum', options: TOWER },
  { key: 'accountManagerId', header: 'Account Manager', type: 'reference', reference: 'user' },
  { key: 'practiceLeadId', header: 'Practice Lead', type: 'reference', reference: 'user' },
  { key: 'clientPartnerId', header: 'Client Partner', type: 'reference', reference: 'user' },
  { key: 'verticalHeadId', header: 'Vertical Head', type: 'reference', reference: 'user' },
];

export const OPPORTUNITY_FIELDS: ImportFieldDef[] = [
  { key: 'name', header: 'Opportunity Name', type: 'string', required: true },
  { key: 'accountId', header: 'Account', headerAliases: ['Target Corporate Account', 'Account Name'], type: 'reference', reference: 'account', required: true },
  { key: 'stage', header: 'Stage', type: 'enum', options: OPPORTUNITY_STAGE, default: 'Lead' },
  { key: 'value', header: 'Deal Value', type: 'number', default: 0 },
  { key: 'probability', header: 'Probability (%)', type: 'integer' },
  { key: 'crmValue', header: 'Forecast Value', type: 'number', default: 0 },
  { key: 'opportunityType', header: 'Category', type: 'enum', options: OPPORTUNITY_TYPE, required: true },
  { key: 'serviceLine', header: 'Service Line', type: 'enum', options: SERVICE_LINE, required: true },
  { key: 'aopAvailable', header: 'AOP Available', type: 'boolean', default: false },
  { key: 'aopYear', header: 'AOP Year', type: 'enum', options: AOP_YEAR_OPTIONS },
  { key: 'serviceProviderStakeholderId', header: 'Owner', headerAliases: ['Service Provider Stakeholder', 'Service Provider Owner', 'Owner Stakeholder'], type: 'reference', reference: 'user' },
  { key: 'allocationStartDate', header: 'Expected Project Start Date', headerAliases: ['Allocation Start Date', 'Project Start Date'], type: 'date' },
  { key: 'allocationEndDate', header: 'Expected Project End Date (Optional)', headerAliases: ['Allocation End Date', 'Expected Project End Date', 'Project End Date'], type: 'date' },
  { key: 'dealStartDate', header: 'Deal Start Date', type: 'date' },
  { key: 'dealCloseDate', header: 'Deal Close Date', type: 'date' },
  { key: 'nextStep', header: 'Next Step', type: 'string' },
  { key: 'risksAndDependencies', header: 'Risks & Dependencies', type: 'string' },
  { key: 'description', header: 'Description', type: 'string' },
  { key: 'opportunityHealth', header: 'Opportunity Health', type: 'enum', options: OPPORTUNITY_HEALTH },
  { key: 'location', header: 'Location', type: 'string' },
  { key: 'cost', header: 'Cost', type: 'number' },
  { key: 'grossMargin', header: 'Gross Margin (%)', type: 'number' },
  { key: 'priority', header: 'Priority', type: 'enum', options: PRIORITY },
  { key: 'deliveryModel', header: 'Delivery Model', type: 'enum', options: DELIVERY_MODEL },
  { key: 'billingModel', header: 'Billing Model', type: 'enum', options: BILLING_MODEL },
  { key: 'tower', header: 'Tower', type: 'enum', options: TOWER },
];

/**
 * AOP-year business rule (mirrors the DTO's ValidateIf + the UI). Format and
 * predefined-list membership are already enforced by the `enum` field
 * coercion above — this only covers the cross-field "required when available" rule.
 */
export function opportunityPostValidate(payload: Record<string, any>): string[] {
  const errors: string[] = [];
  if (payload.aopAvailable === true && !payload.aopYear) {
    errors.push('AOP Year is required when AOP Available is Yes');
  }
  return errors;
}

export const STAKEHOLDER_FIELDS: ImportFieldDef[] = [
  { key: 'name', header: 'Name', type: 'string', required: true },
  { key: 'accountId', header: 'Account', headerAliases: ['Account Name'], type: 'reference', reference: 'account', required: true },
  { key: 'stakeholderType', header: 'Stakeholder Type', headerAliases: ['Type'], type: 'enum', options: STAKEHOLDER_TYPE, required: true, default: 'CLIENT' },
  { key: 'influence', header: 'Influence Level', headerAliases: ['Influence'], type: 'enum', options: INFLUENCE, required: true },
  { key: 'relationship', header: 'Relationship', type: 'enum', options: RELATIONSHIP, required: true },
  { key: 'designation', header: 'Designation', type: 'string' },
  { key: 'department', header: 'Department', type: 'string' },
  { key: 'email', header: 'Email', type: 'string', format: 'email' },
  { key: 'phone', header: 'Phone', type: 'string', format: 'phone' },
  { key: 'linkedinProfileUrl', header: 'LinkedIn Profile URL', headerAliases: ['LinkedIn', 'LinkedIn Profile', 'LinkedIn URL'], type: 'string', format: 'website' },
];

export const ACTION_ITEM_FIELDS: ImportFieldDef[] = [
  { key: 'title', header: 'Task Title', headerAliases: ['Title', 'Task'], type: 'string', required: true },
  { key: 'accountId', header: 'Account', headerAliases: ['Account Name'], type: 'reference', reference: 'account', required: true },
  { key: 'ownerStakeholderId', header: 'Owner', headerAliases: ['Task Owner', 'Owner Stakeholder'], type: 'reference', reference: 'stakeholder', required: true },
  { key: 'priority', header: 'Priority', type: 'enum', options: PRIORITY, required: true },
  { key: 'status', header: 'Status', type: 'enum', options: ACTION_ITEM_STATUS, required: true },
  { key: 'actionItemType', header: 'Type', headerAliases: ['Action Item Type', 'Type of Action Item'], type: 'enum', options: ACTION_ITEM_TYPE },
  { key: 'projectId', header: 'Project', headerAliases: ['Project Name'], type: 'reference', reference: 'project' },
  { key: 'opportunityId', header: 'Opportunity', headerAliases: ['Opportunity Name'], type: 'reference', reference: 'opportunity' },
  { key: 'openDate', header: 'Open Date', type: 'date' },
  { key: 'dueDate', header: 'Due Date', type: 'date' },
  { key: 'notes', header: 'Description', headerAliases: ['Notes'], type: 'string' },
  { key: 'risksAndDependencies', header: 'Risks & Dependencies', type: 'string' },
  { key: 'completedDate', header: 'Completed Date', type: 'date' },
];

/**
 * The workbook's worksheets, in the fixed DEPENDENCY order they must always be
 * processed regardless of their position in the uploaded file: a parent
 * (Account) is created before the children (Stakeholder/Opportunity/Action
 * Item) that reference it, and an Opportunity before Action Items that link to
 * it. The Global Import/Export service iterates modules in exactly this order.
 */
export const MODULE_ORDER: IEModuleKey[] = ['accounts', 'stakeholders', 'opportunities', 'actionItems'];

export const FIELDS_BY_MODULE: Record<IEModuleKey, ImportFieldDef[]> = {
  accounts: ACCOUNT_FIELDS,
  stakeholders: STAKEHOLDER_FIELDS,
  opportunities: OPPORTUNITY_FIELDS,
  actionItems: ACTION_ITEM_FIELDS,
};

/** Human labels for a module key (used in audit rows and activity messages). */
export const MODULE_LABEL: Record<IEModuleKey, string> = {
  accounts: 'Accounts',
  stakeholders: 'Stakeholders',
  opportunities: 'Opportunities',
  actionItems: 'Action Items',
};
