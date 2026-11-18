import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService, TransactionContext } from '../../database/database.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { ActionItemsService } from '../action-items/action-items.service';
import { ServiceProviderService } from '../service-provider/service-provider.service';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';
import { CreateStakeholderConnectDto } from './dto/create-stakeholder-connect.dto';
import { UpdateStakeholderConnectDto } from './dto/update-stakeholder-connect.dto';
import { RescheduleConnectDto } from './dto/reschedule-connect.dto';
import { CancelConnectDto } from './dto/cancel-connect.dto';
import { CreateDraftFollowUpDto, UpdateDraftFollowUpDto } from './dto/draft-follow-up.dto';
import { ConvertDraftToActionItemDto } from './dto/convert-draft.dto';
import {
  isFutureDateTime,
  isSameDateTime,
  normalizeDateToIso,
  normalizeTimeToStandard,
} from './date-time.util';

export interface StakeholderConnectFilter {
  userId: string;
  accountId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  includeDeleted?: boolean;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type ConnectLifecycleAction =
  | 'view'
  | 'edit_details'
  | 'edit_mom'
  | 'complete'
  | 'reschedule'
  | 'cancel'
  | 'delete'
  | 'manage_attendees'
  | 'manage_drafts'
  | 'convert_draft'
  | 'manage_action_items';

const DRAFT_COLUMNS_SQL = `
  d.id,
  d.connect_id AS "connectId",
  d.title,
  d.description,
  d.suggested_owner_id AS "suggestedOwnerId",
  s.name AS "suggestedOwnerName",
  TO_CHAR(d.suggested_due_date, 'YYYY-MM-DD') AS "suggestedDueDate",
  d.suggested_priority AS "suggestedPriority",
  d.converted_at AS "convertedAt",
  d.converted_action_item_id AS "convertedActionItemId",
  ai.action_item_number AS "actionItemNumber",
  d.created_at AS "createdAt",
  d.updated_at AS "updatedAt"
`;

const DRAFT_JSON_OBJECT_SQL = `
  json_build_object(
    'id', d.id,
    'connectId', d.connect_id,
    'title', d.title,
    'description', d.description,
    'suggestedOwnerId', d.suggested_owner_id,
    'suggestedOwnerName', s.name,
    'suggestedDueDate', TO_CHAR(d.suggested_due_date, 'YYYY-MM-DD'),
    'suggestedPriority', d.suggested_priority,
    'convertedAt', d.converted_at,
    'convertedActionItemId', d.converted_action_item_id,
    'actionItemNumber', ai.action_item_number,
    'createdAt', d.created_at,
    'updatedAt', d.updated_at
  )
`;


@Injectable()
export class StakeholderConnectsService {
  private readonly logger = new Logger(StakeholderConnectsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessScopeService,
    private readonly permissions: PermissionsService,
    private readonly actionItemsService: ActionItemsService,
    private readonly serviceProviderService: ServiceProviderService,
  ) {}

  /**
   * Helper to write structured audit log into the central activities table.
   */
  private async logActivity(
    clientOrDb: PoolClient | DatabaseService,
    text: string,
    accountId: string,
    userId: string,
    userName?: string,
  ): Promise<void> {
    try {
      await clientOrDb.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'stakeholderConnect', $1, $2, $3, $4)`,
        [text, userId, userName || 'User', accountId],
      );
    } catch (err) {
      this.logger.error(`Failed to record activity [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }

  /**
   * Asserts that requesting user has access to the target account.
   */
  private async assertAccountAccess(accountId: string, userId: string, mode: 'read' | 'write' = 'read'): Promise<void> {
    const ctx = await this.access.getContext(userId);
    if (ctx.canViewAllAccounts) return;
    if (mode === 'read' && ctx.permissions.has('stakeholder-connects:view-all')) return;

    const scope = this.access.buildAccountVisibility('a', ctx, 2);
    const scopeClause = scope.conditions.length ? ` AND ${scope.conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE${scopeClause}`,
      [accountId, ...scope.params],
    );

    if (!rows.length) {
      throw new ForbiddenException(`You do not have permission to access the selected account.`);
    }
  }

  /**
   * Centralized meeting lifecycle policy enforcement:
   * - Soft-deleted meetings reject normal reads and all normal mutations with 404.
   * - Cancelled meetings are completely read-only (only view & soft-delete allowed).
   * - Completed meetings permit view, MoM editing, draft follow-ups, draft conversion,
   *   and soft-delete, while locking meeting details, attendees, and Action Item links.
   * - Scheduled and Rescheduled meetings allow all lifecycle actions.
   */
  private assertLifecycleAllowed(
    meeting: { status?: string; isDeleted?: boolean },
    action: ConnectLifecycleAction,
  ): void {
    if (meeting.isDeleted) {
      throw new NotFoundException('Stakeholder Connect not found.');
    }

    if (action === 'view' || action === 'delete') {
      return;
    }

    const status = meeting.status;
    if (status === 'Cancelled') {
      switch (action) {
        case 'complete':
          throw new BadRequestException('Cancelled meetings cannot be completed.');
        case 'reschedule':
          throw new BadRequestException('Cancelled meetings cannot be rescheduled.');
        case 'cancel':
          throw new BadRequestException('Meeting is already cancelled.');
        case 'edit_details':
        case 'edit_mom':
          throw new BadRequestException('Cancelled meetings cannot be modified.');
        default:
          throw new BadRequestException('Cancelled meetings are read-only and cannot be modified.');
      }
    }

    if (status === 'Completed') {
      switch (action) {
        case 'edit_mom':
        case 'manage_drafts':
        case 'convert_draft':
          return;
        case 'complete':
          throw new BadRequestException('Completed meetings cannot be completed again.');
        case 'reschedule':
          throw new BadRequestException('Completed meetings cannot be rescheduled.');
        case 'cancel':
          throw new BadRequestException('Completed meetings cannot be cancelled.');
        case 'edit_details':
          throw new BadRequestException(
            'Completed meeting details cannot be modified. Only Minutes of Meeting and draft follow-ups may be updated.',
          );
        case 'manage_attendees':
          throw new BadRequestException('Attendees cannot be added or removed once a meeting is Completed.');
        case 'manage_action_items':
          throw new BadRequestException('Action Items cannot be linked or unlinked once a meeting is Completed.');
      }
    }

    if (status === 'Scheduled' || status === 'Rescheduled') {
      return;
    }

    throw new BadRequestException(`Cannot perform operation on meeting with status "${status}".`);
  }

