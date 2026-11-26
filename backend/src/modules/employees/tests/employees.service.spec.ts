import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from '../employees.service';
import { DatabaseService } from '../../../database/database.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let mockDb: { query: jest.MockedFunction<any> };

  beforeEach(async () => {
    mockDb = {
      query: jest.fn() as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return merged and deduplicated local employee directory', async () => {
    // Mock users
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM users')) {
        return Promise.resolve({
          rows: [
            {
              id: 'usr-1',
              name: 'John Doe',
              email: 'john.doe@company.com',
              role: 'Sales Representative',
              department: 'Sales',
              designation: 'Senior Rep',
            },
            {
              id: 'usr-2',
              name: 'Jane Smith',
              email: 'jane.smith@company.com',
              role: 'Account Manager',
              department: 'Accounts',
              designation: 'Manager',
            },
          ],
        });
      }
      if (sql.includes('FROM employee_master')) {
        return Promise.resolve({
          rows: [
            {
              id: 'emp-1',
              employee_id: 'EMP-100',
              name: 'John Doe',
              email: 'john.doe@company.com',
              designation: 'Senior Rep',
              department: 'Sales',
            },
            {
              id: 'emp-3',
              employee_id: 'EMP-103',
              name: 'Mark Taylor',
              email: 'mark.taylor@company.com',
              designation: 'Engineer',
              department: 'Engineering',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.getLocalEmployeeDirectory();

    expect(result).toBeDefined();
    // 3 distinct people: John Doe (merged), Jane Smith (user only), Mark Taylor (employee_master only)
    expect(result.length).toBe(3);

    // Verify John Doe deduplication: preserves user id, links localEmployeeId
    const john = result.find((r) => r.mail === 'john.doe@company.com');
    expect(john).toBeDefined();
    expect(john?.displayName).toBe('John Doe');
    expect(john?.id).toBe('usr-1');
    expect(john?.localEmployeeId).toBe('emp-1');
    expect(john?.source).toBe('local_fallback');

    // Verify Mark Taylor
    const mark = result.find((r) => r.mail === 'mark.taylor@company.com');
    expect(mark).toBeDefined();
    expect(mark?.displayName).toBe('Mark Taylor');
    expect(mark?.id).toBe('emp-3');
  });

  it('should filter employees by search term', async () => {
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM users')) {
        return Promise.resolve({
          rows: [
            { id: 'u1', name: 'Alice Wonderland', email: 'alice@company.com' },
            { id: 'u2', name: 'Bob Builder', email: 'bob@company.com' },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.getLocalEmployeeDirectory('alice');
    expect(result.length).toBe(1);
    expect(result[0].displayName).toBe('Alice Wonderland');
  });

  it('should handle database errors gracefully and return an empty array', async () => {
    mockDb.query.mockRejectedValue(new Error('DB Connection Timeout'));

    const result = await service.getLocalEmployeeDirectory();
    expect(result).toEqual([]);
  });
});
