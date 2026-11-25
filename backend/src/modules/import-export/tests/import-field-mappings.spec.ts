import {
  ACCOUNT_FIELDS,
  OPPORTUNITY_FIELDS,
  STAKEHOLDER_FIELDS,
  PROJECT_FIELDS,
  ACTION_ITEM_FIELDS,
  PROJECT_ACTION_ITEM_FIELDS,
  FIELDS_BY_MODULE,
  MODULE_ORDER,
  opportunityPostValidate,
  projectPostValidate,
} from '../import-field-schemas';
import {
  coerceAndValidateRow,
  runBulkValidate,
  normalizeHeader,
} from '../../../common/utils/bulk-validate.util';
import { validateDto } from '../../../common/utils/validate-dto.util';
import { CreateAccountDto } from '../../accounts/dto/account.dto';
import { CreateOpportunityDto } from '../../opportunities/dto/opportunity.dto';
import { CreateStakeholderDto } from '../../stakeholders/dto/stakeholder.dto';
import { CreateProjectDto } from '../../projects/dto/project.dto';
import { CreateActionItemDto } from '../../action-items/dto/action-item.dto';

describe('Import Field-to-Database Column Mapping Across All CRM Modules', () => {
  // Verified columns from live PostgreSQL database schema
  const DB_SCHEMA = {
    accounts: [
      'id', 'name', 'type', 'health', 'owner', 'revenue', 'industry', 'since',
      'website', 'phone', 'email', 'address', 'description', 'custom_data',
      'is_deleted', 'created_at', 'updated_at', 'owner_id', 'location',
      'account_manager_id', 'practice_lead_id', 'client_partner_id',
      'vertical_head_id', 'tower', 'health_reason',
    ],
    opportunities: [
      'id', 'name', 'account_id', 'stage', 'value', 'probability',
      'allocation_end_date', 'crm_value', 'description', 'next_step',
      'tags', 'team', 'custom_data', 'is_deleted', 'created_at', 'updated_at',
      'owner_id', 'close_reason', 'closed_at', 'client_stakeholder_id',
      'service_provider_stakeholder_id', 'aop_available', 'aop_year',
      'opportunity_type', 'service_line', 'risks_and_dependencies',
      'blocked_reason', 'delayed_reason', 'deal_start_date', 'deal_close_date',
      'allocation_start_date', 'opportunity_health', 'revenue_model', 'location',
      'cost', 'gross_margin', 'service_provider_pm_id', 'priority',
      'delivery_model', 'billing_model', 'tower',
    ],
    stakeholders: [
      'id', 'name', 'account_id', 'designation', 'influence', 'relationship',
      'email', 'phone', 'is_deleted', 'created_at', 'updated_at',
      'stakeholder_type', 'department', 'user_id', 'employee_id',
      'linkedin_profile_url', 'primary_owner_id', 'secondary_owner_id', 'tertiary_owner_id',
    ],
    projects: [
      'id', 'name', 'description', 'account_id', 'opportunity_id', 'owner_id',
      'start_date', 'end_date', 'methodology', 'service_provider_pm_id',
      'practice_lead_id', 'client_partner_id', 'client_pm_name', 'status',
      'health', 'as_on_date', 'planned_completion_pct', 'actual_completion_pct',
      'planned_effort_hours', 'actual_effort_hours', 'planned_cost', 'actual_cost',
      'custom_data', 'deal_value', 'priority', 'delivery_model', 'billing_model',
      'tower', 'is_deleted', 'created_at', 'updated_at',
    ],
    action_items: [
      'id', 'title', 'account_id', 'opportunity_id', 'owner', 'due_date',
      'priority', 'status', 'notes', 'completed_date', 'custom_data',
      'is_deleted', 'created_at', 'updated_at', 'owner_id', 'open_date',
      'risks_and_dependencies', 'owner_stakeholder_id', 'project_id',
      'action_item_type', 'next_action', 'impediments', 'action_item_number',
    ],
  };

  // Field key to snake_case column mapping verification
  const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

  describe('1. Schema & Column Mapping Integrity', () => {
    it('defines the 6 bulk import modules in dependency order', () => {
      expect(MODULE_ORDER).toEqual(['accounts', 'stakeholders', 'opportunities', 'projects', 'actionItems', 'projectActionItems']);
    });

    it('all Account import fields map to existing columns in the accounts table', () => {
      for (const field of ACCOUNT_FIELDS) {
        const col = toSnakeCase(field.key);
        expect(DB_SCHEMA.accounts).toContain(col);
      }
    });

    it('all Opportunity import fields map to existing columns in the opportunities table', () => {
      for (const field of OPPORTUNITY_FIELDS) {
        const col = toSnakeCase(field.key);
        expect(DB_SCHEMA.opportunities).toContain(col);
      }
    });

    it('all Stakeholder import fields map to existing columns in the stakeholders table', () => {
      for (const field of STAKEHOLDER_FIELDS) {
        const col = toSnakeCase(field.key);
        expect(DB_SCHEMA.stakeholders).toContain(col);
      }
    });

    it('all Project import fields map to existing columns in the projects table', () => {
      for (const field of PROJECT_FIELDS) {
        const col = toSnakeCase(field.key);
        expect(DB_SCHEMA.projects).toContain(col);
      }
    });

    it('all Action Item import fields map to existing columns in the action_items table and do NOT contain projectId', () => {
      for (const field of ACTION_ITEM_FIELDS) {
        const col = toSnakeCase(field.key);
        expect(DB_SCHEMA.action_items).toContain(col);
      }
      expect(ACTION_ITEM_FIELDS.some((f) => f.key === 'projectId')).toBe(false);
    });

    it('all Project Action Item import fields map to existing columns in the action_items table and require projectId', () => {
      for (const field of PROJECT_ACTION_ITEM_FIELDS) {
        const col = toSnakeCase(field.key);
        expect(DB_SCHEMA.action_items).toContain(col);
      }
      const projectField = PROJECT_ACTION_ITEM_FIELDS.find((f) => f.key === 'projectId');
      expect(projectField).toBeDefined();
      expect(projectField!.required).toBe(true);
      expect(projectField!.reference).toBe('project');
    });
  });

  describe('2. Account Import & Tower Default Validation', () => {
    it('successfully validates account payload when Tower is provided', async () => {
      const row = {
        'Account Name': 'Acme Corp',
        'Account Type': 'Strategic',
        'Health': 'Green',
        'Tower': 'Tower 1',
        'Industry': 'BFSI',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, ACCOUNT_FIELDS, headerMap);

      expect(errors).toHaveLength(0);
      expect(payload.tower).toBe('Tower 1');
      expect(payload.industry).toBe('BFSI');

      const dtoErrors = await validateDto(CreateAccountDto, payload);
      expect(dtoErrors).toHaveLength(0);
    });

    it('defaults Tower to "Others" when Tower column is omitted or empty', async () => {
      const row = {
        'Account Name': 'Beta Innovations',
        'Account Type': 'New',
        'Health': 'Amber',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, ACCOUNT_FIELDS, headerMap);

      expect(errors).toHaveLength(0);
      expect(payload.tower).toBe('Others');
      expect(payload.industry).toBe('Others'); // industry default is also Others

      const dtoErrors = await validateDto(CreateAccountDto, payload);
      expect(dtoErrors).toHaveLength(0);
    });

    it('supports Account Name header aliases like "Target Corporate Account"', () => {
      const row = {
        'Target Corporate Account': 'Alias Corp',
        'Account Type': 'Strategic',
        'Health': 'Green',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, ACCOUNT_FIELDS, headerMap);

      expect(errors).toHaveLength(0);
      expect(payload.name).toBe('Alias Corp');
    });

    it('rejects invalid enum values for Account Type and Health', () => {
      const row = {
        'Account Name': 'Invalid Corp',
        'Account Type': 'NotAnAccountType',
        'Health': 'SuperGreen',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { errors } = coerceAndValidateRow(row, ACCOUNT_FIELDS, headerMap);

      expect(errors.some((e) => e.includes('Account Type'))).toBe(true);
      expect(errors.some((e) => e.includes('Health'))).toBe(true);
    });
  });

  describe('3. Opportunity Import & Owner Resolution', () => {
    it('coerces and validates a complete opportunity record', async () => {
      const row = {
        'Opportunity Name': 'Cloud Migration',
        'Account': 'Acme Corp',
        'Category': 'Growth',
        'Service Line': 'Cloud',
        'Stage': 'Proposal',
        'Deal Value': '75000',
        'Probability (%)': '50',
        'Owner': 'Jane Smith',
        'Expected Project Start Date': '2026-03-01',
        'AOP Available': 'Yes',
        'AOP Year': '2026-2027',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, OPPORTUNITY_FIELDS, headerMap);

      expect(errors).toHaveLength(0);
      expect(payload.name).toBe('Cloud Migration');
      expect(payload.value).toBe(75000);
      expect(payload.probability).toBe(50);
      expect(payload.aopAvailable).toBe(true);
      expect(payload.aopYear).toBe('2026-2027');
      expect(payload.serviceProviderStakeholderId).toBe('Jane Smith'); // captured for resolver
    });

    it('enforces AOP Year required when AOP Available is Yes', () => {
      const payloadMissingYear = {
        aopAvailable: true,
      };
      const errors = opportunityPostValidate(payloadMissingYear);
      expect(errors).toContain('AOP Year is required when AOP Available is Yes');

      const payloadWithYear = {
        aopAvailable: true,
        aopYear: '2026-2027',
      };
      expect(opportunityPostValidate(payloadWithYear)).toHaveLength(0);
    });

    it('passes CreateOpportunityDto validation when serviceProviderStakeholderId is provided', async () => {
      const validPayload = {
        name: 'Digital Transformation',
        accountId: 'acc-uuid-1234',
        stage: 'Qualified',
        opportunityType: 'Growth',
        serviceLine: 'Cloud',
        serviceProviderStakeholderId: 'usr-uuid-5678', // ID after resolution
      };
      const dtoErrors = await validateDto(CreateOpportunityDto, validPayload);
      expect(dtoErrors).toHaveLength(0);
    });
  });

  describe('4. Stakeholder Import Field Mappings & Validation', () => {
    it('correctly maps all stakeholder attributes and validates types', async () => {
      const row = {
        'Name': 'John Executive',
        'Account': 'Acme Corp',
        'Stakeholder Type': 'CLIENT',
        'Influence Level': 'High',
        'Relationship': 'Strong',
        'Designation': 'VP of Engineering',
        'Department': 'Technology',
        'Email': 'john.exec@acme.com',
        'Phone': '+1 555 9876',
        'LinkedIn Profile URL': 'https://linkedin.com/in/johnexec',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, STAKEHOLDER_FIELDS, headerMap);

      expect(errors).toHaveLength(0);
      expect(payload.name).toBe('John Executive');
      expect(payload.influence).toBe('High');
      expect(payload.relationship).toBe('Strong');
      expect(payload.email).toBe('john.exec@acme.com');
      expect(payload.linkedinProfileUrl).toBe('https://linkedin.com/in/johnexec');

      const dtoErrors = await validateDto(CreateStakeholderDto, payload);
      expect(dtoErrors).toHaveLength(0);
    });

    it('rejects invalid email address and invalid LinkedIn URL', () => {
      const row = {
        'Name': 'Bad Data',
        'Account': 'Acme Corp',
        'Influence Level': 'High',
        'Relationship': 'Strong',
        'Email': 'not-an-email',
        'LinkedIn Profile URL': 'not a url',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { errors } = coerceAndValidateRow(row, STAKEHOLDER_FIELDS, headerMap);

      expect(errors.some((e) => e.includes('valid email'))).toBe(true);
      expect(errors.some((e) => e.includes('valid URL'))).toBe(true);
    });
  });

  describe('5. Action Items Import Field Mappings & Validation', () => {
    it('correctly maps task attributes, dates, and references', async () => {
      const row = {
        'Task Title': 'Schedule Quarterly Business Review',
        'Account': 'Acme Corp',
        'Owner': 'Jane Smith',
        'Priority': 'High',
        'Status': 'To Do',
        'Type': 'Review',
        'Open Date': '2026-02-01',
        'Due Date': '2026-02-15',
        'Description': 'Prepare slide deck for client executives',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, ACTION_ITEM_FIELDS, headerMap);

      expect(errors).toHaveLength(0);
      expect(payload.title).toBe('Schedule Quarterly Business Review');
      expect(payload.ownerStakeholderId).toBe('Jane Smith');
      expect(payload.priority).toBe('High');
      expect(payload.status).toBe('To Do');
      expect(payload.actionItemType).toBe('Review');
      expect(payload.openDate).toBe('2026-02-01');
      expect(payload.dueDate).toBe('2026-02-15');
      expect(payload.notes).toBe('Prepare slide deck for client executives');

      const dtoErrors = await validateDto(CreateActionItemDto, {
        ...payload,
        accountId: 'acc-uuid-1234',
        ownerStakeholderId: 'stk-uuid-5678',
      });
      expect(dtoErrors).toHaveLength(0);
    });

    it('rejects invalid action item status and priority', () => {
      const row = {
        'Task Title': 'Task with Invalid Enums',
        'Account': 'Acme Corp',
        'Owner': 'Jane Smith',
        'Priority': 'Urgent', // invalid
        'Status': 'Waiting', // invalid
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { errors } = coerceAndValidateRow(row, ACTION_ITEM_FIELDS, headerMap);

      expect(errors.some((e) => e.includes('Priority'))).toBe(true);
      expect(errors.some((e) => e.includes('Status'))).toBe(true);
    });
  });

  describe('6. Bulk Validation Engine — Unknown & Missing Columns', () => {
    it('identifies missing required columns and unknown extra columns', async () => {
      const rows = [
        { 'Account Name': 'Test Inc', 'Extra Column': 'Random Value' },
      ];
      const headers = ['Account Name', 'Extra Column'];

      const result = await runBulkValidate(rows, headers, {
        fields: ACCOUNT_FIELDS,
        validate: async () => [],
        naturalKey: () => null,
        findExistingId: async () => null,
      });

      // Type and Health are required columns in ACCOUNT_FIELDS
      expect(result.missingRequiredColumns).toContain('Account Type');
      expect(result.missingRequiredColumns).toContain('Health');
      // Extra Column is unknown
      expect(result.unknownColumns).toContain('Extra Column');
    });
  });

  describe('7. Project Import & Validation', () => {
    it('validates a complete project record and passes CreateProjectDto', async () => {
      const row = {
        'Project Name': 'Cloud Transformation',
        'Account': 'acc-1',
        'Status': 'Active',
        'Health': 'Green',
        'Priority': 'High',
        'Methodology': 'Agile',
        'Start Date': '2026-03-01',
        'End Date': '2026-09-30',
        'Delivery Model': 'Fixed Bid',
        'Billing Model': 'Milestone Based',
        'Tower': 'Tower 1',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, PROJECT_FIELDS, headerMap);
      expect(errors).toHaveLength(0);
      expect(payload.name).toBe('Cloud Transformation');
      expect(payload.methodology).toBe('Agile');

      const dtoErrors = await validateDto(CreateProjectDto, payload);
      expect(dtoErrors).toHaveLength(0);
    });

    it('enforces project post-validation date rules', () => {
      const invalidDates = projectPostValidate({
        startDate: '2026-10-01',
        endDate: '2026-05-01',
      });
      expect(invalidDates).toContain('Project End Date cannot be earlier than Project Start Date');

      const validDates = projectPostValidate({
        startDate: '2026-01-01',
        endDate: '2026-06-01',
      });
      expect(validDates).toHaveLength(0);
    });
  });

  describe('8. Project Action Items Import Validation', () => {
    it('validates a project action item record with Project reference using PROJECT_ACTION_ITEM_FIELDS', async () => {
      const row = {
        'Task Title': 'Design Cloud Architecture',
        'Account': 'acc-1',
        'Owner': 'stk-1',
        'Priority': 'High',
        'Status': 'To Do',
        'Project': 'prj-1',
        'Due Date': '2026-04-15',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload, errors } = coerceAndValidateRow(row, PROJECT_ACTION_ITEM_FIELDS, headerMap);
      expect(errors).toHaveLength(0);
      expect(payload.projectId).toBe('prj-1');
      expect(payload.title).toBe('Design Cloud Architecture');

      const dtoErrors = await validateDto(CreateActionItemDto, payload);
      expect(dtoErrors).toHaveLength(0);
    });

    it('regular ACTION_ITEM_FIELDS does not accept or parse Project', () => {
      const row = {
        'Task Title': 'Regular Action Item',
        'Account': 'acc-1',
        'Owner': 'stk-1',
        'Priority': 'High',
        'Status': 'To Do',
        'Project': 'prj-1',
      };
      const headerMap = new Map(Object.keys(row).map((k) => [normalizeHeader(k), k]));
      const { payload } = coerceAndValidateRow(row, ACTION_ITEM_FIELDS, headerMap);
      expect(payload.projectId).toBeUndefined();
    });
  });
});
