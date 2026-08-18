import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PermissionsService } from '../rbac/permissions.service';
import { isValidPhone, normalizePhone } from '../../common/utils/phone.util';

/** The accounts FK column the Account Manager role is ownership-scoped by. */
const ACCOUNT_MANAGER_SCOPE_FIELD = 'account_manager_id';

/** The five fields that make a Service Provider profile "complete". */
export type ServiceProviderField = 'name' | 'department' | 'designation' | 'email';

export const SERVICE_PROVIDER_REQUIRED_FIELDS: ServiceProviderField[] = [
  'name', 'department', 'designation', 'email',
];

export interface ServiceProviderProfile {
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  /** True — under the new model every System User is a Service Provider. */
  isServiceProvider: boolean;
  /** Required fields still missing (null / empty / whitespace). */
  missingFields: ServiceProviderField[];
  /** No required field is missing. */
  isComplete: boolean;
}

/** Identity behind a Service Provider directory id — a registered user or a pending whitelist entry. */
interface ServiceProviderIdentity {
  name: string;
  department: string | null;
  designation: string;
  email: string;
  /** Set for registered System Users; null while the person is pending registration. */
  userId: string | null;
  /** Set whenever the person has an employee_master (whitelist) row. */
  employeeId: string | null;
  isPending: boolean;
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
   * All Service Provider options — no is_active filter.
   *
   * The directory is the union of two populations, matched on email exactly as
   * the Administration user list does:
   *   • registered System Users (`users`), and
   *   • whitelisted employees who have not registered yet (`employee_master`
   *     rows with no matching user) — flagged `isPending`.
   *
   * A pending person is a real, assignable Service Provider: their `id` is the
   * employee_master id, and resolveOrCreate() links the stakeholder row through
   * `stakeholders.employee_id` until they register.
   */
  async findAllAsServiceProviders(): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT
         COALESCE(u.id, em.id)                                  AS id,
         COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), '')  AS name,
         COALESCE(u.email, em.email)                            AS email,
         COALESCE(u.department, em.department)                  AS department,
         COALESCE(u.designation, em.designation)                AS designation,
         COALESCE(u.is_active, TRUE)                            AS is_active,
         (u.id IS NULL)                                         AS is_pending
       FROM employee_master em
       FULL OUTER JOIN users u ON LOWER(u.email) = LOWER(em.email)
       ORDER BY COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) ASC NULLS LAST`,
    );
    return rows.map((r) => ({
      id:          r.id,
      name:        r.name ?? '',
      email:       r.email ?? '',
      department:  r.department ?? '',
      designation: r.designation ?? '',
      isActive:    r.is_active,
      isPending:   r.is_pending ?? false,
    }));
  }

  /**
   * Resolve a Service Provider directory id — which is either a `users.id` (a
   * registered System User) or an `employee_master.id` (a whitelisted person who
   * has not registered yet) — to the identity fields and the link column the
   * stakeholder row should carry. Returns null when the id matches neither.
   */
  private async resolveIdentity(id: string): Promise<ServiceProviderIdentity | null> {
    const { rows: userRows } = await this.db.query(
      `SELECT name, department, designation, email FROM users WHERE id = $1`,
      [id],
    );
    if (userRows.length) {
      const u = userRows[0];
      // Carry the whitelist id too (when the user has one) so the provenance
      // link is populated for registered users as well.
      const { rows: empRows } = await this.db.query(
        `SELECT id FROM employee_master WHERE LOWER(email) = LOWER($1)`,
        [String(u.email ?? '')],
      );
      return {
        name:        u.name ?? '',
        department:  u.department ?? null,
        designation: u.designation ?? '',
        email:       String(u.email ?? '').trim(),
        userId:      id,
        employeeId:  empRows[0]?.id ?? null,
        isPending:   false,
      };
    }

    const { rows: empRows } = await this.db.query(
      `SELECT id, name, department, designation, email FROM employee_master WHERE id = $1`,
      [id],
    );
    if (empRows.length) {
      const e = empRows[0];
      return {
        name:        e.name ?? '',
        department:  e.department ?? null,
        designation: e.designation ?? '',
        email:       String(e.email ?? '').trim(),
        userId:      null,
        employeeId:  e.id,
        isPending:   true,
      };
    }

    return null;
  }

  /**
   * Universal registration path: create/reuse a SERVICE_PROVIDER stakeholder for
   * (serviceProviderId, accountId). Works for ANY system user regardless of
   * role, active status or profile completeness, and equally for a whitelisted
   * employee who has not registered yet — in which case the row is linked via
   * `employee_id` and upgraded to a `user_id` link on registration.
   *
   * Idempotent per (account, user) and per (account, pending employee).
   */
  async resolveOrCreate(serviceProviderId: string, accountId: string): Promise<string | null> {
    if (!serviceProviderId || !accountId) return null;

    const identity = await this.resolveIdentity(serviceProviderId);
    if (!identity) {
      this.logger.log(`Skipping Service Provider registration [id=${serviceProviderId} reason=not-a-user-or-employee]`);
      return null;
    }

    // Dedup: one SERVICE_PROVIDER stakeholder per (account, person). Registered
    // users are keyed on user_id, pending employees on employee_id.
    const linkColumn = identity.userId ? 'user_id' : 'employee_id';
    const linkValue = identity.userId ?? identity.employeeId;
    const { rows: existing } = await this.db.query(
      `SELECT id FROM stakeholders
       WHERE account_id = $1 AND ${linkColumn} = $2 AND stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE
       LIMIT 1`,
      [accountId, linkValue],
    );
    if (existing.length) return existing[0].id;

    // Adopt an existing SERVICE_PROVIDER stakeholder with the same official
    // email on this account (e.g. added manually before): link it to the person.
    const email = identity.email;
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
             user_id = COALESCE($1, user_id), employee_id = COALESCE($2, employee_id),
             name = $3, department = $4, designation = $5,
             updated_at = NOW()
           WHERE id = $6`,
          [identity.userId, identity.employeeId, identity.name, identity.department, identity.designation, sameEmail[0].id],
        );
        this.logger.log(`Adopted existing Service Provider stakeholder [id=${sameEmail[0].id} ${linkColumn}=${linkValue} accountId=${accountId}]`);
        return sameEmail[0].id;
      }
    }

    // Reuse the phone already saved on any of this person's Service Provider records.
    const phone = identity.userId ? await this.currentPhone(identity.userId) : '';

    // The conflict target must match the link actually used so each population
    // hits its own partial unique index (uq_stk_account_user / uq_stk_account_employee).
    const conflictTarget = identity.userId ? '(account_id, user_id)' : '(account_id, employee_id)';
    const { rows } = await this.db.query(
      `INSERT INTO stakeholders
         (id, name, account_id, designation, influence, relationship, email, phone, stakeholder_type, department, user_id, employee_id)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, 'High', 'Strong', $4, $5, 'SERVICE_PROVIDER', $6, $7, $8)
       ON CONFLICT ${conflictTarget} WHERE stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [
        identity.name,
        accountId,
        identity.designation,
        email,
        phone,
        identity.department,
        identity.userId,
        identity.employeeId,
      ],
    );
    const id = rows[0].id;
    this.logger.log(
      `Auto-registered Service Provider stakeholder [id=${id} ${linkColumn}=${linkValue} ` +
      `accountId=${accountId} pending=${identity.isPending}]`,
    );
    await this.log(
      `Registered '${identity.name || email || 'user'}' as Service Provider` +
      (identity.isPending ? ' (pending registration)' : ''),
      accountId,
    );
    return id;
  }

  /**
   * Called right after a whitelisted employee completes registration: upgrade
   * every Service Provider stakeholder created for them while pending
   * (employee_id link, no user_id) to a full user link, then push their now
   * complete identity onto those rows.
   *
   * Never throws — a failure here must not fail the registration itself.
   */
  async linkRegisteredUser(userId: string, email: string): Promise<number> {
    const address = String(email ?? '').trim();
    if (!userId || !address) return 0;
    try {
      const { rowCount } = await this.db.query(
        `UPDATE stakeholders s SET user_id = $1, updated_at = NOW()
         FROM employee_master em
         WHERE s.employee_id = em.id
           AND s.user_id IS NULL
           AND s.stakeholder_type = 'SERVICE_PROVIDER'
           AND s.is_deleted = FALSE
           AND LOWER(em.email) = LOWER($2)`,
        [userId, address],
      );
      const linked = rowCount ?? 0;
      if (linked) {
        await this.syncFromUser(userId);
        this.logger.log(`Linked ${linked} pending Service Provider stakeholder(s) to newly registered user [userId=${userId}]`);
      }
      return linked;
    } catch (err) {
      this.logger.error(
        `Failed to link pending Service Provider stakeholders on registration [userId=${userId}]`,
        err instanceof Error ? err.stack : String(err),
      );
      return 0;
    }
  }

  /**
   * Backward-compatible wrapper: delegates to resolveOrCreate().
   * No longer restricted to Account Managers or active users.
   */
  async registerForAccount(userId: string, accountId: string): Promise<string | null> {
    return this.resolveOrCreate(userId, accountId);
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
    };

    const missingFields = SERVICE_PROVIDER_REQUIRED_FIELDS.filter((f) => isBlank(values[f]));

    return {
      ...values,
      phone,
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
