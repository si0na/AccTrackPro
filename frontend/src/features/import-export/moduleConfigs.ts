import {
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_HEALTH_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  OPPORTUNITY_TYPE_OPTIONS,
  SERVICE_LINE_OPTIONS,
  ACTION_ITEM_STATUS_OPTIONS,
} from '@/constants';
import { STAKEHOLDER_TYPE_LABELS } from '@/components/ui';
import type { IEModuleKey, ModuleIEConfig, RefData } from './types';

const PRIORITY = ['High', 'Medium', 'Low'] as const;
const INFLUENCE = ['High', 'Medium', 'Low'] as const;
const RELATIONSHIP = ['Strong', 'Neutral', 'Weak'] as const;
const STAKEHOLDER_TYPES = ['CLIENT', 'SERVICE_PROVIDER'] as const;

const accName = (id: string, ref: RefData) => ref.accounts.find((a) => a.id === id)?.name ?? '';
const oppName = (id: string, ref: RefData) => ref.opportunities.find((o) => o.id === id)?.name ?? '';

// ─── Accounts ─────────────────────────────────────────────────────────────────
const accountsConfig: ModuleIEConfig = {
  moduleKey: 'accounts',
  label: 'Accounts',
  singular: 'Account',
  duplicateKeyLabel: 'Account Name (case-insensitive)',
  fields: [
    { key: 'name', header: 'Account Name', type: 'string', required: true, example: 'Acme Corporation' },
    { key: 'type', header: 'Account Type', type: 'enum', options: ACCOUNT_TYPE_OPTIONS, required: true, example: 'Strategic' },
    { key: 'health', header: 'Health', type: 'enum', options: ACCOUNT_HEALTH_OPTIONS, required: true, example: 'Green' },
    { key: 'industry', header: 'Industry', type: 'string', default: '', example: 'Technology' },
    { key: 'revenue', header: 'Revenue', type: 'number', default: 0, example: '0', hint: 'Auto-calculated from opportunities; leave as 0' },
    { key: 'location', header: 'Location', type: 'string', example: 'United States' },
    { key: 'since', header: 'Customer Since', type: 'string', example: '2021' },
    { key: 'website', header: 'Website', type: 'string', format: 'website', example: 'www.acme.com' },
    { key: 'phone', header: 'Phone', type: 'string', format: 'phone', example: '+1 555 0100' },
    { key: 'email', header: 'Email', type: 'string', format: 'email', example: 'contact@acme.com' },
    { key: 'address', header: 'Address', type: 'string' },
    { key: 'description', header: 'Description', type: 'string' },
  ],
  exportColumns: [
    { key: 'name', header: 'Account Name', value: (e) => e.name ?? '' },
    { key: 'type', header: 'Account Type', value: (e) => e.type ?? '' },
    { key: 'health', header: 'Health', value: (e) => e.health ?? '' },
    { key: 'industry', header: 'Industry', value: (e) => e.industry ?? '' },
    { key: 'owner', header: 'Owner', value: (e) => e.owner ?? '' },
    { key: 'status', header: 'Status', value: (e) => e.status ?? 'Active' },
    { key: 'revenue', header: 'Revenue', value: (e) => e.revenue ?? 0 },
    { key: 'location', header: 'Location', value: (e) => e.location ?? '' },
    { key: 'since', header: 'Customer Since', value: (e) => e.since ?? '' },
    { key: 'website', header: 'Website', value: (e) => e.website ?? '' },
    { key: 'phone', header: 'Phone', value: (e) => e.phone ?? '' },
    { key: 'email', header: 'Email', value: (e) => e.email ?? '' },
    { key: 'address', header: 'Address', value: (e) => e.address ?? '' },
    { key: 'description', header: 'Description', value: (e) => e.description ?? '' },
  ],
};

