import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NpsService } from '../nps.service';

describe('NpsService — NPS Score Generation & Account Resolution', () => {
  let npsService: NpsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    npsService = new NpsService(mockDb as any);
  });

  describe('Scenario 1: Project linked to Account, no Opportunity', () => {
    it('generates NPS score and resolves the correct Account name via the direct account relationship', async () => {
      // 1. Query project without opportunity
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'proj-direct-1',
              name: 'Direct Portal Project',
              account_id: 'acc-1',
              opportunity_id: null,
              client_pm_name: null,
              account_name: 'Acme Global Corp',
            },
          ],
        })
        // 2. Query existing NPS responses for this project -> none
        .mockResolvedValueOnce({ rows: [] })
        // 3. Query client stakeholders for acc-1
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'stk-1',
              name: 'Alice Cooper',
              designation: 'Director of Technology',
            },
          ],
        })
        // 4. Insert NPS response
        .mockResolvedValueOnce({
          rows: [{ id: 'nps-new-1' }],
        })
        // 5. findOne returning joined account name
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-new-1',
              account_id: 'acc-1',
              account_name: 'Acme Global Corp',
              project_id: 'proj-direct-1',
              project_name: 'Direct Portal Project',
              respondent_id: 'stk-1',
              respondent_name: 'Alice Cooper (Director of Technology)',
              received_month_year: '2026-11',
              quarter: 'Q3',
              nps_score: 9,
              liked_most: 'Proactive communication, deep technical domain knowledge, and transparent weekly progress reporting.',
              improvement_suggestions: 'Accelerate onboarding for new team members during scaling phases.',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const result = await npsService.generateForProject('proj-direct-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('nps-new-1');
      expect(result.projectId).toBe('proj-direct-1');
      expect(result.accountId).toBe('acc-1');
      expect(result.accountName).toBe('Acme Global Corp');
      expect(result.npsScore).toBe(9);
      expect(result.respondentName).toBe('Alice Cooper (Director of Technology)');

      // Verify INSERT used direct project.account_id without requiring opportunity
      const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO nps_responses'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe('acc-1');
      expect(insertCall[1][1]).toBe('proj-direct-1');
    });
  });

  describe('Scenario 2: Project linked to Account and Opportunity', () => {
    it('generates NPS score and resolves Account name when project is linked to an Opportunity', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'proj-opp-1',
              name: 'Cloud Migration Project',
              account_id: 'acc-2',
              opportunity_id: 'opp-100',
              client_pm_name: 'David Miller',
              account_name: 'Omni Retail Ltd',
            },
          ],
        })
        // Existing NPS response -> none
        .mockResolvedValueOnce({ rows: [] })
        // Stakeholders query
        .mockResolvedValueOnce({ rows: [] })
        // Insert query
        .mockResolvedValueOnce({
          rows: [{ id: 'nps-new-2' }],
        })
        // findOne
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-new-2',
              account_id: 'acc-2',
              account_name: 'Omni Retail Ltd',
              project_id: 'proj-opp-1',
              project_name: 'Cloud Migration Project',
              respondent_name: 'David Miller',
              received_month_year: '2026-11',
              quarter: 'Q3',
              nps_score: 9,
              liked_most: 'Proactive communication, deep technical domain knowledge, and transparent weekly progress reporting.',
              improvement_suggestions: 'Accelerate onboarding for new team members during scaling phases.',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const result = await npsService.generateForProject('proj-opp-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('nps-new-2');
      expect(result.projectId).toBe('proj-opp-1');
      expect(result.accountId).toBe('acc-2');
      expect(result.accountName).toBe('Omni Retail Ltd');
      expect(result.respondentName).toBe('David Miller');
    });
  });

  describe('Scenario 3: Project with no Account', () => {
    it('throws validation error when generating NPS for a project without an associated account', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'proj-no-acc',
            name: 'Orphaned Project',
            account_id: null,
            opportunity_id: null,
            account_name: null,
          },
        ],
      });

      await expect(npsService.generateForProject('proj-no-acc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when creating NPS with an invalid or missing account', async () => {
      await expect(
        npsService.create({
          accountId: '',
          receivedMonthYear: '2026-11',
          npsScore: 8,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Scenario 4: Multiple Projects under the same Account', () => {
    it('correctly associates each project individually while maintaining the shared Account name', async () => {
      // 1. Account existence check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'acc-shared', name: 'Shared Enterprise Inc' }],
      });
      // 2. Active projects query for account
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'proj-1' }, { id: 'proj-2' }],
      });

      // For proj-1
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'proj-1',
              name: 'Project Alpha',
              account_id: 'acc-shared',
              account_name: 'Shared Enterprise Inc',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'nps-alpha' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-alpha',
              account_id: 'acc-shared',
              account_name: 'Shared Enterprise Inc',
              project_id: 'proj-1',
              project_name: 'Project Alpha',
              nps_score: 9,
            },
          ],
        });

      // For proj-2
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'proj-2',
              name: 'Project Beta',
              account_id: 'acc-shared',
              account_name: 'Shared Enterprise Inc',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'nps-beta' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-beta',
              account_id: 'acc-shared',
              account_name: 'Shared Enterprise Inc',
              project_id: 'proj-2',
              project_name: 'Project Beta',
              nps_score: 9,
            },
          ],
        });

      const results = await npsService.generateForAccount('acc-shared');

      expect(results).toHaveLength(2);
      expect(results[0].projectId).toBe('proj-1');
      expect(results[0].accountId).toBe('acc-shared');
      expect(results[0].accountName).toBe('Shared Enterprise Inc');

      expect(results[1].projectId).toBe('proj-2');
      expect(results[1].accountId).toBe('acc-shared');
      expect(results[1].accountName).toBe('Shared Enterprise Inc');
    });
  });

  describe('Scenario 5: Existing Projects with NPS scores', () => {
    it('leaves existing NPS scores intact without overwriting historical responses', async () => {
      // 1. Project query
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'proj-existing-1',
            name: 'Historical Project',
            account_id: 'acc-1',
            account_name: 'Acme Corp',
          },
        ],
      });
      // 2. Existing check -> returns existing record with historical score 7
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'nps-hist-1',
            account_id: 'acc-1',
            project_id: 'proj-existing-1',
            nps_score: 7,
          },
        ],
      });
      // 3. findOne returns existing record
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'nps-hist-1',
            account_id: 'acc-1',
            account_name: 'Acme Corp',
            project_id: 'proj-existing-1',
            project_name: 'Historical Project',
            nps_score: 7,
            liked_most: 'Initial feedback from 6 months ago',
          },
        ],
      });

      const result = await npsService.generateForProject('proj-existing-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('nps-hist-1');
      expect(result.npsScore).toBe(7);
      expect(result.likedMost).toBe('Initial feedback from 6 months ago');

      // Verify NO INSERT was executed
      const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO nps_responses'),
      );
      expect(insertCall).toBeUndefined();
    });
  });

  describe('Scenario 6: Repeated NPS generation', () => {
    it('is strictly idempotent and does not create duplicate records on repeated calls', async () => {
      // First call setup
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'proj-idemp-1',
              name: 'Idempotency Test Project',
              account_id: 'acc-1',
              account_name: 'Acme Corp',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'nps-first-run' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-first-run',
              account_id: 'acc-1',
              account_name: 'Acme Corp',
              project_id: 'proj-idemp-1',
              nps_score: 9,
            },
          ],
        });

      const firstResult = await npsService.generateForProject('proj-idemp-1');
      expect(firstResult.id).toBe('nps-first-run');

      // Second call setup (subsequent run sees the record from first run)
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'proj-idemp-1',
              name: 'Idempotency Test Project',
              account_id: 'acc-1',
              account_name: 'Acme Corp',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-first-run',
              account_id: 'acc-1',
              project_id: 'proj-idemp-1',
              nps_score: 9,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'nps-first-run',
              account_id: 'acc-1',
              account_name: 'Acme Corp',
              project_id: 'proj-idemp-1',
              nps_score: 9,
            },
          ],
        });

      const secondResult = await npsService.generateForProject('proj-idemp-1');
      expect(secondResult.id).toBe('nps-first-run');

      // Count INSERT queries across both calls -> exactly 1
      const insertCalls = mockDb.query.mock.calls.filter((call: any[]) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO nps_responses'),
      );
      expect(insertCalls).toHaveLength(1);
    });
  });
});
