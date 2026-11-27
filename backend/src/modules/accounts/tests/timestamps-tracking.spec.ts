import { AccountsService } from '../accounts.service';
import { OpportunitiesService } from '../../opportunities/opportunities.service';
import { ActionItemsService } from '../../action-items/action-items.service';
import { StakeholdersService } from '../../stakeholders/stakeholders.service';
import { ProjectsService } from '../../projects/projects.service';
import { ProjectTeamService } from '../../projects/project-team.service';
import { CommentsService } from '../../comments/comments.service';
import { FinancialYearsService } from '../../financial-years/financial-years.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Created Date and Last Modified Date Tracking Across ReflectOne', () => {
  describe('Database Migration 116', () => {
    it('migration 116 exists and contains proper ALTER TABLE and backfill UPDATE statements', () => {
      const migrationPath = path.resolve(__dirname, '../../../database/migrations/116_add_created_and_last_modified_timestamps.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, 'utf8');
      // Verifies columns are added with TIMESTAMPTZ NOT NULL DEFAULT NOW()
      expect(content).toContain('ALTER TABLE comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(content).toContain('ALTER TABLE project_team_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(content).toContain('ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(content).toContain('ALTER TABLE financial_calendar ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(content).toContain('ALTER TABLE administration_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(content).toContain('ALTER TABLE column_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

      // Verifies historical preservation / backfill
      expect(content).toContain('UPDATE comments SET updated_at = created_at WHERE updated_at = NOW()');
      expect(content).toContain('UPDATE project_team_members SET updated_at = created_at WHERE updated_at = NOW()');
      expect(content).toContain('UPDATE financial_years SET updated_at = created_at WHERE updated_at = NOW()');
      expect(content).toContain('UPDATE financial_calendar SET created_at = updated_at WHERE created_at = NOW()');
      expect(content).toContain('UPDATE administration_settings SET created_at = updated_at WHERE created_at = NOW()');
      expect(content).toContain('UPDATE column_configs SET created_at = updated_at WHERE created_at = NOW()');
    });
  });

  describe('Accounts Module', () => {
    let service: AccountsService;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      service = new AccountsService(
        mockDb,
        { normalize: jest.fn(), derivePeriod: jest.fn() } as any,
        { getContext: jest.fn() } as any,
        { resolveOrCreate: jest.fn() } as any,
        { emit: jest.fn() } as any,
      );
    });

    it('returns createdAt and updatedAt in findOne API response', async () => {
      const createdDate = new Date('2026-01-15T10:00:00Z');
      const updatedDate = new Date('2026-01-20T15:30:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'acc-1',
          name: 'Acme Corp',
          type: 'Strategic',
          health: 'Green',
          revenue: 1000000,
          created_at: createdDate,
          updated_at: updatedDate,
          is_deleted: false,
          custom_data: {},
        }],
      });

      const result = await service.findOne('acc-1');
      expect(result.createdAt).toBe(createdDate.toISOString());
      expect(result.updatedAt).toBe(updatedDate.toISOString());
    });

    it('update refreshes updated_at to NOW() and leaves created_at untouched', async () => {
      const initialCreated = new Date('2026-01-15T10:00:00Z');
      const initialUpdated = new Date('2026-01-15T10:00:00Z');
      const secondUpdated = new Date('2026-02-18T12:00:00Z');

      // findOne check inside update
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'acc-1',
          name: 'Acme Corp',
          type: 'Strategic',
          health: 'Green',
          revenue: 1000000,
          created_at: initialCreated,
          updated_at: initialUpdated,
          is_deleted: false,
          custom_data: {},
        }],
      });
      // assertNameAvailable
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // UPDATE query
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // findOne after update
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'acc-1',
          name: 'Acme Corp Updated',
          type: 'Strategic',
          health: 'Green',
          revenue: 1200000,
          created_at: initialCreated,
          updated_at: secondUpdated,
          is_deleted: false,
          custom_data: {},
        }],
      });
      // log query
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const updated = await service.update('acc-1', { name: 'Acme Corp Updated', revenue: 1200000 });

      // Verify the SQL UPDATE query sets updated_at=NOW() and does not overwrite created_at
      const updateCall = mockDb.query.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('UPDATE accounts SET'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('updated_at=NOW()');
      expect(updateCall[0]).not.toContain('created_at=');

      // Verify returned timestamps: createdAt is immutable, updatedAt is refreshed
      expect(updated.createdAt).toBe(initialCreated.toISOString());
      expect(updated.updatedAt).toBe(secondUpdated.toISOString());
    });
  });

  describe('Opportunities Module', () => {
    let service: OpportunitiesService;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      service = new OpportunitiesService(
        mockDb,
        {
          normalize: jest.fn(),
          getFiscalContext: jest.fn().mockResolvedValue({}),
          derivePeriod: jest.fn().mockReturnValue({ financialYear: '2026-27', quarter: 'Q1' }),
          deriveOpportunityPeriods: jest.fn().mockReturnValue({ financialYear: '2026-27', quarter: 'Q1' }),
        } as any,
        { getContext: jest.fn() } as any,
        {} as any,
        { emit: jest.fn() } as any,
        {} as any,
      );
    });

    it('returns createdAt and updatedAt in opportunity response', async () => {
      const createdDate = new Date('2026-03-01T08:00:00Z');
      const updatedDate = new Date('2026-03-10T11:20:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'opp-1',
          name: 'Cloud Transformation',
          account_id: 'acc-1',
          stage: 'Proposal',
          value: 500000,
          probability: 70,
          allocation_start_date: '2026-04-01',
          allocation_end_date: '2026-12-31',
          created_at: createdDate,
          updated_at: updatedDate,
          is_deleted: false,
          custom_data: {},
        }],
      });

      const result = await service.findOne('opp-1');
      expect(result.createdAt).toBe(createdDate.toISOString());
      expect(result.updatedAt).toBe(updatedDate.toISOString());
    });

    it('update query updates updated_at to NOW() and does not touch created_at', async () => {
      const initialCreated = new Date('2026-03-01T08:00:00Z');
      const initialUpdated = new Date('2026-03-01T08:00:00Z');
      const secondUpdated = new Date('2026-03-15T14:00:00Z');

      // findOne in update
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'opp-1',
          name: 'Cloud Transformation',
          account_id: 'acc-1',
          stage: 'Proposal',
          value: 500000,
          probability: 70,
          created_at: initialCreated,
          updated_at: initialUpdated,
          is_deleted: false,
        }],
      });
      // UPDATE query
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // findOne after update
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'opp-1',
          name: 'Cloud Transformation V2',
          account_id: 'acc-1',
          stage: 'Proposal',
          value: 600000,
          probability: 80,
          created_at: initialCreated,
          updated_at: secondUpdated,
          is_deleted: false,
        }],
      });
      // log
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const updated = await service.update('opp-1', { name: 'Cloud Transformation V2', value: 600000 });

      const updateCall = mockDb.query.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('UPDATE opportunities SET'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('updated_at=NOW()');
      expect(updateCall[0]).not.toContain('created_at=');
      expect(updated.createdAt).toBe(initialCreated.toISOString());
      expect(updated.updatedAt).toBe(secondUpdated.toISOString());
    });
  });

  describe('Action Items Module', () => {
    let service: ActionItemsService;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      service = new ActionItemsService(
        mockDb,
        {
          normalize: jest.fn(),
          getFiscalContext: jest.fn().mockResolvedValue({}),
          derivePeriod: jest.fn().mockReturnValue({ financialYear: '2026-27', quarter: 'Q1' }),
        } as any,
        { getContext: jest.fn() } as any,
        { emit: jest.fn() } as any,
        {} as any,
        { handleActionItemCreated: jest.fn(), handleActionItemUpdated: jest.fn() } as any,
      );
    });

    it('returns createdAt and updatedAt in action item response', async () => {
      const createdDate = new Date('2026-04-01T09:00:00Z');
      const updatedDate = new Date('2026-04-05T16:45:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'ai-1',
          title: 'Architecture Review',
          account_id: 'acc-1',
          open_date: '2026-04-01',
          due_date: '2026-04-10',
          priority: 'High',
          status: 'In Progress',
          created_at: createdDate,
          updated_at: updatedDate,
          is_deleted: false,
        }],
      });

      const result = await service.findOne('ai-1');
      expect(result.createdAt).toBe(createdDate.toISOString());
      expect(result.updatedAt).toBe(updatedDate.toISOString());
    });
  });

  describe('Stakeholders Module', () => {
    let service: StakeholdersService;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      service = new StakeholdersService(
        mockDb,
        { normalize: jest.fn() } as any,
        { getContext: jest.fn() } as any,
        { emit: jest.fn() } as any,
      );
    });

    it('returns createdAt and updatedAt in stakeholder response', async () => {
      const createdDate = new Date('2026-02-10T11:00:00Z');
      const updatedDate = new Date('2026-02-12T14:30:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'stk-1',
          name: 'Jane Smith',
          account_id: 'acc-1',
          designation: 'VP Engineering',
          influence: 'High',
          relationship: 'Strong',
          stakeholder_type: 'CLIENT',
          created_at: createdDate,
          updated_at: updatedDate,
          is_deleted: false,
        }],
      });

      const result = await service.findOne('stk-1');
      expect(result.createdAt).toBe(createdDate.toISOString());
      expect(result.updatedAt).toBe(updatedDate.toISOString());
    });
  });

  describe('Projects Module', () => {
    let service: ProjectsService;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      service = new ProjectsService(
        mockDb,
        { normalize: jest.fn() } as any,
        { getContext: jest.fn() } as any,
        {} as any,
      );
    });

    it('returns createdAt and updatedAt in project response', async () => {
      const createdDate = new Date('2026-05-01T07:30:00Z');
      const updatedDate = new Date('2026-05-15T09:45:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'proj-1',
          name: 'Core Modernization',
          account_id: 'acc-1',
          opportunity_id: 'opp-1',
          methodology: 'Agile',
          status: 'Active',
          health: 'Green',
          created_at: createdDate,
          updated_at: updatedDate,
          is_deleted: false,
        }],
      });

      const result = await service.findOne('proj-1');
      expect(result.createdAt).toBe(createdDate.toISOString());
      expect(result.updatedAt).toBe(updatedDate.toISOString());
    });
  });

  describe('Comments Module', () => {
    let service: CommentsService;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      service = new CommentsService(
        mockDb,
        { emit: jest.fn() } as any,
      );
    });

    it('returns createdAt and updatedAt in comment responses and update refreshes updated_at', async () => {
      const createdDate = new Date('2026-06-01T10:00:00Z');
      const updatedDate = new Date('2026-06-01T11:00:00Z');

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'comm-1',
          text: 'Updated notes',
          target_type: 'account',
          target_id: 'acc-1',
          user_name: 'Alice',
          created_at: createdDate,
          updated_at: updatedDate,
        }],
      });

      const updated = await service.update('comm-1', 'Updated notes', 'user-1');

      const updateCall = mockDb.query.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('UPDATE comments SET text = $1, updated_at = NOW()'),
      );
      expect(updateCall).toBeDefined();
      expect(updated.createdAt).toBe(createdDate.toISOString());
      expect(updated.updatedAt).toBe(updatedDate.toISOString());
    });
  });

  describe('Project Team Members Module', () => {
    let service: ProjectTeamService;
    let mockDb: any;
    let mockProjectsService: any;

    beforeEach(() => {
      mockDb = {
        query: jest.fn(),
      };
      mockProjectsService = {
        findOne: jest.fn().mockResolvedValue({ id: 'proj-1' }),
      };
      service = new ProjectTeamService(mockDb, mockProjectsService);
    });

    it('returns createdAt and updatedAt in team member response and update sets updated_at = NOW()', async () => {
      const createdDate = new Date('2026-07-01T10:00:00Z');
      const updatedDate = new Date('2026-07-05T15:00:00Z');

      // UPDATE query
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // findOneScoped
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'tm-1',
          project_id: 'proj-1',
          role: 'Lead Architect',
          employee_name: 'Bob',
          created_at: createdDate,
          updated_at: updatedDate,
        }],
      });

      const updated = await service.update('proj-1', 'tm-1', {
        role: 'Lead Architect',
        employeeName: 'Bob',
      });

      const updateCall = mockDb.query.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('UPDATE project_team_members SET'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('updated_at=NOW()');
      expect(updated.createdAt).toBe(createdDate.toISOString());
      expect(updated.updatedAt).toBe(updatedDate.toISOString());
    });
  });
});
