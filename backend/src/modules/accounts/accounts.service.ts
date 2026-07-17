import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { Account } from '../../types';
import { resolveOwnerName, extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';

// 'financial_year'/'quarter'/'financialYear' remain listed so payloads from
// older clients are stripped instead of leaking into custom_data — fiscal
// periods are derived from dates and never stored.
const KNOWN = new Set([
  'id','name','type','health','owner','ownerId','revenue','industry','since',
  'website','phone','email','address','location','description',
  'financial_year','quarter','financialYear',
]);

function rowToAccount(row: any): Account {
  const { custom_data, is_deleted, created_at, updated_at, owner_id, owner_name, ...base } = row;
  return {
    ...base,
    revenue:   Number(base.revenue),
    ownerId:   owner_id   ?? undefined,
    owner:     owner_name ?? base.owner ?? '',
    // Exposed for the dashboard's "Recently Updated Accounts" widget.
    updatedAt: updated_at instanceof Date ? updated_at.toISOString() : updated_at,
    ...(custom_data || {}),
  } as Account;
}

const ACCOUNT_SELECT = `
  SELECT a.*, u.name AS owner_name
  FROM accounts a
  LEFT JOIN users u ON a.owner_id = u.id
`;

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly bus: NotificationEventBus,
  ) {}

  // Accounts are long-term customers — never filtered by fiscal period.
  // Only owner scoping applies; any financialYear/quarter params are ignored.
  // With `pg` set (opt-in ?page= query), returns a Paginated envelope instead
  // of the legacy plain array.
  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Account[] | Paginated<Account>> {
    const f = this.filter.normalize(params);
    const { conditions, params: qParams, nextIdx } = this.filter.buildOwnerConditions('a', f, 1);
    const where = ['a.is_deleted = FALSE', ...conditions].join(' AND ');

    if (!pg) {
      const { rows } = await this.db.query(
        `${ACCOUNT_SELECT} WHERE ${where} ORDER BY a.created_at DESC`,
        qParams,
      );
      return rows.map(rowToAccount);
    }

    const { rows } = await this.db.query(
      `SELECT a.*, u.name AS owner_name, COUNT(*) OVER()::INTEGER AS __total
       FROM accounts a
       LEFT JOIN users u ON a.owner_id = u.id
       WHERE ${where} ORDER BY a.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...qParams, pg.limit, pg.offset],
    );
    const total = extractTotal(rows);
    return { data: rows.map(rowToAccount), total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(id: string, userId?: string): Promise<Account> {
    const { rows } = await this.db.query(
      `${ACCOUNT_SELECT} WHERE a.id = $1 AND a.is_deleted = FALSE
       AND ($2::TEXT IS NULL OR a.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Account "${id}" not found`);
    return rowToAccount(rows[0]);
  }

  async create(data: any): Promise<Account> {
    this.logger.log(`Creating account [name="${data.name}" ownerId=${data.ownerId ?? 'MISSING'}]`);

    if (!data.ownerId) {
      this.logger.error(
        'Account creation attempted without ownerId — this should never happen when the ' +
        'controller correctly injects the JWT sub. Check JwtAuthGuard is active.',
      );
    }

    const name = String(data.name ?? '').trim();
    await this.assertNameAvailable(name);

    const cd = extractCustomData(data, KNOWN);
    const ownerDisplayName = await resolveOwnerName(this.db, data.ownerId);

    const { rows } = await this.db.query(
      `INSERT INTO accounts
         (id, name, type, health, owner_id, owner, revenue, industry, since, website, phone, email, address, location, description, custom_data)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        name, data.type, data.health,
        data.ownerId ?? null, ownerDisplayName,
        data.revenue ?? 0, data.industry ?? '', data.since ?? '',
        data.website ?? '', data.phone ?? '', data.email ?? '',
        data.address ?? '', data.location ?? '', data.description ?? '',
        JSON.stringify(cd),
      ],
    ).catch((err) => { throw this.mapNameConflict(err, name); });
    const account = await this.findOne(rows[0].id);
    this.logger.log(
      `Account created [id=${account.id} name="${account.name}" ownerId=${account.ownerId ?? 'NULL'}]`,
    );
    await this.log(`Created Account '${account.name}'`, account.id, data.ownerId);

    if (account.ownerId) {
      this.logger.log(`Emitting Account:Created notification [userId=${account.ownerId} accountId=${account.id}]`);
      this.bus.emit({
        userId:               account.ownerId,
        type:                 'Account',
        eventType:            'Created',
        title:                'Account Created',
        message:              `Account "${account.name}" has been added to the CRM.`,
        severity:             'Success',
        notificationCategory: 'BUSINESS',
        accountId:            account.id,
      });
    } else {
      this.logger.warn(
        `Account created without ownerId — notification suppressed [accountId=${account.id}]`,
      );
    }
    return account;
  }

  /**
   * Update an account.
   *
   * @param id              Account primary key
   * @param data            Updated fields (must NOT include ownerId — controller strips it)
   * @param requestingUserId UUID of the authenticated user performing the update (enforces ownership + audit)
   */
  async update(id: string, data: any, requestingUserId?: string): Promise<Account> {
    const existing = await this.findOne(id, requestingUserId);
    const name = String(data.name ?? '').trim();
    await this.assertNameAvailable(name, id);
    const cd = extractCustomData(data, KNOWN);

    // Ownership is never changed by a regular update — always preserved from DB.
    // An admin reassignment flow must go through a dedicated endpoint.
    const effectiveOwnerId = existing.ownerId ?? null;
    const ownerDisplayName = await resolveOwnerName(this.db, effectiveOwnerId ?? undefined);

    const since = data.since ?? existing.since ?? '';

    await this.db.query(
      `UPDATE accounts SET
         name=$1, type=$2, health=$3, owner_id=$4, owner=$5, revenue=$6, industry=$7,
         since=$8, website=$9, phone=$10, email=$11, address=$12, location=$13,
         description=$14, custom_data=$15, updated_at=NOW()
       WHERE id=$16 AND is_deleted=FALSE`,
      [
        name, data.type, data.health,
        effectiveOwnerId, ownerDisplayName || existing.owner,
        data.revenue ?? 0, data.industry ?? '', since,
        data.website ?? '', data.phone ?? '', data.email ?? '',
        data.address ?? '', data.location ?? '', data.description ?? '',
        JSON.stringify(cd), id,
      ],
    ).catch((err) => { throw this.mapNameConflict(err, name); });
    const account = await this.findOne(id);
    await this.log(`Updated Account '${account.name}'`, account.id, requestingUserId);

    if (account.ownerId) {
      this.logger.log(`Emitting Account:Updated notification [userId=${account.ownerId} accountId=${account.id}]`);
      this.bus.emit({
        userId:               account.ownerId,
        type:                 'Account',
        eventType:            'Updated',
        title:                'Account Updated',
        message:              `Account "${account.name}" details have been updated.`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId:            account.id,
      });
    }
    return account;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const account = await this.findOne(id, userId);
    await this.db.withTransaction(async (client) => {
      await client.query(`UPDATE accounts      SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1`, [id]);
      await client.query(`UPDATE opportunities SET is_deleted=TRUE, updated_at=NOW() WHERE account_id=$1 AND is_deleted=FALSE`, [id]);
      await client.query(`UPDATE action_items  SET is_deleted=TRUE, updated_at=NOW() WHERE account_id=$1 AND is_deleted=FALSE`, [id]);
      await client.query(`UPDATE stakeholders  SET is_deleted=TRUE, updated_at=NOW() WHERE account_id=$1 AND is_deleted=FALSE`, [id]);
    });
    await this.log(`Deactivated Account '${account.name}'`, account.id);

    if (account.ownerId) {
      this.logger.log(`Emitting Account:Deactivated notification [userId=${account.ownerId} accountId=${account.id}]`);
      this.bus.emit({
        userId:               account.ownerId,
        type:                 'Account',
        eventType:            'Deactivated',
        title:                'Account Deactivated',
        message:              `Account "${account.name}" has been deactivated along with its related records.`,
        severity:             'Warning',
        notificationCategory: 'BUSINESS',
        accountId:            account.id,
      });
    }
    return { success: true };
  }

  async findAllDeactivated(params: FilterParams = {}): Promise<Account[]> {
    const f = this.filter.normalize(params);
    const { conditions, params: qParams } = this.filter.buildOwnerConditions('a', f, 1);
    const where = ['a.is_deleted = TRUE', ...conditions].join(' AND ');
    const { rows } = await this.db.query(
      `${ACCOUNT_SELECT} WHERE ${where} ORDER BY a.updated_at DESC`,
      qParams,
    );
    return rows.map(rowToAccount);
  }

  async restore(id: string, userId?: string): Promise<Account> {
    const { rows: pending } = await this.db.query(
      `SELECT name, owner_id FROM accounts WHERE id=$1 AND is_deleted=TRUE
       AND ($2::TEXT IS NULL OR owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!pending.length) throw new NotFoundException(`Deactivated account "${id}" not found`);
    // Business rule: restoring must not resurrect a duplicate — the name may
    // have been reused by a new active account while this one was deactivated.
    await this.assertNameAvailable(pending[0].name, id);

    const { rows } = await this.db.query(
      `UPDATE accounts SET is_deleted=FALSE, updated_at=NOW()
       WHERE id=$1 AND is_deleted=TRUE RETURNING id`,
      [id],
    ).catch((err) => { throw this.mapNameConflict(err, pending[0].name); });
    if (!rows.length) throw new NotFoundException(`Deactivated account "${id}" not found`);
    const account = await this.findOne(id);
    await this.log(`Restored Account '${account.name}'`, account.id);

    if (account.ownerId) {
      this.bus.emit({
        userId:               account.ownerId,
        type:                 'Account',
        eventType:            'Restored',
        title:                'Account Restored',
        message:              `Account "${account.name}" has been restored.`,
        severity:             'Success',
        notificationCategory: 'BUSINESS',
        accountId:            account.id,
      });
    }
    return account;
  }

  /**
   * Maps a unique-index violation on the account-name unique index (two
   * concurrent writes passing the application-side check) to the same 409 the
   * check produces. Handles both the current global index and the legacy per-user one.
   */
  private mapNameConflict(err: any, _name: string): any {
    if (err?.code === '23505' && (
      String(err?.constraint ?? '').includes('uq_acc_name_active') ||
      String(err?.constraint ?? '').includes('uq_acc_name_user_active')
    )) {
      return new ConflictException('An account with this name already exists.');
    }
    return err;
  }

  /** Business rule: active account names must be globally unique (case-insensitive). */
  private async assertNameAvailable(name: string, excludeId?: string): Promise<void> {
    if (!name) return;
    const { rows } = await this.db.query(
      `SELECT id FROM accounts
       WHERE LOWER(TRIM(name)) = LOWER($1) AND is_deleted = FALSE
         AND ($2::TEXT IS NULL OR id <> $2)`,
      [name.trim(), excludeId ?? null],
    );
    if (rows.length) {
      throw new ConflictException('An account with this name already exists.');
    }
  }

  private async log(text: string, accountId?: string, userId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'account', $1, $2, 'System', $3)`,
        [text, userId ?? null, accountId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