  /** Queries a single draft follow-up using the canonical camelCase projection. */
  private async findDraftOne(
    draftId: string,
    clientOrDb: PoolClient | DatabaseService = this.db,
  ): Promise<any> {
    const { rows } = await clientOrDb.query(
      `SELECT
         ${DRAFT_COLUMNS_SQL}
       FROM stakeholder_connect_draft_follow_ups d
       LEFT JOIN stakeholders s ON s.id = d.suggested_owner_id
       LEFT JOIN action_items ai ON ai.id = d.converted_action_item_id
       WHERE d.id = $1`,
      [draftId],
    );
    return rows[0] ?? null;
  }

  // ─── Query / Read Paths ───────────────────────────────────────────────────

  async findAll(
    params: StakeholderConnectFilter,
    pg: Pagination | null = null,
  ): Promise<any[] | Paginated<any>> {
    const ctx = await this.access.getContext(params.userId);
    const scope = this.access.buildChildVisibility('sc', ctx, 1, 'stakeholder-connects');

    const conditions: string[] = [
      params.includeDeleted ? '1=1' : 'sc.is_deleted = FALSE',
      ...scope.conditions,
    ];
    const qParams: any[] = [...scope.params];
    let nextIdx = scope.nextIdx;

    if (params.accountId) {
      conditions.push(`sc.account_id = $${nextIdx++}`);
      qParams.push(params.accountId);
    }

    if (params.status) {
      conditions.push(`sc.status = $${nextIdx++}`);
      qParams.push(params.status);
    }

    if (params.startDate) {
      conditions.push(`sc.meeting_date >= $${nextIdx++}`);
      qParams.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push(`sc.meeting_date <= $${nextIdx++}`);
      qParams.push(params.endDate);
    }

    if (params.search && params.search.trim()) {
      conditions.push(`(sc.title ILIKE $${nextIdx} OR sc.mom_notes ILIKE $${nextIdx} OR a.name ILIKE $${nextIdx})`);
      qParams.push(`%${params.search.trim()}%`);
      nextIdx++;
    }

    const where = conditions.join(' AND ');
    const totalCol = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${nextIdx} OFFSET $${nextIdx + 1}` : '';
    const finalParams = pg ? [...qParams, pg.limit, pg.offset] : qParams;

    const query = `
      SELECT
        sc.id,
        sc.account_id AS "accountId",
        a.name AS "accountName",
        sc.owner_id AS "ownerId",
        u.name AS "ownerName",
        u.email AS "ownerEmail",
        sc.title,
        TO_CHAR(sc.meeting_date, 'YYYY-MM-DD') AS "meetingDate",
        sc.meeting_time AS "meetingTime",
        sc.status,
        sc.mom_notes AS "momNotes",
        sc.mom_notes AS "mom",
        sc.cancellation_reason AS "cancellationReason",
        sc.is_deleted AS "isDeleted",
        sc.created_by AS "createdBy",
        sc.created_at AS "createdAt",
        sc.updated_at AS "updatedAt",
        COALESCE(
          (
            SELECT string_agg(DISTINCT s.name, ', ' ORDER BY s.name ASC)
            FROM stakeholder_connect_attendees sca
            JOIN stakeholders s ON s.id = sca.stakeholder_id
            WHERE sca.connect_id = sc.id
              AND s.stakeholder_type = 'CLIENT'
          ),
          ''
        ) AS "clientStakeholderNames",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', s.id,
                'name', s.name,
                'email', s.email,
                'designation', s.designation,
                'stakeholderType', s.stakeholder_type
              ) ORDER BY s.name ASC
            )
            FROM stakeholder_connect_attendees sca
            JOIN stakeholders s ON s.id = sca.stakeholder_id
            WHERE sca.connect_id = sc.id
          ),
          '[]'::json
        ) AS attendees,
        COALESCE(
          (
            SELECT json_agg(
              ${DRAFT_JSON_OBJECT_SQL} ORDER BY d.created_at ASC
            )
            FROM stakeholder_connect_draft_follow_ups d
            LEFT JOIN stakeholders s ON s.id = d.suggested_owner_id
            LEFT JOIN action_items ai ON ai.id = d.converted_action_item_id
            WHERE d.connect_id = sc.id
          ),
          '[]'::json
        ) AS "draftFollowUps",
        (
          SELECT COUNT(*)::INTEGER
          FROM stakeholder_connect_draft_follow_ups d
          WHERE d.connect_id = sc.id
        ) AS "draftsCount",
        (
          SELECT COUNT(*)::INTEGER
          FROM stakeholder_connect_action_items scai
          WHERE scai.connect_id = sc.id
        ) AS "actionItemsCount"${totalCol}
      FROM stakeholder_connects sc
      JOIN accounts a ON a.id = sc.account_id AND a.is_deleted = FALSE
      JOIN users u ON u.id = sc.owner_id
      WHERE ${where}
      ORDER BY sc.meeting_date DESC, sc.meeting_time DESC NULLS LAST, sc.created_at DESC
      ${limitClause}
    `;

    const { rows } = await this.db.query(query, finalParams);
    if (!pg) return rows;

    const total = extractTotal(rows);
    return { data: rows, total, page: pg.page, pageSize: pg.pageSize };
  }

  async findAllDeactivated(
    params: { userId: string; accountId?: string },
    pg: Pagination | null = null,
  ): Promise<any[] | Paginated<any>> {
    const ctx = await this.access.getContext(params.userId);
    const scope = this.access.buildChildVisibility('sc', ctx, 1, 'stakeholder-connects');

    const conditions: string[] = ['sc.is_deleted = TRUE', ...scope.conditions];
    const qParams: any[] = [...scope.params];
    let nextIdx = scope.nextIdx;

    if (params.accountId) {
      conditions.push(`sc.account_id = $${nextIdx++}`);
      qParams.push(params.accountId);
    }

    const where = conditions.join(' AND ');
    const totalCol = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${nextIdx} OFFSET $${nextIdx + 1}` : '';
    const finalParams = pg ? [...qParams, pg.limit, pg.offset] : qParams;

    const query = `
      SELECT
        sc.id,
        sc.account_id AS "accountId",
        a.name AS "accountName",
        a.is_deleted AS "accountDeleted",
        sc.owner_id AS "ownerId",
        u.name AS "ownerName",
        u.email AS "ownerEmail",
        sc.title,
        TO_CHAR(sc.meeting_date, 'YYYY-MM-DD') AS "meetingDate",
        sc.meeting_time AS "meetingTime",
        sc.status,
        sc.mom_notes AS "momNotes",
        sc.mom_notes AS "mom",
        sc.cancellation_reason AS "cancellationReason",
        sc.is_deleted AS "isDeleted",
        sc.created_by AS "createdBy",
        sc.created_at AS "createdAt",
        sc.updated_at AS "updatedAt",
        COALESCE(
          (
            SELECT string_agg(DISTINCT s.name, ', ' ORDER BY s.name ASC)
            FROM stakeholder_connect_attendees sca
            JOIN stakeholders s ON s.id = sca.stakeholder_id
            WHERE sca.connect_id = sc.id
              AND s.stakeholder_type = 'CLIENT'
          ),
          ''
        ) AS "clientStakeholderNames",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', s.id,
                'name', s.name,
                'email', s.email,
                'designation', s.designation,
                'stakeholderType', s.stakeholder_type
              ) ORDER BY s.name ASC
            )
            FROM stakeholder_connect_attendees sca
            JOIN stakeholders s ON s.id = sca.stakeholder_id
            WHERE sca.connect_id = sc.id
          ),
          '[]'::json
        ) AS attendees,
        COALESCE(
          (
            SELECT json_agg(
              ${DRAFT_JSON_OBJECT_SQL} ORDER BY d.created_at ASC
            )
            FROM stakeholder_connect_draft_follow_ups d
            LEFT JOIN stakeholders s ON s.id = d.suggested_owner_id
            LEFT JOIN action_items ai ON ai.id = d.converted_action_item_id
            WHERE d.connect_id = sc.id
          ),
          '[]'::json
        ) AS "draftFollowUps"${totalCol}
      FROM stakeholder_connects sc
      JOIN accounts a ON a.id = sc.account_id
      JOIN users u ON u.id = sc.owner_id
      WHERE ${where}
      ORDER BY sc.updated_at DESC, sc.meeting_date DESC
      ${limitClause}
    `;

    const { rows } = await this.db.query(query, finalParams);
    if (!pg) return rows;

    const total = extractTotal(rows);
    return { data: rows, total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const { rows } = await this.db.query(
      `SELECT
         sc.id,
         sc.account_id AS "accountId",
         a.name AS "accountName",
         sc.owner_id AS "ownerId",
         u.name AS "ownerName",
         u.email AS "ownerEmail",
         sc.title,
         TO_CHAR(sc.meeting_date, 'YYYY-MM-DD') AS "meetingDate",
         sc.meeting_time AS "meetingTime",
         sc.status,
         sc.mom_notes AS "momNotes",
         sc.mom_notes AS "mom",
         sc.cancellation_reason AS "cancellationReason",
         sc.is_deleted AS "isDeleted",
         sc.created_by AS "createdBy",
         sc.created_at AS "createdAt",
         sc.updated_at AS "updatedAt"
       FROM stakeholder_connects sc
       JOIN accounts a ON a.id = sc.account_id
       JOIN users u ON u.id = sc.owner_id
       WHERE sc.id = $1`,
      [id],
    );

    if (!rows.length) {
      this.logger.warn(`Stakeholder Connect not found [id=${id}]`);
      throw new NotFoundException('Stakeholder Connect not found.');
    }

    const meeting = rows[0];
    if (userId) {
      await this.assertAccountAccess(meeting.accountId, userId, 'read');
    }
    this.assertLifecycleAllowed(meeting, 'view');

    // Attendees list
    const { rows: attendees } = await this.db.query(
      `SELECT
         s.id,
         s.name,
         s.email,
         s.designation,
         s.stakeholder_type AS "stakeholderType",
         sca.created_at AS "joinedAt"
       FROM stakeholder_connect_attendees sca
       JOIN stakeholders s ON s.id = sca.stakeholder_id
       WHERE sca.connect_id = $1
       ORDER BY s.name ASC`,
      [id],
    );

    // Draft follow-ups list
    const { rows: drafts } = await this.db.query(
      `SELECT
         ${DRAFT_COLUMNS_SQL}
       FROM stakeholder_connect_draft_follow_ups d
       LEFT JOIN stakeholders s ON s.id = d.suggested_owner_id
       LEFT JOIN action_items ai ON ai.id = d.converted_action_item_id
       WHERE d.connect_id = $1
       ORDER BY d.created_at ASC`,
      [id],
    );

    // Linked action items list
    const { rows: actionItems } = await this.db.query(
      `SELECT
         ai.id,
         ai.id AS "actionItemId",
         ai.action_item_number AS "actionItemNumber",
         ai.title,
         ai.status,
         ai.priority,
         ai.due_date AS "dueDate",
         ai.open_date AS "openDate",
         COALESCE(NULLIF(s.name, ''), ai.owner) AS "ownerName",
         COALESCE(NULLIF(s.name, ''), ai.owner) AS "ownerStakeholderName",
         ai.owner_stakeholder_id AS "ownerStakeholderId"
       FROM stakeholder_connect_action_items scai
       JOIN action_items ai ON ai.id = scai.action_item_id
       LEFT JOIN stakeholders s ON s.id = ai.owner_stakeholder_id
       WHERE scai.connect_id = $1 AND ai.is_deleted = FALSE
       ORDER BY ai.created_at DESC`,
      [id],
    );

    // Reschedule history
    const { rows: history } = await this.db.query(
      `SELECT
         rh.id,
         rh.connect_id AS "connectId",
         TO_CHAR(rh.old_date, 'YYYY-MM-DD') AS "oldDate",
         TO_CHAR(rh.old_date, 'YYYY-MM-DD') AS "previousDate",
         rh.old_time AS "oldTime",
         rh.old_time AS "previousTime",
         TO_CHAR(rh.new_date, 'YYYY-MM-DD') AS "newDate",
         rh.new_time AS "newTime",
         rh.reason,
         rh.rescheduled_by AS "rescheduledBy",
         rh.rescheduled_by AS "rescheduledById",
         u.name AS "rescheduledByName",
         rh.created_at AS "createdAt"
       FROM stakeholder_connect_reschedule_history rh
       LEFT JOIN users u ON u.id = rh.rescheduled_by
       WHERE rh.connect_id = $1
       ORDER BY rh.created_at DESC`,
      [id],
    );

    const clientStakeholderNames = attendees
      .filter((a: any) => a.stakeholderType === 'CLIENT')
      .map((a: any) => a.name)
      .filter(Boolean)
      .join(', ');

    return {
      ...meeting,
      clientStakeholderNames,
      mom: meeting.momNotes,
      momNotes: meeting.momNotes,
      attendees,
      drafts,
      draftFollowUps: drafts,
      actionItems,
      linkedActionItems: actionItems,
      rescheduleHistory: history,
    };
  }

  // ─── Mutation Paths ───────────────────────────────────────────────────────

  async create(data: CreateStakeholderConnectDto, userId: string, userName?: string): Promise<any> {
    await this.assertAccountAccess(data.accountId, userId, 'write');

    const status = data.status || 'Scheduled';
    const meetingDate = normalizeDateToIso(data.meetingDate);
    const meetingTime = normalizeTimeToStandard(data.meetingTime);

    if (status === 'Rescheduled') {
      throw new BadRequestException('A new meeting cannot be created with status Rescheduled.');
    }

    if (status === 'Completed' && isFutureDateTime(meetingDate, meetingTime)) {
      throw new BadRequestException(
        'A future meeting cannot be marked as completed. Update the meeting date/time after it has taken place.',
      );
    }

    // Verify primary host exists
    const { rows: hostRows } = await this.db.query(`SELECT id, name FROM users WHERE id = $1`, [data.ownerId]);
    if (!hostRows.length) {
      throw new BadRequestException('The selected primary host user does not exist.');
    }

    // Resolve any service provider directory attendees into account-scoped stakeholder IDs
    const resolvedSpStakeholderIds: string[] = [];
    if (data.serviceProviderUserIds && data.serviceProviderUserIds.length > 0) {
      for (const spId of data.serviceProviderUserIds) {
        const stkId = await this.serviceProviderService.resolveOrCreate(spId, data.accountId);
        if (stkId) resolvedSpStakeholderIds.push(stkId);
      }
    }

    const allAttendeeIds = Array.from(new Set([...(data.attendees || []), ...resolvedSpStakeholderIds]));
    if (allAttendeeIds.length === 0) {
      throw new BadRequestException('At least one valid stakeholder attendee is required.');
    }

    // Validate each attendee belongs strictly to the meeting account and is active, and ensure at least one CLIENT attendee is present
    let hasClientAttendee = false;
    for (const stkId of allAttendeeIds) {
      const { rows: stkRows } = await this.db.query(
        `SELECT id, name, account_id, stakeholder_type, is_deleted FROM stakeholders WHERE id = $1`,
        [stkId],
      );
      if (!stkRows.length || stkRows[0].is_deleted) {
        throw new BadRequestException(`Stakeholder "${stkId}" does not exist or is inactive.`);
      }
      const stk = stkRows[0];
      if (stk.stakeholder_type === 'CLIENT') {
        if (stk.account_id !== data.accountId) {
          throw new BadRequestException(`Client stakeholder "${stk.name}" does not belong to the selected account.`);
        }
        hasClientAttendee = true;
      } else if (stk.stakeholder_type === 'SERVICE_PROVIDER') {
        if (stk.account_id && stk.account_id !== data.accountId) {
          throw new BadRequestException(`Service provider "${stk.name}" is attached to a different account.`);
        }
      }
    }

    if (!hasClientAttendee) {
      throw new BadRequestException('At least one client attendee from the selected account is required.');
    }

    const momNotes = data.momNotes !== undefined ? data.momNotes : (data.mom ?? null);

    const created = await this.db.withTransaction(async (client) => {
      const { rows: meetingRows } = await client.query(
        `INSERT INTO stakeholder_connects
           (id, account_id, owner_id, title, meeting_date, meeting_time, status, mom_notes, created_by, updated_by)
         VALUES
           (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING id`,
        [
          data.accountId,
          data.ownerId,
          data.title.trim(),
          meetingDate,
          meetingTime,
          status,
          momNotes,
          userId,
        ],
      );
      const connectId = meetingRows[0].id;

      for (const stkId of allAttendeeIds) {
        await client.query(
          `INSERT INTO stakeholder_connect_attendees (connect_id, stakeholder_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [connectId, stkId],
        );
      }

      await this.logActivity(
        client,
        `Scheduled meeting "${data.title.trim()}" for ${meetingDate} [meetingId=${connectId}]`,
        data.accountId,
        userId,
        userName,
      );

      return connectId;
    });

    return this.findOne(created, userId);
  }

  async complete(id: string, userId: string, userName?: string): Promise<any> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, account_id AS "accountId", title,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS "meetingDate",
                meeting_time AS "meetingTime", status, is_deleted AS "isDeleted"
         FROM stakeholder_connects
         WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!rows.length) {
        throw new NotFoundException(`Stakeholder Connect "${id}" not found.`);
      }
      const meeting = rows[0];
      await this.assertAccountAccess(meeting.accountId, userId, 'write');
      this.assertLifecycleAllowed(meeting, 'complete');

      if (isFutureDateTime(meeting.meetingDate, meeting.meetingTime)) {
        throw new BadRequestException(
          'A future meeting cannot be marked as completed. Update the meeting date/time after it has taken place.',
        );
      }

      await client.query(
        `UPDATE stakeholder_connects
         SET status = 'Completed', updated_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [userId, id],
      );

      await this.logActivity(
        client,
        `Marked meeting "${meeting.title}" as Completed [meetingId=${id}]`,
        meeting.accountId,
        userId,
        userName,
      );

      return id;
    }).then(() => this.findOne(id, userId));
  }

  async update(id: string, data: UpdateStakeholderConnectDto, userId: string, userName?: string): Promise<any> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, account_id AS "accountId", owner_id AS "ownerId", title,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS "meetingDate",
                meeting_time AS "meetingTime", status, mom_notes AS "momNotes",
                cancellation_reason AS "cancellationReason", is_deleted AS "isDeleted"
         FROM stakeholder_connects
         WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!rows.length) {
        throw new NotFoundException(`Stakeholder Connect "${id}" not found.`);
      }
      const existing = rows[0];
      await this.assertAccountAccess(existing.accountId, userId, 'write');
      this.assertLifecycleAllowed(existing, 'edit_mom');

      const existingDate = normalizeDateToIso(existing.meetingDate);
      const existingTime = normalizeTimeToStandard(existing.meetingTime);
      const targetDate = data.meetingDate ? normalizeDateToIso(data.meetingDate) : existingDate;
      const targetTime = data.meetingTime ? normalizeTimeToStandard(data.meetingTime) : existingTime;
      const isDateTimeChanged = !isSameDateTime(existingDate, existingTime, targetDate, targetTime);

      const hasTitleChange = data.title !== undefined && data.title.trim() !== existing.title;
      const hasOwnerChange = data.ownerId !== undefined && data.ownerId !== existing.ownerId;
      const hasStatusChange = data.status !== undefined && data.status !== existing.status;
      const hasCancellationReasonChange =
        data.cancellationReason !== undefined && data.cancellationReason !== existing.cancellationReason;
      const hasRescheduleReason = data.rescheduleReason !== undefined;
      const hasAttendeesPayload = data.attendees !== undefined;

      // Completed meetings lock all core meeting fields, schedule, status, and attendees; only MoM may be edited.
      if (existing.status === 'Completed') {
        if (isDateTimeChanged) {
          this.assertLifecycleAllowed(existing, 'reschedule');
        }
        if (hasStatusChange) {
          throw new BadRequestException('Completed meetings cannot change status.');
        }
        if (
          hasTitleChange ||
          hasOwnerChange ||
          hasCancellationReasonChange ||
          hasRescheduleReason ||
          hasAttendeesPayload
        ) {
          this.assertLifecycleAllowed(existing, 'edit_details');
        }
      }

      // Rule: Direct manual selection of Rescheduled without changing date/time is forbidden
      if (data.status === 'Rescheduled' && !isDateTimeChanged && existing.status !== 'Rescheduled') {
        throw new BadRequestException('Cannot manually set status to Rescheduled without changing the meeting date or time.');
      }

      let nextStatus = existing.status;

      if (isDateTimeChanged) {
        // Treat as reschedule operation
        if (!isFutureDateTime(targetDate, targetTime)) {
          throw new BadRequestException('Cannot reschedule meeting to a past date and time.');
        }

        // Record exactly one reschedule history entry
        await client.query(
          `INSERT INTO stakeholder_connect_reschedule_history
             (id, connect_id, old_date, old_time, new_date, new_time, reason, rescheduled_by)
           VALUES
             (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            existingDate,
            existingTime,
            targetDate,
            targetTime,
            data.rescheduleReason?.trim() || data.cancellationReason?.trim() || null,
            userId,
          ],
        );

        nextStatus = 'Rescheduled';
      } else if (data.status !== undefined) {
        if (data.status === 'Completed') {
          if (isFutureDateTime(targetDate, targetTime)) {
            throw new BadRequestException(
              'A future meeting cannot be marked as completed. Update the meeting date/time after it has taken place.',
            );
          }
        }
        nextStatus = data.status;
      }

      const title = data.title !== undefined ? data.title.trim() : existing.title;
      let ownerId = existing.ownerId;
      if (data.ownerId !== undefined) {
        const { rows: hostRows } = await client.query(`SELECT id, name FROM users WHERE id = $1`, [data.ownerId]);
        if (!hostRows.length) {
          throw new BadRequestException('The selected primary host user does not exist.');
        }
        ownerId = data.ownerId;
      }
      const rawMom = data.momNotes !== undefined ? data.momNotes : data.mom;
      const momNotes = rawMom !== undefined ? rawMom : existing.momNotes;
      const cancellationReason = data.cancellationReason !== undefined ? data.cancellationReason : existing.cancellationReason;

      await client.query(
        `UPDATE stakeholder_connects
         SET title = $1, owner_id = $2, meeting_date = $3, meeting_time = $4,
             status = $5, mom_notes = $6, cancellation_reason = $7, updated_by = $8, updated_at = NOW()
         WHERE id = $9`,
        [title, ownerId, targetDate, targetTime, nextStatus, momNotes, cancellationReason, userId, id],
      );

      // ── Attendee Updates (if attendees are explicitly provided) ───────────
      if (data.attendees !== undefined) {
        const rawAttendeeIds = Array.isArray(data.attendees) ? data.attendees : [];
        const normalizedAttendeeIds = Array.from(
          new Set(
            rawAttendeeIds
              .map((item: any) => (typeof item === 'string' ? item.trim() : (item?.id || item?.stakeholderId)?.trim()))
              .filter((stkId): stkId is string => typeof stkId === 'string' && stkId.length > 0),
          ),
        );

        if (normalizedAttendeeIds.length === 0) {
          throw new BadRequestException('At least one valid stakeholder attendee is required.');
        }

        // Validate each attendee belongs strictly to the meeting account and is active, and ensure at least one CLIENT attendee is present
        let hasClientAttendee = false;
        for (const stkId of normalizedAttendeeIds) {
          const { rows: stkRows } = await client.query(
            `SELECT id, name, account_id, stakeholder_type, is_deleted FROM stakeholders WHERE id = $1`,
            [stkId],
          );
          if (!stkRows.length || stkRows[0].is_deleted) {
            throw new BadRequestException(`Stakeholder "${stkId}" does not exist or is inactive.`);
          }
          const stk = stkRows[0];
          if (stk.stakeholder_type === 'CLIENT') {
            if (stk.account_id !== existing.accountId) {
              throw new BadRequestException(`Client stakeholder "${stk.name}" does not belong to the selected account.`);
            }
            hasClientAttendee = true;
          } else if (stk.stakeholder_type === 'SERVICE_PROVIDER') {
            if (stk.account_id && stk.account_id !== existing.accountId) {
              throw new BadRequestException(`Service provider "${stk.name}" is attached to a different account.`);
            }
          }
        }

        if (!hasClientAttendee) {
          throw new BadRequestException('At least one client attendee from the selected account is required.');
        }

        // Current attendees in database
        const { rows: currentAttRows } = await client.query(
          `SELECT stakeholder_id FROM stakeholder_connect_attendees WHERE connect_id = $1`,
          [id],
        );
        const currentIds = new Set(currentAttRows.map((r: any) => r.stakeholder_id));
        const targetIds = new Set(normalizedAttendeeIds);

        // Delete any attendees that were unselected
        for (const currentId of currentIds) {
          if (!targetIds.has(currentId)) {
            await client.query(
              `DELETE FROM stakeholder_connect_attendees WHERE connect_id = $1 AND stakeholder_id = $2`,
              [id, currentId],
            );
          }
        }

        // Insert newly selected attendees
        for (const targetId of targetIds) {
          if (!currentIds.has(targetId)) {
            await client.query(
              `INSERT INTO stakeholder_connect_attendees (connect_id, stakeholder_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [id, targetId],
            );
          }
        }
      }

      await this.logActivity(
        client,
        isDateTimeChanged
          ? `Rescheduled meeting "${title}" from ${existingDate} to ${targetDate} via Edit [meetingId=${id}]`
          : existing.status === 'Completed'
            ? `Updated Minutes of Meeting for "${title}" [meetingId=${id}]`
            : `Updated meeting "${title}" details [meetingId=${id}]`,
        existing.accountId,
        userId,
        userName,
      );

      return id;
    }).then(() => this.findOne(id, userId));
  }

  async reschedule(id: string, data: RescheduleConnectDto, userId: string, userName?: string): Promise<any> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, account_id AS "accountId", title,
                TO_CHAR(meeting_date, 'YYYY-MM-DD') AS "meetingDate",
                meeting_time AS "meetingTime", status, is_deleted AS "isDeleted"
         FROM stakeholder_connects
         WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!rows.length) {
        throw new NotFoundException(`Stakeholder Connect "${id}" not found.`);
      }
      const existing = rows[0];
      await this.assertAccountAccess(existing.accountId, userId, 'write');
      this.assertLifecycleAllowed(existing, 'reschedule');

      const newDate = normalizeDateToIso(data.newDate);
      const newTime = normalizeTimeToStandard(data.newTime);
      const oldDate = normalizeDateToIso(existing.meetingDate);
      const oldTime = normalizeTimeToStandard(existing.meetingTime);

      if (isSameDateTime(oldDate, oldTime, newDate, newTime)) {
        throw new BadRequestException('The rescheduled meeting date and time must be different from the current schedule.');
      }

      if (!isFutureDateTime(newDate, newTime)) {
        throw new BadRequestException('Cannot reschedule meeting to a past date and time.');
      }

      await client.query(
        `INSERT INTO stakeholder_connect_reschedule_history
           (id, connect_id, old_date, old_time, new_date, new_time, reason, rescheduled_by)
         VALUES
           (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          oldDate,
          oldTime,
          newDate,
          newTime,
          data.reason?.trim() || null,
          userId,
        ],
      );

      await client.query(
        `UPDATE stakeholder_connects
         SET meeting_date = $1, meeting_time = $2, status = 'Rescheduled', updated_by = $3, updated_at = NOW()
         WHERE id = $4`,
        [newDate, newTime, userId, id],
      );

      await this.logActivity(
        client,
        `Rescheduled meeting "${existing.title}" from ${oldDate} ${oldTime.slice(0, 5)} to ${newDate} ${newTime.slice(0, 5)} [meetingId=${id}]`,
        existing.accountId,
        userId,
        userName,
      );

      return id;
    }).then(() => this.findOne(id, userId));
  }

  async cancel(id: string, data: CancelConnectDto, userId: string, userName?: string): Promise<any> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, account_id AS "accountId", title, status, is_deleted AS "isDeleted"
         FROM stakeholder_connects
         WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!rows.length) {
        throw new NotFoundException(`Stakeholder Connect "${id}" not found.`);
      }
      const existing = rows[0];
      await this.assertAccountAccess(existing.accountId, userId, 'write');
      this.assertLifecycleAllowed(existing, 'cancel');

      await client.query(
        `UPDATE stakeholder_connects
         SET status = 'Cancelled', cancellation_reason = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [data.reason?.trim() || null, userId, id],
      );

      await this.logActivity(
        client,
        `Cancelled meeting "${existing.title}" [meetingId=${id}]`,
        existing.accountId,
        userId,
        userName,
      );

      return id;
    }).then(() => this.findOne(id, userId));
  }

  async remove(id: string, userId: string, userName?: string): Promise<{ success: boolean }> {
    const existing = await this.findOne(id, userId);
    await this.assertAccountAccess(existing.accountId, userId, 'write');
    this.assertLifecycleAllowed(existing, 'delete');

    await this.db.query(
      `UPDATE stakeholder_connects
       SET is_deleted = TRUE, updated_by = $1, updated_at = NOW()
       WHERE id = $2 AND is_deleted = FALSE`,
      [userId, id],
    );

    await this.logActivity(
      this.db,
      `Soft-deleted meeting "${existing.title}" [meetingId=${id}]`,
      existing.accountId,
      userId,
      userName,
    );

    return { success: true };
  }

  async restore(id: string, userId: string, userName?: string): Promise<any> {
    const { rows } = await this.db.query(
      `SELECT sc.id, sc.account_id AS "accountId", sc.title, a.is_deleted AS "accountDeleted"
       FROM stakeholder_connects sc
       JOIN accounts a ON a.id = sc.account_id
       WHERE sc.id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Meeting "${id}" not found.`);
    const meeting = rows[0];

    await this.assertAccountAccess(meeting.accountId, userId, 'write');

    if (meeting.accountDeleted) {
      throw new BadRequestException('Cannot restore meeting because its parent account is deleted.');
    }

    // Revalidate attendees: Ensure active stakeholders exist
    const { rows: attRows } = await this.db.query(
      `SELECT sca.stakeholder_id, s.is_deleted, s.account_id, s.stakeholder_type
       FROM stakeholder_connect_attendees sca
       JOIN stakeholders s ON s.id = sca.stakeholder_id
       WHERE sca.connect_id = $1`,
      [id],
    );
    for (const a of attRows) {
      if (a.is_deleted) {
        throw new BadRequestException('Cannot restore meeting because one or more attendee stakeholders are deactivated.');
      }
      if (a.stakeholder_type === 'CLIENT' && a.account_id !== meeting.accountId) {
        throw new BadRequestException('Cannot restore meeting because an attendee belongs to a different account.');
      }
    }

    await this.db.query(
      `UPDATE stakeholder_connects
       SET is_deleted = FALSE, updated_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [userId, id],
    );

    await this.logActivity(
      this.db,
      `Restored meeting "${meeting.title}" [meetingId=${id}]`,
      meeting.accountId,
      userId,
      userName,
    );

    return this.findOne(id, userId);
  }

  // ─── Attendee Management ──────────────────────────────────────────────────

  async addAttendee(connectId: string, stakeholderId: string, userId: string, userName?: string): Promise<any> {
    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_attendees');

    const { rows: stkRows } = await this.db.query(
      `SELECT id, name, account_id, stakeholder_type, is_deleted FROM stakeholders WHERE id = $1`,
      [stakeholderId],
    );
    if (!stkRows.length || stkRows[0].is_deleted) {
      throw new BadRequestException('Stakeholder does not exist or is inactive.');
    }
    const stk = stkRows[0];
    if (stk.stakeholder_type === 'CLIENT' && stk.account_id !== meeting.accountId) {
      throw new BadRequestException('Client stakeholder belongs to a different account.');
    }
    if (stk.stakeholder_type === 'SERVICE_PROVIDER' && stk.account_id && stk.account_id !== meeting.accountId) {
      throw new BadRequestException('Service provider is attached to a different account.');
    }

    await this.db.query(
      `INSERT INTO stakeholder_connect_attendees (connect_id, stakeholder_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [connectId, stakeholderId],
    );

    await this.logActivity(
      this.db,
      `Added attendee ${stk.name} to meeting "${meeting.title}" [meetingId=${connectId}, stakeholderId=${stakeholderId}]`,
      meeting.accountId,
      userId,
      userName,
    );

    return this.findOne(connectId, userId);
  }

  async removeAttendee(connectId: string, stakeholderId: string, userId: string, userName?: string): Promise<any> {
    if (!stakeholderId || !stakeholderId.trim() || stakeholderId === 'undefined') {
      throw new BadRequestException('Valid attendee stakeholder ID is required.');
    }

    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_attendees');

    const attendees = meeting.attendees || [];
    const targetAttendee = attendees.find((a: any) => a.id === stakeholderId);
    if (!targetAttendee) {
      throw new NotFoundException('Attendee is not associated with this meeting.');
    }

    const remainingAttendees = attendees.filter((a: any) => a.id !== stakeholderId);
    if (remainingAttendees.length === 0) {
      throw new BadRequestException('A meeting must retain at least one attendee.');
    }

    const hasClientRemaining = remainingAttendees.some(
      (a: any) => a.stakeholderType === 'CLIENT' || a.stakeholder_type === 'CLIENT',
    );
    if (!hasClientRemaining) {
      throw new BadRequestException('A meeting must retain at least one client attendee from the account.');
    }

    await this.db.query(
      `DELETE FROM stakeholder_connect_attendees WHERE connect_id = $1 AND stakeholder_id = $2`,
      [connectId, stakeholderId],
    );

    await this.logActivity(
      this.db,
      `Removed attendee ${targetAttendee.name || stakeholderId} from meeting "${meeting.title}" [meetingId=${connectId}, stakeholderId=${stakeholderId}]`,
      meeting.accountId,
      userId,
      userName,
    );

    return this.findOne(connectId, userId);
  }

  // ─── Draft Follow-Ups Management ──────────────────────────────────────────

  /** Verify an optional suggestedOwnerId belongs to an active stakeholder on `accountId`. */
  private async assertValidSuggestedOwner(suggestedOwnerId: string | null | undefined, accountId: string): Promise<void> {
    if (!suggestedOwnerId) return;
    const { rows } = await this.db.query(
      `SELECT id, account_id, stakeholder_type FROM stakeholders WHERE id = $1 AND is_deleted = FALSE`,
      [suggestedOwnerId],
    );
    const stk = rows[0];
    const invalidClient = stk?.stakeholder_type === 'CLIENT' && stk.account_id !== accountId;
    const invalidOther = stk?.stakeholder_type !== 'CLIENT' && Boolean(stk?.account_id && stk.account_id !== accountId);
    if (!stk || invalidClient || invalidOther) {
      throw new BadRequestException('Suggested owner must be an active stakeholder on this meeting account.');
    }
  }

  async createDraft(connectId: string, data: CreateDraftFollowUpDto, userId: string): Promise<any> {
    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_drafts');

    await this.assertValidSuggestedOwner(data.suggestedOwnerId, meeting.accountId);

    const { rows } = await this.db.query(
      `INSERT INTO stakeholder_connect_draft_follow_ups
         (id, connect_id, title, description, suggested_owner_id, suggested_due_date, suggested_priority, created_by)
       VALUES
         (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        connectId,
        data.title.trim(),
        data.description ?? null,
        data.suggestedOwnerId ?? null,
        data.suggestedDueDate ?? null,
        data.suggestedPriority ?? null,
        userId,
      ],
    );

    return this.findDraftOne(rows[0].id);
  }

  async updateDraft(connectId: string, draftId: string, data: UpdateDraftFollowUpDto, userId: string): Promise<any> {
    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_drafts');

    const { rows: drafts } = await this.db.query(
      `SELECT * FROM stakeholder_connect_draft_follow_ups WHERE id = $1 AND connect_id = $2`,
      [draftId, connectId],
    );
    if (!drafts.length) throw new NotFoundException('Draft follow-up not found.');
    const draft = drafts[0];

    if (draft.converted_at) {
      throw new BadRequestException('Cannot edit a draft follow-up that has already been converted.');
    }

    await this.assertValidSuggestedOwner(data.suggestedOwnerId, meeting.accountId);

    const title = data.title !== undefined ? data.title.trim() : draft.title;
    const description = data.description !== undefined ? data.description : draft.description;
    const suggestedOwnerId = data.suggestedOwnerId !== undefined ? data.suggestedOwnerId : draft.suggested_owner_id;
    const suggestedDueDate = data.suggestedDueDate !== undefined ? data.suggestedDueDate : draft.suggested_due_date;
    const suggestedPriority = data.suggestedPriority !== undefined ? data.suggestedPriority : draft.suggested_priority;

    await this.db.query(
      `UPDATE stakeholder_connect_draft_follow_ups
       SET title = $1,
           description = $2,
           suggested_owner_id = $3,
           suggested_due_date = $4,
           suggested_priority = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [title, description, suggestedOwnerId, suggestedDueDate, suggestedPriority, draftId],
    );

    return this.findDraftOne(draftId);
  }

  async deleteDraft(connectId: string, draftId: string, userId: string): Promise<{ success: boolean }> {
    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_drafts');

    const { rows: drafts } = await this.db.query(
      `SELECT id, converted_at FROM stakeholder_connect_draft_follow_ups WHERE id = $1 AND connect_id = $2`,
      [draftId, connectId],
    );
    if (!drafts.length) throw new NotFoundException('Draft follow-up not found.');
    if (drafts[0].converted_at) {
      throw new BadRequestException('Cannot delete a draft follow-up that has already been converted.');
    }

    await this.db.query(
      `DELETE FROM stakeholder_connect_draft_follow_ups WHERE id = $1 AND connect_id = $2`,
      [draftId, connectId],
    );

    return { success: true };
  }

  // ─── Transactional Draft Conversion to Action Item ────────────────────────

  async convertDraft(
    connectId: string,
    draftId: string,
    data: ConvertDraftToActionItemDto,
    userId: string,
    userName?: string,
  ): Promise<{ actionItem: any; draft: any }> {
    const canUpdateConnect = await this.permissions.can(userId, 'stakeholder-connects', 'update');
    if (!canUpdateConnect) {
      throw new ForbiddenException('You do not have permission to update stakeholder-connects.');
    }

    const canCreateActionItem = await this.permissions.can(userId, 'action-items', 'create');
    if (!canCreateActionItem) {
      throw new ForbiddenException('You do not have permission to create action-items.');
    }

    return this.db.withTransaction(async (client, tx?: TransactionContext) => {
      // 1. Verify meeting exists and user has write access BEFORE locking or inspecting lifecycle/draft state
      const { rows: meetings } = await client.query(
        `SELECT id, account_id, meeting_date, status, is_deleted FROM stakeholder_connects WHERE id = $1`,
        [connectId],
      );
      if (!meetings.length) {
        throw new NotFoundException('Meeting not found or has been deleted.');
      }
      const meeting = meetings[0];

      await this.assertAccountAccess(meeting.account_id, userId, 'write');
      this.assertLifecycleAllowed(
        { status: meeting.status, isDeleted: meeting.is_deleted },
        'convert_draft',
      );

      // 2. Lock draft row for update
      const { rows: drafts } = await client.query(
        `SELECT * FROM stakeholder_connect_draft_follow_ups
         WHERE id = $1 AND connect_id = $2 FOR UPDATE`,
        [draftId, connectId],
      );
      if (!drafts.length) {
        this.logger.warn(`Draft follow-up not found [draftId=${draftId}, connectId=${connectId}]`);
        throw new NotFoundException('Draft follow-up not found for this meeting.');
      }
      const draft = drafts[0];

      // 3. Prevent duplicate conversion
      if (draft.converted_at) {
        throw new ConflictException('Draft follow-up has already been converted to an Action Item.');
      }

      // 4. Validate ownerStakeholderId: strictly required and must belong to meeting account
      const { rows: stkRows } = await client.query(
        `SELECT id, name, account_id, stakeholder_type FROM stakeholders WHERE id = $1 AND is_deleted = FALSE`,
        [data.ownerStakeholderId],
      );
      if (!stkRows.length) {
        throw new BadRequestException('The selected task owner is not a valid active stakeholder.');
      }
      const ownerStk = stkRows[0];
      if (ownerStk.stakeholder_type === 'CLIENT' && ownerStk.account_id !== meeting.account_id) {
        throw new BadRequestException('The selected task owner belongs to a different account.');
      }
      if (ownerStk.stakeholder_type === 'SERVICE_PROVIDER' && ownerStk.account_id && ownerStk.account_id !== meeting.account_id) {
        throw new BadRequestException('The selected service provider belongs to a different account.');
      }

      // 5. Construct Action Item payload
      const actionItemPayload = {
        title: data.title?.trim() || draft.title,
        accountId: meeting.account_id,
        opportunityId: data.opportunityId || null,
        projectId: data.projectId || null,
        ownerStakeholderId: data.ownerStakeholderId,
        openDate: data.openDate || meeting.meeting_date || todayIsoDate(),
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status || 'To Do',
        actionItemType: data.actionItemType || 'Stakeholder connect',
        notes: data.notes !== undefined ? data.notes : (draft.description || ''),
        ownerId: userId,
      };

      // 6. Create Action Item atomically via shared transaction client; defer notification emission until post-commit
      const actionItem = await this.actionItemsService.create(
        actionItemPayload,
        userId,
        client,
        tx?.afterCommit,
      );

      // 7. Update draft: set converted_at and converted_action_item_id
      await client.query(
        `UPDATE stakeholder_connect_draft_follow_ups
         SET converted_at = NOW(), converted_action_item_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [actionItem.id, draftId],
      );

      // 8. Record link in meeting-to-action-items junction table
      await client.query(
        `INSERT INTO stakeholder_connect_action_items (connect_id, action_item_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [connectId, actionItem.id],
      );

      // 9. Audit log
      await this.logActivity(
        client,
        `Converted draft follow-up "${draft.title}" to Action Item ${actionItem.actionItemNumber || actionItem.id} [meetingId=${connectId}, actionItemId=${actionItem.id}]`,
        meeting.account_id,
        userId,
        userName,
      );

      const updatedDraft = await this.findDraftOne(draftId, client);

      return {
        actionItem,
        draft: updatedDraft,
      };
    });
  }

  // ─── Linking Existing Action Items ────────────────────────────────────────

  async linkActionItem(connectId: string, actionItemId: string, userId: string, userName?: string): Promise<any> {
    if (!actionItemId) {
      throw new BadRequestException('Action Item ID is required.');
    }
    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_action_items');

    const { rows: aiRows } = await this.db.query(
      `SELECT id, title, account_id, is_deleted, action_item_number FROM action_items WHERE id = $1`,
      [actionItemId],
    );
    if (!aiRows.length || aiRows[0].is_deleted) {
      throw new NotFoundException('Action Item does not exist or has been deleted.');
    }
    const ai = aiRows[0];
    if (ai.account_id !== meeting.accountId) {
      throw new BadRequestException('Cannot link an Action Item belonging to a different account.');
    }

    // Explicitly prevent duplicate linking
    const { rows: existingLinks } = await this.db.query(
      `SELECT 1 FROM stakeholder_connect_action_items WHERE connect_id = $1 AND action_item_id = $2`,
      [connectId, actionItemId],
    );
    if (existingLinks.length > 0) {
      throw new BadRequestException('This Action Item is already linked to this meeting.');
    }

    await this.db.query(
      `INSERT INTO stakeholder_connect_action_items (connect_id, action_item_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [connectId, actionItemId],
    );

    await this.logActivity(
      this.db,
      `Linked Action Item ${ai.action_item_number || ai.title} to meeting "${meeting.title}" [meetingId=${connectId}, actionItemId=${actionItemId}]`,
      meeting.accountId,
      userId,
      userName,
    );

    const updated = await this.findOne(connectId, userId);
    return {
      ...updated,
      success: true,
      actionItemId,
    };
  }

  async unlinkActionItem(connectId: string, actionItemId: string, userId: string, userName?: string): Promise<any> {
    if (!actionItemId) {
      throw new BadRequestException('Action Item ID is required.');
    }
    const meeting = await this.findOne(connectId, userId);
    await this.assertAccountAccess(meeting.accountId, userId, 'write');
    this.assertLifecycleAllowed(meeting, 'manage_action_items');

    await this.db.query(
      `DELETE FROM stakeholder_connect_action_items WHERE connect_id = $1 AND action_item_id = $2`,
      [connectId, actionItemId],
    );

    await this.logActivity(
      this.db,
      `Unlinked Action Item [id=${actionItemId}] from meeting "${meeting.title}" [meetingId=${connectId}]`,
      meeting.accountId,
      userId,
      userName,
    );

    const updated = await this.findOne(connectId, userId);
    return {
      ...updated,
      success: true,
      actionItemId,
    };
  }
}
