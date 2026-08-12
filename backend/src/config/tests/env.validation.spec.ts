import { describe, it, expect } from '@jest/globals';
import { validateEnvironment } from '../env.validation';


const STRONG_SECRET = 'a'.repeat(64);

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://app:secret@localhost:5432/crm_db',
    JWT_SECRET: STRONG_SECRET,
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe('validateEnvironment', () => {
  it('passes with a minimal valid development environment', () => {
    const result = validateEnvironment(baseEnv());
    expect(result.errors).toEqual([]);
  });

  it('fails when DATABASE_URL is missing or not a postgres URL', () => {
    expect(validateEnvironment(baseEnv({ DATABASE_URL: undefined })).errors).toEqual([
      expect.stringContaining('DATABASE_URL is required'),
    ]);
    expect(validateEnvironment(baseEnv({ DATABASE_URL: 'mysql://x' })).errors).toEqual([
      expect.stringContaining('postgresql://'),
    ]);
  });

  it('fails when JWT_SECRET is missing', () => {
    const result = validateEnvironment(baseEnv({ JWT_SECRET: undefined }));
    expect(result.errors.some((e) => e.includes('JWT_SECRET is required'))).toBe(true);
  });

  it('treats weak/placeholder JWT_SECRET as warning in dev but error in production', () => {
    const weak = { JWT_SECRET: 'short-CHANGE-IN-PRODUCTION' };

    const dev = validateEnvironment(baseEnv(weak));
    expect(dev.errors).toEqual([]);
    expect(dev.warnings.length).toBeGreaterThanOrEqual(2); // marker + length

    const prod = validateEnvironment(
      baseEnv({
        ...weak,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://crm.example.com',
        UPLOAD_DIR: '/var/lib/acctrack/uploads',
      }),
    );
    expect(prod.errors.some((e) => e.includes('CHANGE-IN-PRODUCTION'))).toBe(true);
    expect(prod.errors.some((e) => e.includes('32 characters'))).toBe(true);
  });

  it('requires FRONTEND_URL and UPLOAD_DIR in production', () => {
    const result = validateEnvironment(baseEnv({ NODE_ENV: 'production' }));
    expect(result.errors.some((e) => e.startsWith('FRONTEND_URL is required'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('UPLOAD_DIR is required'))).toBe(true);
  });

  it('accepts a fully configured production environment', () => {
    const result = validateEnvironment(
      baseEnv({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://crm.example.com',
        UPLOAD_DIR: '/var/lib/acctrack/uploads',
        AZURE_TENANT_ID: 'tenant-id',
        AZURE_CLIENT_ID: 'client-id',
        AZURE_CLIENT_SECRET: 'client-secret',
      }),
    );
    expect(result.errors).toEqual([]);
  });

  it('accepts a production environment with missing Azure credentials (warning only)', () => {
    const result = validateEnvironment(
      baseEnv({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://crm.example.com',
        UPLOAD_DIR: '/var/lib/acctrack/uploads',
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes('Microsoft Graph email delivery is NOT configured'))).toBe(true);
  });

  it('warns in development if Graph config is partial', () => {
    const result = validateEnvironment(
      baseEnv({
        AZURE_TENANT_ID: 'tenant-id',
      }),
    );
    expect(result.warnings.some((w) => w.includes('AZURE_CLIENT_ID is missing'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('AZURE_CLIENT_SECRET is missing'))).toBe(true);
  });

  it('masks AZURE_CLIENT_SECRET in the summary', () => {
    const result = validateEnvironment(
      baseEnv({
        AZURE_CLIENT_SECRET: 'supersecretvalue',
      }),
    );
    const line = result.summary.find((s) => s.startsWith('AZURE_CLIENT_SECRET='));
    expect(line).toBeDefined();
    expect(line).not.toContain('supersecretvalue');
    expect(line).toContain('*** (16 chars)');
  });

  it('warns when UPLOAD_DIR is inside the application directory', () => {
    const inside = validateEnvironment(baseEnv({ UPLOAD_DIR: process.cwd() + '/uploads' }));
    expect(inside.warnings.some((w) => w.includes('inside the application directory'))).toBe(true);
  });

  it('rejects non-integer numeric tuning variables', () => {
    const result = validateEnvironment(baseEnv({ PORT: 'abc', BCRYPT_ROUNDS: '-1' }));
    expect(result.errors.some((e) => e.startsWith('PORT must be a positive integer'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('BCRYPT_ROUNDS must be a positive integer'))).toBe(true);
  });

  it('masks credentials in the DATABASE_URL summary line', () => {
    const result = validateEnvironment(baseEnv());
    const line = result.summary.find((s) => s.startsWith('DATABASE_URL='));
    expect(line).toBeDefined();
    expect(line).not.toContain('secret');
    expect(line).toContain('app:***@');
  });
});
