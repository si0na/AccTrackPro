import * as path from 'path';

/**
 * Startup environment validation.
 *
 * Called once from main.ts before the Nest application is created so a
 * misconfigured process fails fast with an actionable message instead of
 * limping along with insecure defaults (or crashing mid-request).
 *
 * - `errors`   → fatal; the process must not start.
 * - `warnings` → logged, but the process may continue (dev conveniences).
 * - `summary`  → one-line-per-setting log of the effective configuration,
 *                with credentials masked.
 */
export interface EnvValidationResult {
  errors: string[];
  warnings: string[];
  summary: string[];
}

const INSECURE_SECRET_MARKER = 'CHANGE-IN-PRODUCTION';
const MIN_SECRET_LENGTH = 32;

/** Env vars that, when set, must parse as a positive integer. */
const POSITIVE_INT_VARS = [
  'PORT',
  'ACCESS_TOKEN_EXPIRY_SECS',
  'REFRESH_TOKEN_EXPIRY_SECS',
  'MAX_LOGIN_ATTEMPTS',
  'LOCKOUT_DURATION_MINUTES',
  'BCRYPT_ROUNDS',
  'DB_POOL_MAX',
  'DB_IDLE_TIMEOUT_MS',
  'DB_CONN_TIMEOUT_MS',
];

/** Mask the password segment of a postgres connection string for logging. */
function maskDatabaseUrl(url: string): string {
  return url.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@');
}

export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: string[] = [];

  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    warnings.push(
      `NODE_ENV="${nodeEnv}" is not one of development/production/test — treating as development`,
    );
  }
  summary.push(`NODE_ENV=${nodeEnv}`);

  // ── DATABASE_URL (always required) ─────────────────────────────────────────
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required (postgresql://user:pass@host:5432/db)');
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL must be a postgresql:// connection string');
  } else {
    summary.push(`DATABASE_URL=${maskDatabaseUrl(databaseUrl)}`);
  }

  // ── JWT_SECRET (always required — no insecure fallback exists any more) ────
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push(
      'JWT_SECRET is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  } else {
    if (jwtSecret.includes(INSECURE_SECRET_MARKER)) {
      const msg = `JWT_SECRET still contains the placeholder marker "${INSECURE_SECRET_MARKER}" — replace it with a generated secret`;
      if (isProduction) errors.push(msg);
      else warnings.push(msg);
    }
    if (jwtSecret.length < MIN_SECRET_LENGTH) {
      const msg = `JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters — use a longer random secret`;
      if (isProduction) errors.push(msg);
      else warnings.push(msg);
    }
    summary.push(`JWT_SECRET=*** (${jwtSecret.length} chars)`);
  }

  // ── FRONTEND_URL (required in production — CORS would silently fall back
  //    to http://localhost:5173 and block every real browser request) ─────────
  const frontendUrl = env.FRONTEND_URL;
  if (!frontendUrl) {
    if (isProduction) {
      errors.push('FRONTEND_URL is required in production (CORS allowed origin)');
    } else {
      summary.push('FRONTEND_URL=(default) http://localhost:5173');
    }
  } else if (!/^https?:\/\//.test(frontendUrl)) {
    errors.push(`FRONTEND_URL must be an http(s) URL, got "${frontendUrl}"`);
  } else {
    summary.push(`FRONTEND_URL=${frontendUrl}`);
  }

  // ── UPLOAD_DIR (required in production — the default lives inside the
  //    application directory and is wiped by every redeploy) ──────────────────
  const uploadDir = env.UPLOAD_DIR;
  if (!uploadDir) {
    if (isProduction) {
      errors.push(
        'UPLOAD_DIR is required in production and must point outside the application ' +
          'directory (e.g. /var/lib/acctrack/uploads) so uploaded documents survive redeploys',
      );
    } else {
      summary.push(`UPLOAD_DIR=(default) ${path.join(process.cwd(), 'uploads')}`);
    }
  } else {
    const resolved = path.resolve(uploadDir);
    const appDir = path.resolve(process.cwd());
    if (resolved === appDir || resolved.startsWith(appDir + path.sep)) {
      warnings.push(
        `UPLOAD_DIR (${resolved}) is inside the application directory (${appDir}) — uploads will not survive a redeploy`,
      );
    }
    summary.push(`UPLOAD_DIR=${resolved}`);
  }

  // ── Microsoft Graph (required in production, warning in dev) ────────────────
  const azureTenantId = env.AZURE_TENANT_ID;
  const azureClientId = env.AZURE_CLIENT_ID;
  const azureClientSecret = env.AZURE_CLIENT_SECRET;
  const graphSenderEmail = env.GRAPH_SENDER_EMAIL ?? 'noreply@reflectionsinfos.com';

  if (isProduction) {
    if (!azureTenantId) errors.push('AZURE_TENANT_ID is required');
    if (!azureClientId) errors.push('AZURE_CLIENT_ID is required');
    if (!azureClientSecret) errors.push('AZURE_CLIENT_SECRET is required');
  } else {
    const hasAny = azureTenantId || azureClientId || azureClientSecret;
    if (hasAny) {
      if (!azureTenantId) warnings.push('AZURE_TENANT_ID is missing');
      if (!azureClientId) warnings.push('AZURE_CLIENT_ID is missing');
      if (!azureClientSecret) warnings.push('AZURE_CLIENT_SECRET is missing');
    } else {
      warnings.push('Microsoft Graph email delivery is NOT configured (password reset emails will not be sent)');
    }
  }

  if (azureTenantId) summary.push(`AZURE_TENANT_ID=${azureTenantId}`);
  if (azureClientId) summary.push(`AZURE_CLIENT_ID=${azureClientId}`);
  if (azureClientSecret) summary.push(`AZURE_CLIENT_SECRET=*** (${azureClientSecret.length} chars)`);
  summary.push(`GRAPH_SENDER_EMAIL=${graphSenderEmail}`);

  // ── Numeric tuning vars: only validated when explicitly set ────────────────
  for (const name of POSITIVE_INT_VARS) {
    const raw = env[name];
    if (raw === undefined || raw === '') continue;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.push(`${name} must be a positive integer, got "${raw}"`);
    }
  }
  const port = env.PORT ?? '3000';
  summary.push(`PORT=${port}`);

  return { errors, warnings, summary };
}
