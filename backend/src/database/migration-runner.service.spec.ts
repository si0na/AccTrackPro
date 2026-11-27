import { MigrationRunner } from './migration-runner.service';
import { DatabaseService } from './database.service';
import * as fs from 'fs';

jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('MigrationRunner', () => {
  let runner: MigrationRunner;
  let mockDb: any;
  let mockPoolClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      pool: {
        connect: jest.fn().mockResolvedValue(mockPoolClient),
      },
    };
    runner = new MigrationRunner(mockDb as unknown as DatabaseService);
  });

  it('throws and executes no SQL when migration files share duplicate numeric prefixes', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([
      '112_account_weekly_health.sql',
      '112_stakeholder_management_enhancements.sql',
    ]);

    mockDb.query.mockResolvedValueOnce({ rows: [] }); // ensureMigrationsTable
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT version, name FROM schema_migrations

    await expect(runner.run()).rejects.toThrow(
      /Duplicate migration version "112" detected/,
    );
    expect(mockDb.pool.connect).not.toHaveBeenCalled();
    expect(mockPoolClient.query).not.toHaveBeenCalled();
  });

  it('throws and executes no SQL when recorded name in schema_migrations differs from disk file name', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([
      '112_account_weekly_health.sql',
    ]);

    mockDb.query.mockResolvedValueOnce({ rows: [] }); // ensureMigrationsTable
    mockDb.query.mockResolvedValueOnce({
      rows: [{ version: '112', name: '112_stakeholder_management_enhancements' }],
    }); // SELECT version, name FROM schema_migrations

    await expect(runner.run()).rejects.toThrow(
      /Migration version mismatch for version "112": already recorded in schema_migrations as "112_stakeholder_management_enhancements", but disk file is "112_account_weekly_health". Please use an unused number instead of reusing an applied one./,
    );
    expect(mockDb.pool.connect).not.toHaveBeenCalled();
    expect(mockPoolClient.query).not.toHaveBeenCalled();
  });

  it('skips applied versions with matching names and applies pending migrations in sorted order', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([
      '002_notifications.sql',
      '001_initial_schema.sql',
    ]);
    (fs.readFileSync as jest.Mock).mockReturnValue('SELECT 1;');

    mockDb.query.mockResolvedValueOnce({ rows: [] }); // ensureMigrationsTable
    mockDb.query.mockResolvedValueOnce({
      rows: [{ version: '001', name: '001_initial_schema' }],
    }); // schema_migrations

    await runner.run();

    // 001 was skipped, 002 was applied
    expect(mockDb.pool.connect).toHaveBeenCalledTimes(1);
    expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1;');
    expect(mockPoolClient.query).toHaveBeenCalledWith(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      ['002', '002_notifications'],
    );
    expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockPoolClient.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and rethrows error when a migration fails', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([
      '001_initial_schema.sql',
    ]);
    (fs.readFileSync as jest.Mock).mockReturnValue('INVALID SQL;');

    mockDb.query.mockResolvedValueOnce({ rows: [] }); // ensureMigrationsTable
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // schema_migrations

    const sqlError = new Error('Syntax error');
    mockPoolClient.query.mockImplementation(async (sql: string) => {
      if (sql === 'INVALID SQL;') throw sqlError;
      return { rows: [] };
    });

    await expect(runner.run()).rejects.toThrow('Syntax error');
    expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockPoolClient.release).toHaveBeenCalledTimes(1);
  });
});
