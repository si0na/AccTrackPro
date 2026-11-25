import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AccountWeeklyHealthService } from '../account-weekly-health.service';
import { AccountsService } from '../accounts.service';
import { DatabaseService } from '../../../database/database.service';

describe('AccountWeeklyHealthService', () => {
  let service: AccountWeeklyHealthService;
  let mockDb: { query: jest.MockedFunction<any> };
  let mockAccountsService: { findOne: jest.MockedFunction<any> };

  const sampleAccount = {
    id: 'acc-123',
    name: 'Acme Global',
    type: 'Strategic',
    health: 'Green',
    owner: 'Jane Smith',
  };

  const sampleRow = {
    id: 'wh-1',
    account_id: 'acc-123',
    reporting_date: new Date('2026-11-02'),
    reporting_date_str: '2026-11-02',
    health_status: 'Green',
    summary: 'Strong quarter delivery, SLA met across all deliverables.',
    key_updates: 'Sprint 42 completed on schedule.',
    risks_and_issues: 'Minor resource constraint during holidays.',
    action_items_mitigation: 'Cross-trained offshore team.',
    owner: 'Jane Smith',
    owner_id: 'usr-jane',
    owner_user_name: 'Jane Smith',
    next_steps: 'Prepare Q4 governance deck.',
    created_by: 'usr-jane',
    created_by_name: 'Jane Smith',
    updated_by: 'usr-jane',
    updated_by_name: 'Jane Smith',
    created_at: new Date('2026-11-02T10:00:00Z'),
    updated_at: new Date('2026-11-02T10:00:00Z'),
  };

  beforeEach(async () => {
    mockDb = {
      query: jest.fn() as any,
    };

    mockAccountsService = {
      findOne: jest.fn().mockImplementation((id: any) => {
        if (id === 'acc-123') return Promise.resolve(sampleAccount);
        return Promise.resolve(null);
      }) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountWeeklyHealthService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: AccountsService, useValue: mockAccountsService },
      ],
    }).compile();

    service = module.get<AccountWeeklyHealthService>(AccountWeeklyHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll should return all weekly health updates for an account sorted latest first', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] });

    const result = await service.findAll('acc-123', 'usr-user1');

    expect(mockAccountsService.findOne).toHaveBeenCalledWith('acc-123', 'usr-user1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wh-1');
    expect(result[0].reportingDate).toBe('2026-11-02');
    expect(result[0].healthStatus).toBe('Green');
    expect(result[0].summary).toBe('Strong quarter delivery, SLA met across all deliverables.');
    expect(result[0].owner).toBe('Jane Smith');
  });

  it('findAll should throw NotFoundException when account does not exist or user lacks access', async () => {
    await expect(service.findAll('acc-unknown', 'usr-user1')).rejects.toThrow(NotFoundException);
  });

  it('findOne should return single update', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] });

    const result = await service.findOne('acc-123', 'wh-1', 'usr-user1');
    expect(result.id).toBe('wh-1');
    expect(result.healthStatus).toBe('Green');
  });

  it('findOne should throw NotFoundException if update does not exist for the given account', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    await expect(service.findOne('acc-123', 'wh-missing', 'usr-user1')).rejects.toThrow(NotFoundException);
  });

  it('create should successfully insert a new weekly health update', async () => {
    // 1. Check duplicate date -> returns empty
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    // 2. Insert query -> returns id
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'wh-new' }] });
    // 3. findOne query after insert
    mockDb.query.mockResolvedValueOnce({
      rows: [{ ...sampleRow, id: 'wh-new', reporting_date_str: '2026-11-09', health_status: 'Amber' }],
    });

    const result = await service.create(
      'acc-123',
      {
        reportingDate: '2026-11-09',
        healthStatus: 'Amber',
        summary: 'Amber health due to testing delays.',
        keyUpdates: 'UAT started.',
        risksAndIssues: 'Client SME availability is constrained.',
        actionItemsMitigation: 'Scheduled daily standups.',
        owner: 'Jane Smith',
        nextSteps: 'Complete UAT sign-off.',
      },
      'usr-user1',
    );

    expect(result.id).toBe('wh-new');
    expect(result.reportingDate).toBe('2026-11-09');
    expect(result.healthStatus).toBe('Amber');
  });

  it('create should throw ConflictException if an update already exists for the same reporting date', async () => {
    // Check duplicate date -> returns existing record
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'wh-1' }] });

    await expect(
      service.create(
        'acc-123',
        {
          reportingDate: '2026-11-02',
          healthStatus: 'Green',
          summary: 'Duplicate date attempt',
        },
        'usr-user1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('update should successfully update existing fields', async () => {
    // 1. existing check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'wh-1', reporting_date: '2026-11-02' }] });
    // 2. update query
    mockDb.query.mockResolvedValueOnce({ rowCount: 1 });
    // 3. findOne query
    mockDb.query.mockResolvedValueOnce({
      rows: [{ ...sampleRow, health_status: 'Red', summary: 'Critical blocker on deployment.' }],
    });

    const result = await service.update(
      'acc-123',
      'wh-1',
      {
        healthStatus: 'Red',
        summary: 'Critical blocker on deployment.',
      },
      'usr-user1',
    );

    expect(result.healthStatus).toBe('Red');
    expect(result.summary).toBe('Critical blocker on deployment.');
  });

  it('update should throw ConflictException if changed reporting date collides with another update', async () => {
    // 1. existing check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'wh-1', reporting_date: '2026-11-02' }] });
    // 2. collision check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'wh-2' }] });

    await expect(
      service.update(
        'acc-123',
        'wh-1',
        {
          reportingDate: '2026-11-09',
        },
        'usr-user1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('delete should remove update belonging to account', async () => {
    mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

    const result = await service.delete('acc-123', 'wh-1', 'usr-user1');
    expect(result).toEqual({ success: true, id: 'wh-1' });
  });

  it('delete should throw NotFoundException if update does not exist', async () => {
    mockDb.query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(service.delete('acc-123', 'wh-missing', 'usr-user1')).rejects.toThrow(NotFoundException);
  });
});