// ─── Opportunities ──────────────────────────────────────────────────────────
const opportunitiesConfig: ModuleIEConfig = {
  moduleKey: 'opportunities',
  label: 'Opportunities',
  singular: 'Opportunity',
  duplicateKeyLabel: 'Opportunity Name + Account',
  fields: [
    { key: 'name', header: 'Opportunity Name', type: 'string', required: true, example: 'Acme Platform Upgrade' },
    { key: 'accountId', header: 'Account', type: 'reference', reference: 'account', required: true, example: 'Acme Corporation', hint: 'Must match an account in the Accounts sheet or an existing account' },
    { key: 'stage', header: 'Stage', type: 'enum', options: OPPORTUNITY_STAGE_OPTIONS, default: 'Lead', example: 'Qualified' },
    { key: 'value', header: 'Deal Value', type: 'number', default: 0, example: '50000' },
    { key: 'probability', header: 'Probability (%)', type: 'integer', example: '25', hint: '0–100' },
    { key: 'crmValue', header: 'Forecast Value', type: 'number', default: 0, example: '45000' },
    { key: 'opportunityType', header: 'Opportunity Type', type: 'enum', options: OPPORTUNITY_TYPE_OPTIONS, required: true, example: 'Growth' },
    { key: 'serviceLine', header: 'Service Line', type: 'enum', options: SERVICE_LINE_OPTIONS, required: true, example: 'Cloud' },
    { key: 'aopAvailable', header: 'AOP Available', type: 'boolean', default: false, example: 'No' },
    { key: 'aopYear', header: 'AOP Year', type: 'string', example: '2026-2027', hint: 'YYYY-YYYY; required when AOP Available is Yes' },
    { key: 'startDate', header: 'Start Date', type: 'date', example: '2026-01-15' },
    { key: 'closeDate', header: 'Close Date', type: 'date', example: '2026-06-30' },
    { key: 'endDate', header: 'End Date', type: 'date' },
    { key: 'nextStep', header: 'Next Step', type: 'string' },
    { key: 'risksAndDependencies', header: 'Risks & Dependencies', type: 'string' },
    { key: 'description', header: 'Description', type: 'string' },
  ],
  exportColumns: [
    { key: 'name', header: 'Opportunity Name', value: (e) => e.name ?? '' },
    { key: 'accountId', header: 'Account', value: (e, ref) => e.accountName ?? accName(e.accountId, ref) },
    { key: 'stage', header: 'Stage', value: (e) => e.stage ?? '' },
    { key: 'value', header: 'Deal Value', value: (e) => e.value ?? 0 },
    { key: 'probability', header: 'Probability (%)', value: (e) => e.probability ?? 0 },
    { key: 'crmValue', header: 'Forecast Value', value: (e) => e.crmValue ?? 0 },
    { key: 'opportunityType', header: 'Opportunity Type', value: (e) => e.opportunityType ?? '' },
    { key: 'serviceLine', header: 'Service Line', value: (e) => e.serviceLine ?? '' },
    { key: 'aopAvailable', header: 'AOP Available', value: (e) => (e.aopAvailable ? 'Yes' : 'No') },
    { key: 'aopYear', header: 'AOP Year', value: (e) => e.aopYear ?? '' },
    { key: 'startDate', header: 'Start Date', value: (e) => e.startDate ?? '' },
    { key: 'closeDate', header: 'Close Date', value: (e) => e.closeDate ?? '' },
    { key: 'endDate', header: 'End Date', value: (e) => e.endDate ?? '' },
    { key: 'financialYear', header: 'Financial Year', value: (e) => e.financialYear ?? '' },
    { key: 'quarter', header: 'Quarter', value: (e) => e.quarter ?? '' },
    { key: 'nextStep', header: 'Next Step', value: (e) => e.nextStep ?? '' },
    { key: 'risksAndDependencies', header: 'Risks & Dependencies', value: (e) => e.risksAndDependencies ?? '' },
    { key: 'description', header: 'Description', value: (e) => e.description ?? '' },
  ],
};

