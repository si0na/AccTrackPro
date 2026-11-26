import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AccountsService } from './accounts.service';
import {
  CreateAccountWeeklyHealthDto,
  UpdateAccountWeeklyHealthDto,
} from './dto/account-weekly-health.dto';
import type { AccountWeeklyHealth, AccountHealth } from '../../types';

function rowToWeeklyHealth(row: any): AccountWeeklyHealth {
  // Format reporting_date as YYYY-MM-DD
  let reportingDateStr = '';
  if (row.reporting_date_str) {
    reportingDateStr = row.reporting_date_str;
  } else if (row.reporting_date instanceof Date) {
    reportingDateStr = row.reporting_date.toISOString().slice(0, 10);
  } else if (typeof row.reporting_date === 'string') {
    reportingDateStr = row.reporting_date.slice(0, 10);
  }

  return {
    id: row.id,
    accountId: row.account_id,
    reportingDate: reportingDateStr,
    healthStatus: row.health_status as AccountHealth,
    summary: row.summary,
    keyUpdates: row.key_updates ?? '',
    risksAndIssues: row.risks_and_issues ?? '',
    actionItemsMitigation: row.action_items_mitigation ?? '',
    owner: row.owner || row.owner_user_name || '',
    ownerId: row.owner_id ?? undefined,
    nextSteps: row.next_steps ?? '',
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    updatedByName: row.updated_by_name ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

const SELECT_QUERY = `
  SELECT h.*,
         to_char(h.reporting_date, 'YYYY-MM-DD') AS reporting_date_str,
         u_own.name AS owner_user_name,
         u_cr.name  AS created_by_name,
         u_up.name  AS updated_by_name
  FROM account_weekly_health h
  LEFT JOIN users u_own ON h.owner_id = u_own.id
  LEFT JOIN users u_cr  ON h.created_by = u_cr.id
  LEFT JOIN users u_up  ON h.updated_by = u_up.id
`;

@Injectable()
export class AccountWeeklyHealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Asserts that the account exists and the calling user has visibility access to it.
   */
  private async assertAccountAccess(accountId: string, userId: string) {
    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }
    const account = await this.accountsService.findOne(accountId, userId);
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found or access denied`);
    }
    return account;
  }

  /**
   * Retrieves all weekly health updates for an account, sorted latest first.
   */
  async findAll(accountId: string, userId: string): Promise<AccountWeeklyHealth[]> {
    await this.assertAccountAccess(accountId, userId);

    const { rows } = await this.db.query(
      `${SELECT_QUERY}
       WHERE h.account_id = $1
       ORDER BY h.reporting_date DESC, h.created_at DESC`,
      [accountId],
    );

    return rows.map(rowToWeeklyHealth);
  }

  /**
   * Retrieves a single weekly health update by ID for a given account.
   */
  async findOne(accountId: string, id: string, userId: string): Promise<AccountWeeklyHealth> {
    await this.assertAccountAccess(accountId, userId);

    const { rows } = await this.db.query(
      `${SELECT_QUERY}
       WHERE h.id = $1 AND h.account_id = $2`,
      [id, accountId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Weekly health update ${id} not found for account ${accountId}`);
    }

    return rowToWeeklyHealth(rows[0]);
  }

  /**
   * Creates a new weekly health update for an account.
   * Enforces duplicate date prevention: an account cannot have multiple updates for the same reporting date.
   */
  async create(
    accountId: string,
    dto: CreateAccountWeeklyHealthDto,
    userId: string,
  ): Promise<AccountWeeklyHealth> {
    const account = await this.assertAccountAccess(accountId, userId);

    // Validate duplicate date check
    const existing = await this.db.query(
      `SELECT id FROM account_weekly_health WHERE account_id = $1 AND reporting_date = $2`,
      [accountId, dto.reportingDate],
    );

    if (existing.rows.length > 0) {
      throw new ConflictException(
        `A weekly health update already exists for account "${account.name}" on reporting date ${dto.reportingDate}. Please edit the existing update instead.`,
      );
    }

    // Determine owner display name
    let ownerName = (dto.owner || '').trim();
    if (!ownerName && dto.ownerId) {
      const userRes = await this.db.query(`SELECT name FROM users WHERE id = $1`, [dto.ownerId]);
      if (userRes.rows.length > 0) {
        ownerName = userRes.rows[0].name;
      }
    }
    if (!ownerName) {
      // Fallback to creator name
      const creatorRes = await this.db.query(`SELECT name FROM users WHERE id = $1`, [userId]);
      if (creatorRes.rows.length > 0) {
        ownerName = creatorRes.rows[0].name;
      }
    }

    const { rows } = await this.db.query(
      `INSERT INTO account_weekly_health (
        account_id,
        reporting_date,
        health_status,
        summary,
        key_updates,
        risks_and_issues,
        action_items_mitigation,
        owner,
        owner_id,
        next_steps,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING id`,
      [
        accountId,
        dto.reportingDate,
        dto.healthStatus,
        dto.summary.trim(),
        dto.keyUpdates?.trim() ?? '',
        dto.risksAndIssues?.trim() ?? '',
        dto.actionItemsMitigation?.trim() ?? '',
        ownerName,
        dto.ownerId || null,
        dto.nextSteps?.trim() ?? '',
        userId,
      ],
    );

    return this.findOne(accountId, rows[0].id, userId);
  }

  /**
   * Updates an existing weekly health update.
   */
  async update(
    accountId: string,
    id: string,
    dto: UpdateAccountWeeklyHealthDto,
    userId: string,
  ): Promise<AccountWeeklyHealth> {
    const account = await this.assertAccountAccess(accountId, userId);

    const existingRes = await this.db.query(
      `SELECT id, reporting_date FROM account_weekly_health WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );

    if (existingRes.rows.length === 0) {
      throw new NotFoundException(`Weekly health update ${id} not found for account ${accountId}`);
    }

    // If changing reportingDate, check for collisions
    if (dto.reportingDate) {
      const collisionRes = await this.db.query(
        `SELECT id FROM account_weekly_health WHERE account_id = $1 AND reporting_date = $2 AND id != $3`,
        [accountId, dto.reportingDate, id],
      );
      if (collisionRes.rows.length > 0) {
        throw new ConflictException(
          `Another weekly health update already exists for account "${account.name}" on reporting date ${dto.reportingDate}.`,
        );
      }
    }

    // Build dynamic update statement
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.reportingDate !== undefined) {
      fields.push(`reporting_date = $${idx++}`);
      values.push(dto.reportingDate);
    }
    if (dto.healthStatus !== undefined) {
      fields.push(`health_status = $${idx++}`);
      values.push(dto.healthStatus);
    }
    if (dto.summary !== undefined) {
      fields.push(`summary = $${idx++}`);
      values.push(dto.summary.trim());
    }
    if (dto.keyUpdates !== undefined) {
      fields.push(`key_updates = $${idx++}`);
      values.push(dto.keyUpdates.trim());
    }
    if (dto.risksAndIssues !== undefined) {
      fields.push(`risks_and_issues = $${idx++}`);
      values.push(dto.risksAndIssues.trim());
    }
    if (dto.actionItemsMitigation !== undefined) {
      fields.push(`action_items_mitigation = $${idx++}`);
      values.push(dto.actionItemsMitigation.trim());
    }
    if (dto.owner !== undefined) {
      fields.push(`owner = $${idx++}`);
      values.push(dto.owner.trim());
    }
    if (dto.ownerId !== undefined) {
      fields.push(`owner_id = $${idx++}`);
      values.push(dto.ownerId || null);
    }
    if (dto.nextSteps !== undefined) {
      fields.push(`next_steps = $${idx++}`);
      values.push(dto.nextSteps.trim());
    }

    fields.push(`updated_by = $${idx++}`);
    values.push(userId);
    fields.push(`updated_at = NOW()`);

    values.push(id);
    values.push(accountId);

    await this.db.query(
      `UPDATE account_weekly_health
       SET ${fields.join(', ')}
       WHERE id = $${idx++} AND account_id = $${idx++}`,
      values,
    );

    return this.findOne(accountId, id, userId);
  }

  /**
   * Deletes a weekly health update.
   */
  async delete(accountId: string, id: string, userId: string): Promise<{ success: boolean; id: string }> {
    await this.assertAccountAccess(accountId, userId);

    const { rowCount } = await this.db.query(
      `DELETE FROM account_weekly_health WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );

    if (rowCount === 0) {
      throw new NotFoundException(`Weekly health update ${id} not found for account ${accountId}`);
    }

    return { success: true, id };
  }
}
