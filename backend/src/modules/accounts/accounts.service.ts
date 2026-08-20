import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { ServiceProviderService } from '../service-provider/service-provider.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { Account } from '../../types';
import { resolveOwnerName, extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';
import { validateDto } from '../../common/utils/validate-dto.util';
import { CreateAccountDto } from './dto/account.dto';
import { ACCOUNT_FIELDS } from '../import-export/import-field-schemas';
import { BulkModuleAdapter } from '../import-export/bulk-adapter';

// 'financial_year'/'quarter'/'financialYear' remain listed so payloads from
// older clients are stripped instead of leaking into custom_data — fiscal
// periods are derived from dates and never stored.
const KNOWN = new Set([
  'id','name','type','health','owner','ownerId','revenue','industry','since',
  'website','phone','email','address','location','description',
  'accountManagerId','practiceLeadId','clientPartnerId','verticalHeadId',
  'financial_year','quarter','financialYear',
  'clientStakeholderIds','serviceProviderUserIds',
]);

function rowToAccount(row: any): Account {
  const {
    custom_data, is_deleted, created_at, updated_at,
    owner_id, owner_name,
    account_manager_id, account_manager_name,
    practice_lead_id, practice_lead_name,
    client_partner_id, client_partner_name,
    vertical_head_id, vertical_head_name,
    ...base
  } = row;

  // Clean custom_data by stripping first-class fields to avoid overwriting them
  const cleanedCustomData = { ...custom_data };
  const firstClassFields = [
    'id', 'name', 'type', 'health', 'owner', 'ownerId', 'revenue', 'industry', 'since',
    'website', 'phone', 'email', 'address', 'location', 'description',
    'accountManagerId', 'accountManagerName',
    'practiceLeadId', 'practiceLeadName',
    'clientPartnerId', 'clientPartnerName',
    'verticalHeadId', 'verticalHeadName',
    'updatedAt'
  ];
  for (const field of firstClassFields) {
    delete cleanedCustomData[field];
  }

  return {
    ...base,
    revenue:   Number(base.revenue),
    ownerId:   owner_id   ?? undefined,
    owner:     owner_name ?? base.owner ?? '',
    accountManagerId:   account_manager_id   ?? undefined,
    accountManagerName: account_manager_name ?? '',
    practiceLeadId:     practice_lead_id      ?? undefined,
    practiceLeadName:   practice_lead_name    ?? '',
    clientPartnerId:    client_partner_id     ?? undefined,
    clientPartnerName:  client_partner_name   ?? '',
    verticalHeadId:     vertical_head_id      ?? undefined,
    verticalHeadName:   vertical_head_name    ?? '',
    // Exposed for the dashboard's "Recently Updated Accounts" widget.
    updatedAt: updated_at instanceof Date ? updated_at.toISOString() : updated_at,
    ...cleanedCustomData,
  } as Account;
}

const ACCOUNT_SELECT = `
  SELECT a.*,
         u.name  AS owner_name,
         COALESCE(NULLIF(am.name, ''), NULLIF(em_am.name, ''), am.email, em_am.email) AS account_manager_name,
         COALESCE(NULLIF(pl.name, ''), NULLIF(em_pl.name, ''), pl.email, em_pl.email) AS practice_lead_name,
         COALESCE(NULLIF(cp.name, ''), NULLIF(em_cp.name, ''), cp.email, em_cp.email) AS client_partner_name,
         COALESCE(NULLIF(vh.name, ''), NULLIF(em_vh.name, ''), vh.email, em_vh.email) AS vertical_head_name
  FROM accounts a
  LEFT JOIN users u  ON a.owner_id           = u.id
  LEFT JOIN users am ON a.account_manager_id = am.id
  LEFT JOIN employee_master em_am ON a.account_manager_id = em_am.id
  LEFT JOIN users pl ON a.practice_lead_id   = pl.id
  LEFT JOIN employee_master em_pl ON a.practice_lead_id   = em_pl.id
  LEFT JOIN users cp ON a.client_partner_id  = cp.id
  LEFT JOIN employee_master em_cp ON a.client_partner_id  = em_cp.id
  LEFT JOIN users vh ON a.vertical_head_id   = vh.id
  LEFT JOIN employee_master em_vh ON a.vertical_head_id   = em_vh.id
`;

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly access: AccessScopeService,
    private readonly serviceProvider: ServiceProviderService,
    private readonly bus: NotificationEventBus,
  ) {}

  /**
   * Role-aware visibility fragment for the accounts alias `a`. When userId is
   * absent (internal calls, e.g. re-reading a row just written) no scoping is
   * applied. Admin/Sales/Finance (view-all) get no restriction; ownership-scoped
   * roles are limited to their assigned accounts.
   */
  private async accountScope(userId: string | null, startIdx: number): Promise<{ conditions: string[]; params: any[]; nextIdx: number }> {
    if (!userId) return { conditions: [], params: [], nextIdx: startIdx };
    const ctx = await this.access.getContext(userId);
    return this.access.buildAccountVisibility('a', ctx, startIdx);
  }

  /**
   * Bulk adapter used by the Global Import/Export service. Each account row is
   * validated against CreateAccountDto and created/updated via the standard
   * create()/update() paths, so account name uniqueness, custom_data, audit
   * activity and notifications all apply per row. Duplicates are matched by
   * active account name (global, case-insensitive) per the uq_acc_name_active
   * index. Accounts have no parent references, so the workbook is the source.
   */
  bulkAdapter(userId: string): BulkModuleAdapter {
    return {
      moduleKey: 'accounts',
      fields: ACCOUNT_FIELDS,
      validate: (row) => validateDto(CreateAccountDto, row),
      naturalKey: (row) => (row.name ? String(row.name).trim().toLowerCase() : null),
      findExistingId: (row) => this.findActiveByName(row.name),
      create: (row) => this.create({ ...row, ownerId: userId }),
      update: (id, row) => this.update(id, row, userId),
    };
  }

  private async findActiveByName(name?: string): Promise<string | null> {
    const n = String(name ?? '').trim();
    if (!n) return null;
    const { rows } = await this.db.query(
      `SELECT id FROM accounts WHERE LOWER(TRIM(name)) = LOWER($1) AND is_deleted = FALSE LIMIT 1`,
      [n],
    );
    return rows[0]?.id ?? null;
  }

  // Accounts are long-term customers — never filtered by fiscal period.
  // Only owner scoping applies; any financialYear/quarter params are ignored.
  // With `pg` set (opt-in ?page= query), returns a Paginated envelope instead
  // of the legacy plain array.
  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Account[] | Paginated<Account>> {
    const f = this.filter.normalize(params);
    const { conditions, params: qParams, nextIdx } = await this.accountScope(f.userId, 1);
    const where = ['a.is_deleted = FALSE', ...conditions].join(' AND ');

    if (!pg) {
      const { rows } = await this.db.query(
        `${ACCOUNT_SELECT} WHERE ${where} ORDER BY a.created_at DESC`,
        qParams,
      );
      return rows.map(rowToAccount);
    }

    const { rows } = await this.db.query(
      `SELECT a.*,
              u.name  AS owner_name,
              COALESCE(NULLIF(am.name, ''), NULLIF(em_am.name, ''), am.email, em_am.email) AS account_manager_name,
              COALESCE(NULLIF(pl.name, ''), NULLIF(em_pl.name, ''), pl.email, em_pl.email) AS practice_lead_name,
              COALESCE(NULLIF(cp.name, ''), NULLIF(em_cp.name, ''), cp.email, em_cp.email) AS client_partner_name,
              COALESCE(NULLIF(vh.name, ''), NULLIF(em_vh.name, ''), vh.email, em_vh.email) AS vertical_head_name,
              COUNT(*) OVER()::INTEGER AS __total
       FROM accounts a
       LEFT JOIN users u  ON a.owner_id           = u.id
       LEFT JOIN users am ON a.account_manager_id = am.id
       LEFT JOIN employee_master em_am ON a.account_manager_id = em_am.id
       LEFT JOIN users pl ON a.practice_lead_id   = pl.id
       LEFT JOIN employee_master em_pl ON a.practice_lead_id   = em_pl.id
       LEFT JOIN users cp ON a.client_partner_id  = cp.id
       LEFT JOIN employee_master em_cp ON a.client_partner_id  = em_cp.id
       LEFT JOIN users vh ON a.vertical_head_id   = vh.id
       LEFT JOIN employee_master em_vh ON a.vertical_head_id   = em_vh.id
       WHERE ${where} ORDER BY a.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...qParams, pg.limit, pg.offset],
    );
    const total = extractTotal(rows);
    return { data: rows.map(rowToAccount), total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(id: string, userId?: string): Promise<Account> {
    const { conditions, params } = await this.accountScope(userId ?? null, 2);
    const scopeClause = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `${ACCOUNT_SELECT} WHERE a.id = $1 AND a.is_deleted = FALSE${scopeClause}`,
      [id, ...params],
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
         (id, name, type, health, owner_id, owner,
          account_manager_id, practice_lead_id, client_partner_id, vertical_head_id,
          revenue, industry, since, website, phone, email, address, location, description, custom_data)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        name, data.type, data.health,
        data.ownerId ?? null, ownerDisplayName,
        data.accountManagerId ?? null, data.practiceLeadId ?? null,
        data.clientPartnerId ?? null, data.verticalHeadId ?? null,
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

    // Associate existing client stakeholders (array or singular)
    const clientIds: string[] = [];
    if (data.clientStakeholderId) clientIds.push(data.clientStakeholderId);
    if (Array.isArray(data.clientStakeholderIds)) clientIds.push(...data.clientStakeholderIds);
    if (clientIds.length > 0) {
      await this.db.query(
        `UPDATE stakeholders SET account_id = $1, updated_at = NOW() WHERE id = ANY($2) AND stakeholder_type = 'CLIENT'`,
        [account.id, clientIds],
      );
      this.logger.log(`Associated client stakeholders [ids=${clientIds.join(',')} accountId=${account.id}]`);
    }

    // Create a new client stakeholder
    if (data.clientStakeholderDraft) {
      const draft = data.clientStakeholderDraft;
      await this.db.query(
        `INSERT INTO stakeholders
           (id, name, account_id, designation, influence, relationship, email, phone, stakeholder_type, department)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, 'CLIENT', $8)`,
        [
          draft.name,
          account.id,
          draft.designation || '',
          draft.influence || 'Medium',
          draft.relationship || 'Neutral',
          draft.email || '',
          draft.phone || '',
          draft.department || '',
        ],
      );
      this.logger.log(`Created new client stakeholder [name=${draft.name} accountId=${account.id}]`);
    }

    // Resolve and associate selected Service Providers from system users
    const spUserIds: string[] = [];
    if (data.serviceProviderUserId) spUserIds.push(data.serviceProviderUserId);
    if (Array.isArray(data.serviceProviderUserIds)) spUserIds.push(...data.serviceProviderUserIds);
    for (const spUserId of spUserIds) {
      try {
        await this.serviceProvider.resolveOrCreate(spUserId, account.id);
      } catch (err) {
        this.logger.error(
          `Service Provider auto-registration failed [userId=${spUserId} accountId=${account.id}]`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

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

    // Role-ownership FKs are updatable. `undefined` (field absent from payload,
    // e.g. a bulk import row) preserves the existing value; an explicit `null`
    // clears the assignment.
    const keepFk = (incoming: any, current: any) =>
      incoming !== undefined ? incoming : (current ?? null);
    const accountManagerId = keepFk(data.accountManagerId, existing.accountManagerId);
    const practiceLeadId   = keepFk(data.practiceLeadId,   existing.practiceLeadId);
    const clientPartnerId  = keepFk(data.clientPartnerId,  existing.clientPartnerId);
    const verticalHeadId   = keepFk(data.verticalHeadId,   existing.verticalHeadId);

    await this.db.query(
      `UPDATE accounts SET
         name=$1, type=$2, health=$3, owner_id=$4, owner=$5,
         account_manager_id=$6, practice_lead_id=$7, client_partner_id=$8, vertical_head_id=$9,
         revenue=$10, industry=$11, since=$12, website=$13, phone=$14, email=$15,
         address=$16, location=$17, description=$18, custom_data=$19, updated_at=NOW()
       WHERE id=$20 AND is_deleted=FALSE`,
      [
        name, data.type, data.health,
        effectiveOwnerId, ownerDisplayName || existing.owner,
        accountManagerId, practiceLeadId, clientPartnerId, verticalHeadId,
        data.revenue ?? 0, data.industry ?? '', since,
        data.website ?? '', data.phone ?? '', data.email ?? '',
        data.address ?? '', data.location ?? '', data.description ?? '',
        JSON.stringify(cd), id,
      ],
    ).catch((err) => { throw this.mapNameConflict(err, name); });
    const account = await this.findOne(id);
    await this.log(`Updated Account '${account.name}'`, account.id, requestingUserId);

    // Process client stakeholders if clientStakeholderIds is explicitly supplied
    if (data.clientStakeholderIds !== undefined) {
      const newClientIds: string[] = Array.isArray(data.clientStakeholderIds) ? data.clientStakeholderIds : [];
      // 1. Detach client stakeholders who were on this account but are no longer selected
      await this.db.query(
        `UPDATE stakeholders SET account_id = NULL, updated_at = NOW() 
         WHERE account_id = $1 AND stakeholder_type = 'CLIENT' AND NOT (id = ANY($2))`,
        [account.id, newClientIds],
      );
      // 2. Attach newly selected client stakeholders to this account
      if (newClientIds.length > 0) {
        await this.db.query(
          `UPDATE stakeholders SET account_id = $1, updated_at = NOW() 
           WHERE id = ANY($2) AND stakeholder_type = 'CLIENT'`,
          [account.id, newClientIds],
        );
      }
      this.logger.log(`Updated client stakeholders for account [accountId=${account.id} count=${newClientIds.length}]`);
    } else if (data.clientStakeholderId) {
      await this.db.query(
        `UPDATE stakeholders SET account_id = $1, updated_at = NOW() WHERE id = $2`,
        [account.id, data.clientStakeholderId],
      );
      this.logger.log(`Associated existing client stakeholder [id=${data.clientStakeholderId} accountId=${account.id}]`);
    }

    // Create a new client stakeholder
    if (data.clientStakeholderDraft) {
      const draft = data.clientStakeholderDraft;
      await this.db.query(
        `INSERT INTO stakeholders
           (id, name, account_id, designation, influence, relationship, email, phone, stakeholder_type, department)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, 'CLIENT', $8)`,
        [
          draft.name,
          account.id,
          draft.designation || '',
          draft.influence || 'Medium',
          draft.relationship || 'Neutral',
          draft.email || '',
          draft.phone || '',
          draft.department || '',
        ],
      );
      this.logger.log(`Created new client stakeholder [name=${draft.name} accountId=${account.id}]`);
    }

    // Process service provider stakeholders if serviceProviderUserIds is explicitly supplied
    if (data.serviceProviderUserIds !== undefined) {
      const newSpUserIds: string[] = Array.isArray(data.serviceProviderUserIds) ? data.serviceProviderUserIds : [];
      // 1. Mark as deleted any service providers who are no longer selected
      await this.db.query(
        // COALESCE so pending-registration Service Providers (linked by
        // employee_id, no user_id yet) are deselectable too. Rows with neither
        // link are manually created stakeholders and are never touched here.
        `UPDATE stakeholders SET is_deleted = TRUE, updated_at = NOW()
         WHERE account_id = $1 AND stakeholder_type = 'SERVICE_PROVIDER' AND is_deleted = FALSE
           AND COALESCE(user_id, employee_id) IS NOT NULL
           AND NOT (COALESCE(user_id, employee_id) = ANY($2))`,
        [account.id, newSpUserIds],
      );
      // 2. Resolve/register selected service providers
      for (const spUserId of newSpUserIds) {
        try {
          await this.serviceProvider.resolveOrCreate(spUserId, account.id);
        } catch (err) {
          this.logger.error(
            `Service Provider auto-registration failed [userId=${spUserId} accountId=${account.id}]`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    } else if (data.serviceProviderUserId) {
      try {
        await this.serviceProvider.resolveOrCreate(data.serviceProviderUserId, account.id);
      } catch (err) {
        this.logger.error(
          `Service Provider auto-registration failed [userId=${data.serviceProviderUserId} accountId=${account.id}]`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }



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
    const { conditions, params: qParams } = await this.accountScope(f.userId, 1);
    const where = ['a.is_deleted = TRUE', ...conditions].join(' AND ');
    const { rows } = await this.db.query(
      `${ACCOUNT_SELECT} WHERE ${where} ORDER BY a.updated_at DESC`,
      qParams,
    );
    return rows.map(rowToAccount);
  }

  async restore(id: string, userId?: string): Promise<Account> {
    const { conditions, params } = await this.accountScope(userId ?? null, 2);
    const scopeClause = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const { rows: pending } = await this.db.query(
      `SELECT a.name, a.owner_id FROM accounts a WHERE a.id=$1 AND a.is_deleted=TRUE${scopeClause}`,
      [id, ...params],
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