// ─── Stakeholders ─────────────────────────────────────────────────────────────
const stakeholdersConfig: ModuleIEConfig = {
  moduleKey: 'stakeholders',
  label: 'Stakeholders',
  singular: 'Stakeholder',
  duplicateKeyLabel: 'Email + Account',
  fields: [
    { key: 'name', header: 'Name', type: 'string', required: true, example: 'Jane Doe' },
    { key: 'accountId', header: 'Account', type: 'reference', reference: 'account', required: true, example: 'Acme Corporation', hint: 'Must match an account in the Accounts sheet or an existing account' },
    {
      key: 'stakeholderType', header: 'Stakeholder Type', type: 'enum', options: STAKEHOLDER_TYPES, required: true,
      aliases: { client: 'CLIENT', 'service provider': 'SERVICE_PROVIDER', 'service-provider': 'SERVICE_PROVIDER', serviceprovider: 'SERVICE_PROVIDER' },
      example: 'CLIENT', hint: 'CLIENT or SERVICE_PROVIDER',
    },
    { key: 'influence', header: 'Influence', type: 'enum', options: INFLUENCE, required: true, example: 'High' },
    { key: 'relationship', header: 'Relationship', type: 'enum', options: RELATIONSHIP, required: true, example: 'Strong' },
    { key: 'designation', header: 'Designation', type: 'string', example: 'CTO' },
    { key: 'department', header: 'Department', type: 'string', example: 'Engineering' },
    { key: 'email', header: 'Email', type: 'string', format: 'email', example: 'jane@acme.com', hint: 'Unique within the account' },
    { key: 'phone', header: 'Phone', type: 'string', format: 'phone' },
  ],
  exportColumns: [
    { key: 'name', header: 'Name', value: (e) => e.name ?? '' },
    { key: 'accountId', header: 'Account', value: (e, ref) => e.accountName ?? accName(e.accountId, ref) },
    { key: 'stakeholderType', header: 'Stakeholder Type', value: (e) => STAKEHOLDER_TYPE_LABELS[e.stakeholderType as keyof typeof STAKEHOLDER_TYPE_LABELS] ?? e.stakeholderType ?? '' },
    { key: 'influence', header: 'Influence', value: (e) => e.influence ?? '' },
    { key: 'relationship', header: 'Relationship', value: (e) => e.relationship ?? '' },
    { key: 'designation', header: 'Designation', value: (e) => e.designation ?? '' },
    { key: 'department', header: 'Department', value: (e) => e.department ?? '' },
    { key: 'email', header: 'Email', value: (e) => e.email ?? '' },
    { key: 'phone', header: 'Phone', value: (e) => e.phone ?? '' },
  ],
};

// ─── Action Items ─────────────────────────────────────────────────────────────
const actionItemsConfig: ModuleIEConfig = {
  moduleKey: 'actionItems',
  label: 'Action Items',
  singular: 'Action Item',
  duplicateKeyLabel: 'Title + Account',
  fields: [
    { key: 'title', header: 'Title', type: 'string', required: true, example: 'Follow up on proposal' },
    { key: 'accountId', header: 'Account', type: 'reference', reference: 'account', required: true, example: 'Acme Corporation', hint: 'Must match an account in the Accounts sheet or an existing account' },
    { key: 'owner', header: 'Owner', type: 'string', required: true, example: 'John Smith' },
    { key: 'priority', header: 'Priority', type: 'enum', options: PRIORITY, required: true, example: 'High' },
    { key: 'status', header: 'Status', type: 'enum', options: ACTION_ITEM_STATUS_OPTIONS, required: true, example: 'To Do' },
    { key: 'opportunityId', header: 'Opportunity', type: 'reference', reference: 'opportunity', hint: 'Optional; must belong to the same account (Opportunities sheet or existing)' },
    { key: 'openDate', header: 'Open Date', type: 'date', example: '2026-01-10' },
    { key: 'dueDate', header: 'Due Date', type: 'date', example: '2026-02-10' },
    { key: 'notes', header: 'Description', type: 'string' },
    { key: 'risksAndDependencies', header: 'Risks & Dependencies', type: 'string' },
    { key: 'completedDate', header: 'Completed Date', type: 'date' },
  ],
  exportColumns: [
    { key: 'title', header: 'Title', value: (e) => e.title ?? '' },
    { key: 'accountId', header: 'Account', value: (e, ref) => e.accountName ?? accName(e.accountId, ref) },
    { key: 'owner', header: 'Owner', value: (e) => e.owner ?? '' },
    { key: 'priority', header: 'Priority', value: (e) => e.priority ?? '' },
    { key: 'status', header: 'Status', value: (e) => e.status ?? '' },
    { key: 'opportunityId', header: 'Opportunity', value: (e, ref) => (e.opportunityId ? oppName(e.opportunityId, ref) : '') },
    { key: 'openDate', header: 'Open Date', value: (e) => e.openDate ?? '' },
    { key: 'dueDate', header: 'Due Date', value: (e) => e.dueDate ?? '' },
    { key: 'notes', header: 'Description', value: (e) => e.notes ?? '' },
    { key: 'risksAndDependencies', header: 'Risks & Dependencies', value: (e) => e.risksAndDependencies ?? '' },
    { key: 'completedDate', header: 'Completed Date', value: (e) => e.completedDate ?? '' },
    { key: 'financialYear', header: 'Financial Year', value: (e) => e.financialYear ?? '' },
    { key: 'quarter', header: 'Quarter', value: (e) => e.quarter ?? '' },
  ],
};

export const IE_CONFIGS: Record<IEModuleKey, ModuleIEConfig> = {
  accounts: accountsConfig,
  opportunities: opportunitiesConfig,
  stakeholders: stakeholdersConfig,
  actionItems: actionItemsConfig,
};
