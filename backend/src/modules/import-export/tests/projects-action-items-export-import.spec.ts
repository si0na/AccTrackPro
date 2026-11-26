import { GlobalImportExportService, WorkbookSheets, WorkbookImportRequest } from '../global-import-export.service';
import { DatabaseService } from '../../../database/database.service';
import { ImportExportAuditService } from '../import-export-audit.service';
import { AccountsService } from '../../accounts/accounts.service';
import { StakeholdersService } from '../../stakeholders/stakeholders.service';
import { OpportunitiesService } from '../../opportunities/opportunities.service';
import { ProjectsService } from '../../projects/projects.service';
import { ActionItemsService } from '../../action-items/action-items.service';
import { ServiceProviderService } from '../../service-provider/service-provider.service';
import { PROJECT_FIELDS, ACTION_ITEM_FIELDS, PROJECT_ACTION_ITEM_FIELDS } from '../import-field-schemas';

describe('Projects and Project Action Items Export/Import Integration', () => {
  let service: GlobalImportExportService;
  let mockDb: any;
  let mockAudit: any;
  let mockAccounts: any;
  let mockStakeholders: any;
  let mockOpportunities: any;
  let mockProjects: any;
  let mockActionItems: any;

  let regularAiAdapter: any;
  let projectAiAdapter: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM accounts')) {
          return Promise.resolve({
            rows: [{ id: 'acc-1', name: 'Acme Corporation' }],
          });
        }
        if (sql.includes('FROM opportunities')) {
          return Promise.resolve({
            rows: [{ id: 'opp-1', name: 'Acme Cloud Deal', account_id: 'acc-1' }],
          });
        }
        if (sql.includes('FROM stakeholders')) {
          return Promise.resolve({
            rows: [{ id: 'stk-1', name: 'Jane Doe', account_id: 'acc-1' }],
          });
        }
        if (sql.includes('FROM users') || sql.includes('FROM employee_master')) {
          return Promise.resolve({
            rows: [{ id: 'usr-1', name: 'John PM', email: 'john@example.com' }],
          });
        }
        if (sql.includes('FROM projects')) {
          return Promise.resolve({
            rows: [{ id: 'proj-existing-1', name: 'Existing Project', account_id: 'acc-1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    mockAudit = {
      recordImportRun: jest.fn().mockResolvedValue(undefined),
      recordExportRun: jest.fn().mockResolvedValue(undefined),
    };

    mockAccounts = {
      bulkAdapter: jest.fn().mockReturnValue({
        moduleKey: 'accounts',
        fields: [],
        validate: jest.fn().mockResolvedValue([]),
        naturalKey: (p: any) => p.name?.toLowerCase(),
        findExistingId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'acc-created-1' }),
        update: jest.fn().mockResolvedValue({ id: 'acc-updated-1' }),
      }),
    };

    mockStakeholders = {
      bulkAdapter: jest.fn().mockReturnValue({
        moduleKey: 'stakeholders',
        fields: [],
        validate: jest.fn().mockResolvedValue([]),
        naturalKey: (p: any) => `${p.accountId}::${p.email?.toLowerCase()}`,
        findExistingId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'stk-created-1' }),
        update: jest.fn().mockResolvedValue({ id: 'stk-updated-1' }),
      }),
    };

    mockOpportunities = {
      bulkAdapter: jest.fn().mockReturnValue({
        moduleKey: 'opportunities',
        fields: [],
        validate: jest.fn().mockResolvedValue([]),
        naturalKey: (p: any) => `${p.accountId}::${p.name?.toLowerCase()}`,
        findExistingId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'opp-created-1' }),
        update: jest.fn().mockResolvedValue({ id: 'opp-updated-1' }),
      }),
    };

    mockProjects = {
      bulkAdapter: jest.fn().mockReturnValue({
        moduleKey: 'projects',
        fields: PROJECT_FIELDS,
        validate: jest.fn().mockResolvedValue([]),
        naturalKey: (p: any) => (p.accountId && p.name ? `${p.accountId}::${p.name.trim().toLowerCase()}` : null),
        findExistingId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((p: any) => Promise.resolve({ id: `proj-new-${p.name.toLowerCase().replace(/\s+/g, '-')}` })),
        update: jest.fn().mockImplementation((id: string) => Promise.resolve({ id })),
      }),
    };

    regularAiAdapter = {
      moduleKey: 'actionItems',
      fields: ACTION_ITEM_FIELDS,
      validate: jest.fn().mockResolvedValue([]),
      naturalKey: (p: any) => (p.accountId && p.title ? `${p.accountId}::${p.title.trim().toLowerCase()}` : null),
      findExistingId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((p: any) => Promise.resolve({ id: `ai-created-${p.title}` })),
      update: jest.fn().mockImplementation((id: string) => Promise.resolve({ id })),
    };

    projectAiAdapter = {
      moduleKey: 'projectActionItems',
      fields: PROJECT_ACTION_ITEM_FIELDS,
      validate: jest.fn().mockResolvedValue([]),
      naturalKey: (p: any) => (p.projectId && p.title ? `${p.projectId}::${p.title.trim().toLowerCase()}` : null),
      findExistingId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((p: any) => Promise.resolve({ id: `pai-created-${p.title}` })),
      update: jest.fn().mockImplementation((id: string) => Promise.resolve({ id })),
    };

    mockActionItems = {
      bulkAdapter: jest.fn().mockReturnValue(regularAiAdapter),
      bulkProjectActionItemsAdapter: jest.fn().mockReturnValue(projectAiAdapter),
    };

    service = new GlobalImportExportService(
      mockDb as unknown as DatabaseService,
      mockAudit as unknown as ImportExportAuditService,
      mockAccounts as unknown as AccountsService,
      mockStakeholders as unknown as StakeholdersService,
      mockOpportunities as unknown as OpportunitiesService,
      mockProjects as unknown as ProjectsService,
      mockActionItems as unknown as ActionItemsService,
      {} as unknown as ServiceProviderService,
    );
  });

  describe('1. Dry-run Validation with Cross-Sheet Project Dependencies', () => {
    it('validates a new Project and a Project Action Item defined in the same workbook separately from regular Action Items', async () => {
      const sheets: WorkbookSheets = {
        projects: {
          headers: ['Project Name', 'Account', 'Status', 'Health', 'Priority'],
          rows: [
            {
              'Project Name': 'Cloud Migration Phase 1',
              'Account': 'Acme Corporation',
              'Status': 'Active',
              'Health': 'Green',
              'Priority': 'High',
            },
          ],
        },
        actionItems: {
          headers: ['Task Title', 'Account', 'Owner', 'Priority', 'Status'],
          rows: [
            {
              'Task Title': 'Prepare Quarterly Business Review',
              'Account': 'Acme Corporation',
              'Owner': 'Jane Doe',
              'Priority': 'Medium',
              'Status': 'To Do',
            },
          ],
        },
        projectActionItems: {
          headers: ['Task Title', 'Project', 'Owner', 'Priority', 'Status'],
          rows: [
            {
              'Task Title': 'Design Cloud VPC',
              'Project': 'Cloud Migration Phase 1',
              'Owner': 'Jane Doe',
              'Priority': 'High',
              'Status': 'To Do',
            },
          ],
        },
      };

      const result = await service.validateWorkbook(sheets, 'user-123');

      // 1. Projects sheet validation
      expect(result.projects).toBeDefined();
      expect(result.projects!.total).toBe(1);
      expect(result.projects!.valid).toBe(1);
      expect(result.projects!.rows[0].status).toBe('valid');
      expect(result.projects!.rows[0].payload.name).toBe('Cloud Migration Phase 1');
      expect(result.projects!.rows[0].payload.accountId).toBe('acc-1');

      // 2. Regular Action Items sheet validation (no project association)
      expect(result.actionItems).toBeDefined();
      expect(result.actionItems!.total).toBe(1);
      expect(result.actionItems!.valid).toBe(1);
      const regularAiRow = result.actionItems!.rows[0];
      expect(regularAiRow.status).toBe('valid');
      expect(regularAiRow.payload.title).toBe('Prepare Quarterly Business Review');
      expect(regularAiRow.payload.accountId).toBe('acc-1');
      expect(regularAiRow.payload.projectId).toBeUndefined();

      // 3. Project Action Items sheet validation (associated with pending project)
      expect(result.projectActionItems).toBeDefined();
      expect(result.projectActionItems!.total).toBe(1);
      expect(result.projectActionItems!.valid).toBe(1);
      const projectAiRow = result.projectActionItems!.rows[0];
      expect(projectAiRow.status).toBe('valid');
      expect(projectAiRow.payload.title).toBe('Design Cloud VPC');
      expect(projectAiRow.payload.projectId).toBe('PENDING::project::cloud migration phase 1');
      expect(projectAiRow.refNames.project).toBe('Cloud Migration Phase 1');
    });

    it('validates a Project Action Item linked to an already existing database project', async () => {
      const sheets: WorkbookSheets = {
        projectActionItems: {
          headers: ['Task Title', 'Account', 'Owner', 'Priority', 'Status', 'Project'],
          rows: [
            {
              'Task Title': 'Security Review',
              'Account': 'Acme Corporation',
              'Owner': 'Jane Doe',
              'Priority': 'High',
              'Status': 'To Do',
              'Project': 'Existing Project',
            },
          ],
        },
      };

      const result = await service.validateWorkbook(sheets, 'user-123');
      expect(result.projectActionItems).toBeDefined();
      expect(result.projectActionItems!.valid).toBe(1);
      const aiRow = result.projectActionItems!.rows[0];
      expect(aiRow.status).toBe('valid');
      // Real database project ID resolved
      expect(aiRow.payload.projectId).toBe('proj-existing-1');
      expect(aiRow.refNames.project).toBe('Existing Project');
    });

    it('marks Project Action Item invalid with clear error if referenced Project does not exist', async () => {
      const sheets: WorkbookSheets = {
        projectActionItems: {
          headers: ['Task Title', 'Account', 'Owner', 'Priority', 'Status', 'Project'],
          rows: [
            {
              'Task Title': 'Orphan Task',
              'Account': 'Acme Corporation',
              'Owner': 'Jane Doe',
              'Priority': 'High',
              'Status': 'To Do',
              'Project': 'Nonexistent Project',
            },
          ],
        },
      };

      const result = await service.validateWorkbook(sheets, 'user-123');
      expect(result.projectActionItems!.valid).toBe(0);
      expect(result.projectActionItems!.invalid).toBe(1);
      const aiRow = result.projectActionItems!.rows[0];
      expect(aiRow.status).toBe('invalid');
      expect(aiRow.errors).toContain('Project "Nonexistent Project" was not found for this account');
    });
  });

  describe('2. Commit & Relationship Reconstruction', () => {
    it('commits Projects first, regular Action Items without project_id, and Project Action Items with real project_id', async () => {
      const request: WorkbookImportRequest = {
        projects: [
          {
            name: 'Cloud Migration Phase 1',
            accountId: 'acc-1',
            status: 'Active',
            health: 'Green',
          },
        ],
        actionItems: [
          {
            title: 'General Review',
            accountId: 'acc-1',
            ownerStakeholderId: 'stk-1',
            priority: 'Medium',
            status: 'To Do',
          },
        ],
        projectActionItems: [
          {
            title: 'Design Cloud VPC',
            accountId: 'acc-1',
            ownerStakeholderId: 'stk-1',
            priority: 'High',
            status: 'To Do',
            projectId: 'PENDING::project::cloud migration phase 1',
          },
        ],
      };

      const outcome = await service.importWorkbook(request, 'skip', 'user-123', 'Admin User');

      expect(outcome.projects).toBeDefined();
      expect(outcome.projects!.created).toBe(1);

      expect(outcome.actionItems).toBeDefined();
      expect(outcome.actionItems!.created).toBe(1);
      expect(regularAiAdapter.create).toHaveBeenCalled();
      const regularPayload = regularAiAdapter.create.mock.calls[0][0];
      expect(regularPayload.title).toBe('General Review');
      expect(regularPayload.accountId).toBe('acc-1');
      expect(regularPayload.projectId).toBeUndefined();

      expect(outcome.projectActionItems).toBeDefined();
      expect(outcome.projectActionItems!.created).toBe(1);
      expect(projectAiAdapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Design Cloud VPC',
          accountId: 'acc-1',
          projectId: 'proj-new-cloud-migration-phase-1',
        }),
      );

      expect(mockAudit.recordImportRun).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          userName: 'Admin User',
          results: outcome,
        }),
      );
    });

    it('safely fails a Project Action Item if its referenced project was removed or failed to import', async () => {
      const request: WorkbookImportRequest = {
        // Project was removed by user in preview grid, so projects list is empty
        projects: [],
        projectActionItems: [
          {
            title: 'Orphan Candidate',
            accountId: 'acc-1',
            ownerStakeholderId: 'stk-1',
            priority: 'High',
            status: 'To Do',
            projectId: 'PENDING::project::unimported project',
          },
        ],
      };

      const outcome = await service.importWorkbook(request, 'skip', 'user-123');

      expect(outcome.projectActionItems).toBeDefined();
      expect(outcome.projectActionItems!.failed).toBe(1);
      expect(outcome.projectActionItems!.results[0].status).toBe('failed');
      expect(outcome.projectActionItems!.results[0].message).toContain('Referenced project was not imported');

      // Ensure create was not called for the orphaned row
      expect(projectAiAdapter.create).not.toHaveBeenCalled();
    });

    it('handles duplicate projects safely according to DuplicateMode', async () => {
      mockProjects.bulkAdapter.mockReturnValue({
        moduleKey: 'projects',
        fields: PROJECT_FIELDS,
        validate: jest.fn().mockResolvedValue([]),
        naturalKey: (p: any) => `${p.accountId}::${p.name.trim().toLowerCase()}`,
        findExistingId: jest.fn().mockResolvedValue('proj-existing-1'),
        create: jest.fn().mockResolvedValue({ id: 'proj-new-1' }),
        update: jest.fn().mockResolvedValue({ id: 'proj-existing-1' }),
      });

      // 1. In 'skip' mode
      const skipRequest: WorkbookImportRequest = {
        projects: [{ name: 'Existing Project', accountId: 'acc-1' }],
      };
      const skipOutcome = await service.importWorkbook(skipRequest, 'skip', 'user-123');
      expect(skipOutcome.projects!.skipped).toBe(1);
      expect(skipOutcome.projects!.created).toBe(0);

      // 2. In 'update' mode
      const updateRequest: WorkbookImportRequest = {
        projects: [{ name: 'Existing Project', accountId: 'acc-1', health: 'Amber' }],
      };
      const updateOutcome = await service.importWorkbook(updateRequest, 'update', 'user-123');
      expect(updateOutcome.projects!.updated).toBe(1);
      expect(updateOutcome.projects!.created).toBe(0);
    });
  });

  describe('3. ActionItemsService bulkAdapter and bulkProjectActionItemsAdapter Separation', () => {
    it('regular bulkAdapter does not include projectId and has accountId::title naturalKey', () => {
      const adapter = mockActionItems.bulkAdapter('user-123');
      expect(adapter.moduleKey).toBe('actionItems');
      const naturalKey = adapter.naturalKey({ accountId: 'acc-1', title: 'Task 1' });
      expect(naturalKey).toBe('acc-1::task 1');
    });

    it('bulkProjectActionItemsAdapter requires projectId and has projectId::title naturalKey', () => {
      const adapter = mockActionItems.bulkProjectActionItemsAdapter('user-123');
      expect(adapter.moduleKey).toBe('projectActionItems');
      const naturalKey = adapter.naturalKey({ projectId: 'proj-1', title: 'Task 1' });
      expect(naturalKey).toBe('proj-1::task 1');
    });

    it('prevents cross-collision when a regular Action Item and Project Action Item share the same title', () => {
      const regAdapter = mockActionItems.bulkAdapter('user-123');
      const prjAdapter = mockActionItems.bulkProjectActionItemsAdapter('user-123');

      const regularKey = regAdapter.naturalKey({ accountId: 'acc-1', title: 'Sync Meeting' });
      const projectKey = prjAdapter.naturalKey({ projectId: 'proj-1', title: 'Sync Meeting' });

      expect(regularKey).toBe('acc-1::sync meeting');
      expect(projectKey).toBe('proj-1::sync meeting');
      expect(regularKey).not.toEqual(projectKey);
    });
  });
});
