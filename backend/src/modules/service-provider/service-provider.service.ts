import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PermissionsService } from '../rbac/permissions.service';
import { isValidPhone, normalizePhone } from '../../common/utils/phone.util';

/** The accounts FK column the Account Manager role is ownership-scoped by. */
const ACCOUNT_MANAGER_SCOPE_FIELD = 'account_manager_id';

/** The five fields that make a Service Provider profile "complete". */
export type ServiceProviderField = 'name' | 'department' | 'designation' | 'email' | 'phone';

export const SERVICE_PROVIDER_REQUIRED_FIELDS: ServiceProviderField[] = [
  'name', 'department', 'designation', 'email', 'phone',
];

export interface ServiceProviderProfile {
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  /** True once the user has at least one linked SERVICE_PROVIDER stakeholder. */
  isServiceProvider: boolean;
  /** Required fields still missing (null / empty / whitespace). */
  missingFields: ServiceProviderField[];
  /** No required field is missing. */
  isComplete: boolean;
}

export interface UpdateServiceProviderInput {
  phone: string;
  name?: string;
  department?: string;
  designation?: string;
  email?: string;
}

/** A value counts as "missing" when null/undefined or blank after trimming. */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

/** Result of the one-time-safe Service Provider backfill. */
export interface ServiceProviderBackfillSummary {
  /** Non-deleted accounts that have an account_manager_id set. */
  accountsWithManager: number;
  /** Of those, how many already had a matching SERVICE_PROVIDER stakeholder. */
  alreadyRegistered: number;
  /** Of those, how many were missing one before the run. */
  missing: number;
  /** How many Service Provider stakeholders the run created (or adopted). */
  created: number;
  /** Still without one after the run (inactive / missing / not an Account Manager). */
  stillMissing: number;
}

/**
 * Owns the "Account Manager as Service Provider" behaviour.
 *
 * A Service Provider is not a separate entity — it is a SERVICE_PROVIDER
 * stakeholder row tied to the creating user via `stakeholders.user_id`. This
 * service is deliberately self-contained (only DatabaseService) so both
 * UsersModule and AccountsModule can import ServiceProviderModule without a
 * circular dependency.
 */
