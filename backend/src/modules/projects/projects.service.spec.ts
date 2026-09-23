import { ProjectsService } from './projects.service';

describe('ProjectsService.getAccountOptions', () => {
  let projectsService: ProjectsService;
  let mockDb: any;
  let mockFilter: any;
  let mockAccess: any;
  let mockPermissions: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockFilter = {
      normalize: jest.fn(),
    };
    mockAccess = {
      getContext: jest.fn(),
      buildProjectVisibility: jest.fn(),
    };
    mockPermissions = {};

    projectsService = new ProjectsService(
      mockDb as any,
      mockFilter as any,
      mockAccess as any,
      mockPermissions as any,
    );
  });

  it('returns all active accounts for user with accounts:view permission', async () => {
    mockAccess.getContext.mockResolvedValue({
      userId: 'admin-1',
      permissions: new Set(['accounts:view', 'projects:view']),
      canViewAllAccounts: false,
    });
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'acc-1', name: 'Acme Corp' },
        { id: 'acc-2', name: 'Beta Ltd' },
      ],
    });

    const result = await projectsService.getAccountOptions('admin-1');

    expect(result).toEqual([
      { id: 'acc-1', name: 'Acme Corp' },
      { id: 'acc-2', name: 'Beta Ltd' },
    ]);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, name FROM accounts WHERE is_deleted = FALSE'),
    );
    expect(mockAccess.buildProjectVisibility).not.toHaveBeenCalled();
  });

  it('derives accounts strictly from accessible projects for PM without account access', async () => {
    mockAccess.getContext.mockResolvedValue({
      userId: 'pm-1',
      permissions: new Set(['projects:view', 'projects:create']),
      canViewAllAccounts: false,
    });
    mockAccess.buildProjectVisibility.mockReturnValue({
      conditions: ['(p.service_provider_pm_id = $1)'],
      params: ['pm-1'],
      nextIdx: 2,
    });
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'acc-1', name: 'Acme Corp' }],
    });

    const result = await projectsService.getAccountOptions('pm-1');

    expect(result).toEqual([{ id: 'acc-1', name: 'Acme Corp' }]);
    expect(mockAccess.buildProjectVisibility).toHaveBeenCalledWith('p', expect.anything(), 1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT a.id, a.name'),
      ['pm-1'],
    );
  });

  it('does NOT return all accounts when user has projects:view-all but lacks account access', async () => {
    mockAccess.getContext.mockResolvedValue({
      userId: 'proj-lead-1',
      permissions: new Set(['projects:view', 'projects:view-all']),
      canViewAllAccounts: false,
    });
    mockAccess.buildProjectVisibility.mockReturnValue({
      conditions: [],
      params: [],
      nextIdx: 1,
    });
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'acc-1', name: 'Acme Corp' },
      ],
    });

    await projectsService.getAccountOptions('proj-lead-1');

    // Should call buildProjectVisibility and DISTINCT query, NOT the plain accounts query
    expect(mockAccess.buildProjectVisibility).toHaveBeenCalled();
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT a.id, a.name'),
      [],
    );
  });
});