@Injectable()
export class ServiceProviderService {
  private readonly logger = new Logger(ServiceProviderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Auto-register a user as a SERVICE_PROVIDER stakeholder on an account.
   * Idempotent per (account, user) and safe to call on every account creation.
   * Skips silently for missing/inactive users so it never blocks account
   * creation. Returns the stakeholder id, or null when nothing was created.
   */
  async registerForAccount(userId: string, accountId: string): Promise<string | null> {
    if (!userId || !accountId) return null;

    // Inactive users are excluded from future auto-registration; their existing
    // stakeholders are left untouched.
    const { rows: userRows } = await this.db.query(
      `SELECT name, department, designation, email, is_active
       FROM users WHERE id = $1`,
      [userId],
    );
    const user = userRows[0];
    if (!user || user.is_active === false) {
      this.logger.log(`Skipping Service Provider registration [userId=${userId} reason=${user ? 'inactive' : 'missing'}]`);
      return null;
    }

    // Only genuine Account Managers become Service Providers. "Account Manager"
    // is resolved from RBAC config (the role scoped by account_manager_id), never
    // a hardcoded role name — the same signal the create flow uses to stamp the
    // FK. Centralising the check here makes registerForAccount the single, self-
    // guarding creation path for every caller (create / update / backfill).
    if (!(await this.isAccountManager(userId))) {
      this.logger.log(`Skipping Service Provider registration [userId=${userId} reason=not-account-manager]`);
      return null;
    }

    // Dedup: one Service Provider stakeholder per (account, user).
    const { rows: existing } = await this.db.query(
      `SELECT id FROM stakeholders
       WHERE account_id = $1 AND user_id = $2 AND is_deleted = FALSE
       LIMIT 1`,
      [accountId, userId],
    );
    if (existing.length) return existing[0].id;

    // Adopt an existing SERVICE_PROVIDER stakeholder with the same official
    // email on this account (e.g. added manually before): link it to the user
    // and align its identity fields rather than inserting a duplicate (also
    // avoids the per-account email clash).
    const email = String(user.email ?? '').trim();
    if (email) {
      const { rows: sameEmail } = await this.db.query(
        `SELECT id FROM stakeholders
         WHERE account_id = $1 AND stakeholder_type = 'SERVICE_PROVIDER'
           AND LOWER(email) = LOWER($2) AND is_deleted = FALSE
         LIMIT 1`,
        [accountId, email],
      );
      if (sameEmail.length) {
        await this.db.query(
          `UPDATE stakeholders SET
             user_id = $1, name = $2, department = $3, designation = $4,
             updated_at = NOW()
           WHERE id = $5`,
          [userId, user.name ?? '', user.department ?? null, user.designation ?? '', sameEmail[0].id],
        );
        this.logger.log(`Adopted existing Service Provider stakeholder [id=${sameEmail[0].id} userId=${userId} accountId=${accountId}]`);
        return sameEmail[0].id;
      }
    }

    // Reuse the phone already saved on any of the user's Service Provider records.
    const phone = await this.currentPhone(userId);

    const { rows } = await this.db.query(
      `INSERT INTO stakeholders
         (id, name, account_id, designation, influence, relationship, email, phone, stakeholder_type, department, user_id)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, 'High', 'Strong', $4, $5, 'SERVICE_PROVIDER', $6, $7)
       RETURNING id`,
      [
        user.name ?? '',
        accountId,
        user.designation ?? '',
        email,
        phone,
        user.department ?? null,
        userId,
      ],
    );
    const id = rows[0].id;
    this.logger.log(`Auto-registered Service Provider stakeholder [id=${id} userId=${userId} accountId=${accountId}]`);
    await this.log(`Registered '${user.name ?? 'user'}' as Service Provider`, accountId);
    return id;
  }

  /**
   * Whether the user holds the Account Manager role, using the existing RBAC
   * implementation. The Account Manager role is the one configured to scope
   * accounts by the account_manager_id FK (roles.account_scope_field) — resolved
   * from the data model, never a hardcoded role name. A user may hold several
   * roles at once, so we test the full set of scope fields their roles grant.
   */
  private async isAccountManager(userId: string): Promise<boolean> {
    const ctx = await this.permissions.getUserAccessContext(userId);
    return ctx.accountScopeFields.includes(ACCOUNT_MANAGER_SCOPE_FIELD);
  }

  /**
   * One-time-safe backfill: ensure every existing account whose
   * account_manager_id is set has a matching SERVICE_PROVIDER stakeholder for
   * that user.
   *
   * Delegates entirely to registerForAccount() — the single creation path — so
   * the same guarantees apply for free: missing/inactive users and non-Account-
   * Managers are skipped, and the per-(account, user) dedup makes it fully
   * idempotent (running it repeatedly never creates duplicates). Emits a summary
   * to the logs. A per-account failure is logged and never aborts the sweep.
   */
  async backfillServiceProviders(): Promise<ServiceProviderBackfillSummary> {
    const before = await this.investigateCoverage();
    this.logger.log(
      `Service Provider backfill starting — ${before.accountsWithManager} account(s) with an Account Manager, ` +
      `${before.alreadyRegistered} already registered, ${before.missing} missing`,
    );

    const { rows } = await this.db.query(
      `SELECT id, account_manager_id FROM accounts
       WHERE is_deleted = FALSE AND account_manager_id IS NOT NULL`,
    );

    for (const row of rows) {
      try {
        await this.registerForAccount(row.account_manager_id, row.id);
      } catch (err) {
        this.logger.error(
          `Backfill failed for account [accountId=${row.id} userId=${row.account_manager_id}]`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    const after = await this.investigateCoverage();
    const summary: ServiceProviderBackfillSummary = {
      accountsWithManager: before.accountsWithManager,
      alreadyRegistered: before.alreadyRegistered,
      missing: before.missing,
      created: after.alreadyRegistered - before.alreadyRegistered,
      stillMissing: after.missing,
    };
    this.logger.log(
      `Service Provider backfill complete — ${summary.created} created, ` +
      `${after.alreadyRegistered} now registered, ${summary.stillMissing} still without a ` +
      `Service Provider (inactive / missing / not an Account Manager)`,
    );
    return summary;
  }

  /**
   * Coverage stats over accounts with an Account Manager: how many exist and how
   * many already have a matching SERVICE_PROVIDER stakeholder for that same user
   * (matched on account_id + user_id — exactly the backfill's dedup key).
   */
  private async investigateCoverage(): Promise<{ accountsWithManager: number; alreadyRegistered: number; missing: number }> {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::INTEGER AS accounts_with_manager,
         (COUNT(*) FILTER (WHERE sp.id IS NOT NULL))::INTEGER AS already_registered
       FROM accounts a
       LEFT JOIN LATERAL (
         SELECT s.id FROM stakeholders s
         WHERE s.account_id = a.id
           AND s.user_id = a.account_manager_id
           AND s.stakeholder_type = 'SERVICE_PROVIDER'
           AND s.is_deleted = FALSE
         LIMIT 1
       ) sp ON TRUE
       WHERE a.is_deleted = FALSE AND a.account_manager_id IS NOT NULL`,
    );
    const accountsWithManager = rows[0]?.accounts_with_manager ?? 0;
    const alreadyRegistered = rows[0]?.already_registered ?? 0;
    return { accountsWithManager, alreadyRegistered, missing: accountsWithManager - alreadyRegistered };
  }

  /**
   * The current user's Service Provider profile: identity fields (from the user
   * record), the phone (from their stakeholder records), which required fields
   * are still missing, and whether they are a Service Provider at all.
   */
  async getMine(userId: string): Promise<ServiceProviderProfile> {
    const { rows } = await this.db.query(
      `SELECT name, department, designation, email FROM users WHERE id = $1`,
      [userId],
    );
    const user = rows[0] ?? {};
    const phone = await this.currentPhone(userId);
    const isServiceProvider = await this.hasStakeholder(userId);

    const values: Record<ServiceProviderField, string> = {
      name:        String(user.name ?? ''),
      department:  String(user.department ?? ''),
      designation: String(user.designation ?? ''),
      email:       String(user.email ?? ''),
      phone,
    };

    const missingFields = SERVICE_PROVIDER_REQUIRED_FIELDS.filter((f) => isBlank(values[f]));

    return {
      ...values,
      isServiceProvider,
      missingFields,
      isComplete: missingFields.length === 0,
    };
  }

  /**
   * Save the profile from the completion modal.
   *
   *   • Identity fields (name/department/designation/email) that are supplied —
   *     i.e. were missing on the user and collected by the modal — are written
   *     back to the users table, then propagated to every linked Service Provider
   *     stakeholder via syncFromUser().
   *   • The phone (validated) is written to every linked Service Provider
   *     stakeholder.
   *
   * Returns the recomputed profile.
   */
  async updateProfile(userId: string, input: UpdateServiceProviderInput): Promise<ServiceProviderProfile> {
    // Defence-in-depth: never trust the client. Mirror the DTO's phone rule here
    // so an updateProfile call from any path is validated identically.
    const phone = normalizePhone(input.phone);
    if (!isValidPhone(phone)) {
      // The DTO normally rejects this first (400). Guard the service path too.
      throw new Error('Invalid phone number');
    }

    const identityChanged = await this.updateUserIdentity(userId, input);
    if (identityChanged) {
      await this.syncFromUser(userId);
    }

    await this.updatePhone(userId, phone);
    return this.getMine(userId);
  }

  /**
   * Write supplied identity fields onto the users row. Only keys present (not
   * undefined) and non-blank are applied. Returns whether any column changed.
   */
  private async updateUserIdentity(userId: string, input: UpdateServiceProviderInput): Promise<boolean> {
    const columns: Record<string, string | undefined> = {
      name:        input.name,
      department:  input.department,
      designation: input.designation,
      email:       input.email,
    };
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [col, raw] of Object.entries(columns)) {
      if (raw === undefined) continue;
      const value = String(raw).trim();
      if (value === '') continue;
      sets.push(`${col} = $${idx++}`);
      params.push(value);
    }
    if (!sets.length) return false;

    params.push(userId);
    await this.db.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      params,
    );
    this.logger.log(`Updated user identity from Service Provider profile [userId=${userId} fields=${sets.length}]`);
    return true;
  }

  /**
   * Set the phone on every Service Provider stakeholder belonging to the user.
   * This is the single source of truth for the user's phone — future accounts
   * reuse it via registerForAccount.
   */
  async updatePhone(userId: string, phone: string): Promise<void> {
    const value = normalizePhone(phone);
    await this.db.query(
      `UPDATE stakeholders SET phone = $1, updated_at = NOW()
       WHERE user_id = $2 AND stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE`,
      [value, userId],
    );
    this.logger.log(`Updated Service Provider phone for all records [userId=${userId}]`);
  }

  /**
   * Push the user's current identity fields onto all their Service Provider
   * stakeholders. Deliberately limited to name/department/designation/email —
   * phone and account-specific fields (influence, relationship) are never
   * overwritten. Only updates existing rows, so it is safe during deactivation.
   */
  async syncFromUser(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE stakeholders s SET
         name = u.name,
         department = u.department,
         designation = u.designation,
         email = u.email,
         updated_at = NOW()
       FROM users u
       WHERE s.user_id = u.id
         AND s.user_id = $1
         AND s.stakeholder_type = 'SERVICE_PROVIDER'
         AND s.is_deleted = FALSE`,
      [userId],
    );
  }

  /** Whether the user has any linked Service Provider stakeholder. */
  private async hasStakeholder(userId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT 1 FROM stakeholders
       WHERE user_id = $1 AND stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE
       LIMIT 1`,
      [userId],
    );
    return rows.length > 0;
  }

  /** Latest non-empty phone stored on the user's Service Provider records. */
  private async currentPhone(userId: string): Promise<string> {
    const { rows } = await this.db.query(
      `SELECT phone FROM stakeholders
       WHERE user_id = $1 AND stakeholder_type = 'SERVICE_PROVIDER'
         AND is_deleted = FALSE AND COALESCE(TRIM(phone), '') <> ''
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0]?.phone ?? '';
  }

  private async log(text: string, accountId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'stakeholder', $1, 'System', $2)`,
        [text, accountId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
