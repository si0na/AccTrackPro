import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams, FiscalContext } from '../../common/services/filter-context.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { Opportunity } from '../../types';
import { extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';

// 'financialYear'/'quarter' remain listed so payloads from older clients are
// stripped instead of leaking into custom_data — fiscal periods are derived
// from closeDate and never stored.
const KNOWN = new Set([
  'id','name','accountId','accountName','stage','value','probability','ownerId',
  'closeDate','startDate','endDate','crmValue','description','nextStep',
  'risksAndDependencies',
  'closeReason','closedAt',
  'tags','team','financialYear','quarter',
  'clientStakeholderId','clientStakeholderName','clientStakeholderDesignation',
  'serviceProviderStakeholderId','serviceProviderStakeholderName','serviceProviderStakeholderDesignation',
  'aopAvailable','aopYear','opportunityType','serviceLine',
]);

/** Deal outcome is now tracked solely via pipeline stage — no separate status field. */
const CLOSED_STAGES = new Set(['Won', 'Lost']);

function rowToOpportunity(row: any, derive: (date: string) => { financialYear: string; quarter: string }): Opportunity {
  const {
    custom_data, is_deleted, created_at, updated_at,
    account_id, account_name, close_date, start_date, end_date, crm_value, next_step,
    risks_and_dependencies,
    close_reason, closed_at,
    owner_id,
    client_stakeholder_id, client_stakeholder_name, client_stakeholder_designation,
    service_provider_stakeholder_id, service_provider_stakeholder_name, service_provider_stakeholder_designation,
    aop_available, aop_year, opportunity_type, service_line,
    ...base
  } = row;
  return {
    ...base,
    accountId:     account_id,
    accountName:   account_name ?? undefined,
    ownerId:       owner_id   ?? undefined,
    closeDate:     close_date,
    startDate:     start_date,
    endDate:       end_date,
    crmValue:      Number(crm_value),
    nextStep:      next_step,
    risksAndDependencies: risks_and_dependencies ?? '',
    closeReason:   close_reason ?? '',
    closedAt:      closed_at ?? undefined,
    value:         Number(base.value),
    probability:   Number(base.probability),
    tags:          base.tags  ?? [],
    team:          base.team  ?? [],
    clientStakeholderId:                   client_stakeholder_id ?? undefined,
    clientStakeholderName:                 client_stakeholder_name ?? undefined,
    clientStakeholderDesignation:          client_stakeholder_designation ?? undefined,
    serviceProviderStakeholderId:          service_provider_stakeholder_id ?? undefined,
    serviceProviderStakeholderName:        service_provider_stakeholder_name ?? undefined,
    serviceProviderStakeholderDesignation: service_provider_stakeholder_designation ?? undefined,
    aopAvailable:  aop_available,
    aopYear:       aop_year ?? null,
    opportunityType: opportunity_type,
    serviceLine:   service_line ?? undefined,
    // Read-only reporting labels derived from the business date (close date).
    ...derive(close_date),
    ...(custom_data || {}),
  } as Opportunity;
}

const OPP_SELECT = `
  SELECT o.*, a.name AS account_name,
         cs.name AS client_stakeholder_name, cs.designation AS client_stakeholder_designation,
         sps.name AS service_provider_stakeholder_name, sps.designation AS service_provider_stakeholder_designation
  FROM opportunities o
  LEFT JOIN accounts a ON o.account_id = a.id
  LEFT JOIN stakeholders cs  ON o.client_stakeholder_id           = cs.id
  LEFT JOIN stakeholders sps ON o.service_provider_stakeholder_id = sps.id
`;

/** Business rule: when both dates are present, end date cannot precede start date. */
function assertDateOrder(startDate?: string, endDate?: string): void {
  if (startDate && endDate && endDate < startDate) {
    throw new BadRequestException('End date cannot be earlier than the start date');
  }
}

const STAGE_ORDER = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];

/**
 * Stage-progression requirements: advancing through the pipeline requires the
 * business information a deal at that maturity should have. Applied whenever a
 * deal is created at, or moved to, the given stage.
 *  - Qualified and beyond: an expected close date
 *  - Proposal and beyond:  a deal value greater than zero
 *  - Negotiation and beyond: a next step or description of the deal
 */
function assertStageRequirements(data: any, stage: string): void {
  const idx = STAGE_ORDER.indexOf(stage);
  const missing: string[] = [];
  if (idx >= 1 && !String(data.closeDate ?? '').trim()) missing.push('an expected close date');
  if (idx >= 2 && !(Number(data.value) > 0)) missing.push('a deal value greater than zero');
  if (idx >= 3 && !String(data.nextStep ?? '').trim() && !String(data.description ?? '').trim()) {
    missing.push('a next step or description');
  }
  if (missing.length) {
    throw new BadRequestException(
      `Moving to the ${stage} stage requires ${missing.join(', ')}.`,
    );
  }
}

/** Today as a local ISO date string (matches the ISO dates stored on deals). */
function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Expected close dates: cannot precede the start date and — for a deal that is
 * still open — cannot already be in the past. The past-date rule only applies
 * when the close date is being set or changed, so existing historical records
 * remain editable.
 */
function assertCloseDateValid(
  closeDate: string | undefined,
  startDate: string | undefined,
  stage: string,
  previousCloseDate?: string,
): void {
  if (!closeDate) return;
  if (startDate && closeDate < startDate) {
    throw new BadRequestException('Expected close date cannot be earlier than the start date');
  }
  const changed = previousCloseDate === undefined || closeDate !== previousCloseDate;
  if (!CLOSED_STAGES.has(stage) && changed && closeDate < todayISO()) {
    throw new BadRequestException('Expected close date cannot be in the past for an open opportunity');
  }
}

/**
 * Win/loss capture: closing a deal (stage becomes Won or Lost) requires a
 * reason so pipeline reviews can learn from the outcome.
 */
function resolveCloseReason(data: any, stage: string, existing?: { stage: string; closeReason?: string }): string {
  const provided = String(data.closeReason ?? '').trim();
  if (!CLOSED_STAGES.has(stage)) return ''; // reopened deals shed their close reason
  const becameClosed = !existing || existing.stage !== stage;
  const carried = existing?.stage === stage ? (existing.closeReason ?? '') : '';
  const reason = provided || carried;
  if (becameClosed && !reason) {
    throw new BadRequestException(
      stage === 'Won'
        ? 'Please provide a win reason when marking this opportunity as Won'
        : 'Please provide a loss reason when marking this opportunity as Lost',
    );
  }
  return reason;
}

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly bus: NotificationEventBus,
  ) {}

  /** Row mapper that derives financialYear/quarter labels from close_date. */
  private async mapper(ctx?: FiscalContext): Promise<(row: any) => Opportunity> {
    const fiscal = ctx ?? await this.filter.getFiscalContext();
    return (row) => rowToOpportunity(row, (d) => this.filter.derivePeriod(d, fiscal));
  }

  /**
   * Operational list — never fiscal-period-filtered. An opportunity remains
   * visible until it is closed; module-specific filtering (stage, status,
   * account, close date, probability) happens in the UI. The response still
   * carries financialYear/quarter labels derived from the close date for
   * reporting views.
   */
  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Opportunity[] | Paginated<Opportunity>> {
    const f = this.filter.normalize(params);
    const owner = this.filter.buildOwnerConditions('o', f, 1);
    const where = ['o.is_deleted = FALSE', ...owner.conditions].join(' AND ');

    const totalCol   = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${owner.nextIdx} OFFSET $${owner.nextIdx + 1}` : '';
    const qParams     = pg ? [...owner.params, pg.limit, pg.offset] : owner.params;

    const { rows } = await this.db.query(
      `SELECT o.*, a.name AS account_name,
              cs.name AS client_stakeholder_name, cs.designation AS client_stakeholder_designation,
              sps.name AS service_provider_stakeholder_name, sps.designation AS service_provider_stakeholder_designation${totalCol}
       FROM opportunities o
       INNER JOIN accounts a ON o.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN stakeholders cs  ON o.client_stakeholder_id           = cs.id
       LEFT  JOIN stakeholders sps ON o.service_provider_stakeholder_id = sps.id
       WHERE ${where}
       ORDER BY o.created_at DESC${limitClause}`,
      qParams,
    );
    if (!pg) return rows.map(await this.mapper());

    const total = extractTotal(rows);
    return { data: rows.map(await this.mapper()), total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(id: string, userId?: string): Promise<Opportunity> {
    const { rows } = await this.db.query(
      `${OPP_SELECT} WHERE o.id = $1 AND o.is_deleted = FALSE
       AND ($2::TEXT IS NULL OR o.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Opportunity "${id}" not found`);
    return (await this.mapper())(rows[0]);
  }

  async create(data: any): Promise<Opportunity> {
    this.logger.log(`Creating opportunity [name="${data.name}" accountId=${data.accountId} ownerId=${data.ownerId ?? 'MISSING'}]`);

    if (!data.ownerId) {
      this.logger.error(
        'Opportunity creation attempted without ownerId — JwtAuthGuard may not be active on this route.',
      );
    }

    await this.assertAccountExists(data.accountId, data.ownerId);
    assertDateOrder(data.startDate, data.endDate);
    await this.assertStakeholderAssignment(data.clientStakeholderId, data.accountId, 'CLIENT', 'client stakeholder');
    await this.assertStakeholderAssignment(data.serviceProviderStakeholderId, data.accountId, 'SERVICE_PROVIDER', 'service provider stakeholder');

    const stage = data.stage || 'Lead';
    const cd    = extractCustomData(data, KNOWN);
    assertStageRequirements(data, stage);
    assertCloseDateValid(data.closeDate, data.startDate, stage);
    const closeReason = resolveCloseReason(data, stage);
    const closedAt = CLOSED_STAGES.has(stage) ? new Date() : null;

    const { rows } = await this.db.query(
      `INSERT INTO opportunities
         (id, name, account_id, stage, value, probability, owner_id,
          close_date, start_date, end_date, crm_value, description, next_step,
          risks_and_dependencies,
          close_reason, closed_at, tags, team, custom_data,
          client_stakeholder_id, service_provider_stakeholder_id,
          aop_available, aop_year, opportunity_type, service_line)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        data.name, data.accountId, stage,
        data.value ?? 0, data.probability ?? 0,
        data.ownerId ?? null,
        data.closeDate ?? '', data.startDate ?? '', data.endDate ?? '',
        data.crmValue ?? 0, data.description ?? '', data.nextStep ?? '',
        data.risksAndDependencies ?? '',
        closeReason, closedAt,
        data.tags ?? [], data.team ?? [], JSON.stringify(cd),
        data.clientStakeholderId ?? null, data.serviceProviderStakeholderId ?? null,
        data.aopAvailable ?? false, data.aopAvailable ? (data.aopYear ?? null) : null,
        data.opportunityType ?? null, data.serviceLine ?? null,
      ],
    );
    const opp = await this.findOne(rows[0].id);
    this.logger.log(`Opportunity created [id=${opp.id} ownerId=${opp.ownerId ?? 'NULL'}]`);
    await this.log(`Created Opportunity '${opp.name}'`, opp.accountId, opp.id, data.ownerId);

    if (opp.ownerId) {
      this.logger.log(`Emitting Opportunity:Created notification [userId=${opp.ownerId} opportunityId=${opp.id}]`);
      this.bus.emit({
        userId:               opp.ownerId,
        type:                 'Opportunity',
        eventType:            'Created',
        title:                'Opportunity Created',
        message:              `Opportunity "${opp.name}" has been added.`,
        severity:             'Success',
        notificationCategory: 'BUSINESS',
        accountId:            opp.accountId,
        opportunityId:        opp.id,
      });
    } else {
      this.logger.warn(`Opportunity created without ownerId — notification suppressed [opportunityId=${opp.id}]`);
    }
    return opp;
  }

  /**
   * @param requestingUserId UUID of the authenticated user (enforces ownership + audit).
   */
  async update(id: string, data: any, requestingUserId?: string): Promise<Opportunity> {
    const existing = await this.findOne(id, requestingUserId);
    if (data.accountId && data.accountId !== existing.accountId) {
      await this.assertAccountExists(data.accountId, requestingUserId);
    }
    assertDateOrder(data.startDate, data.endDate);
    await this.assertStakeholderAssignment(data.clientStakeholderId, data.accountId, 'CLIENT', 'client stakeholder');
    await this.assertStakeholderAssignment(data.serviceProviderStakeholderId, data.accountId, 'SERVICE_PROVIDER', 'service provider stakeholder');
    const cd    = extractCustomData(data, KNOWN);
    const stage = data.stage ?? existing.stage;
    if (stage !== existing.stage) assertStageRequirements(data, stage);
    assertCloseDateValid(data.closeDate, data.startDate, stage, existing.closeDate);
    const closeReason = resolveCloseReason(data, stage, existing);
    const nowClosed = CLOSED_STAGES.has(stage);
    // closed_at marks when the deal first reached a closed stage; it survives
    // a Won<->Lost correction and is cleared when the deal reopens.
    const closedAt = nowClosed
      ? (existing.closedAt ? new Date(existing.closedAt) : new Date())
      : null;

    // Ownership (owner_id) preserved from DB — never overwritten by a regular update.
    const effectiveOwnerId = existing.ownerId ?? null;

    // Opportunity Type/Service Line are mandatory on create but not retroactively
    // forced on update — a legacy opportunity that predates these fields must
    // remain editable without first being made to supply them.
    const opportunityType = data.opportunityType ?? existing.opportunityType;
    const aopAvailable = typeof data.aopAvailable === 'boolean' ? data.aopAvailable : existing.aopAvailable;
    const aopYear = aopAvailable ? (data.aopYear ?? existing.aopYear ?? null) : null;
    const serviceLine = data.serviceLine !== undefined ? data.serviceLine : existing.serviceLine ?? null;

    await this.db.query(
      `UPDATE opportunities SET
         name=$1, account_id=$2, stage=$3, value=$4, probability=$5,
         owner_id=$6,
         close_date=$7, start_date=$8, end_date=$9, crm_value=$10,
         description=$11, next_step=$12, risks_and_dependencies=$13, close_reason=$14, closed_at=$15,
         tags=$16, team=$17,
         custom_data=$18,
         client_stakeholder_id=$19, service_provider_stakeholder_id=$20,
         aop_available=$21, aop_year=$22, opportunity_type=$23,
         service_line=$24,
         updated_at=NOW()
       WHERE id=$25 AND is_deleted=FALSE`,
      [
        data.name, data.accountId, stage,
        data.value ?? existing.value ?? 0, data.probability ?? existing.probability ?? 0,
        effectiveOwnerId,
        data.closeDate ?? '', data.startDate ?? '', data.endDate ?? '',
        data.crmValue ?? 0, data.description ?? '', data.nextStep ?? '',
        data.risksAndDependencies ?? '',
        closeReason, closedAt,
        data.tags ?? [], data.team ?? [], JSON.stringify(cd),
        data.clientStakeholderId ?? null, data.serviceProviderStakeholderId ?? null,
        aopAvailable, aopYear, opportunityType,
        serviceLine,
        id,
      ],
    );
    const opp = await this.findOne(id);
    await this.log(`Updated Opportunity '${opp.name}'`, opp.accountId, opp.id, requestingUserId);

    if (opp.ownerId) {
      if (existing.stage !== opp.stage && CLOSED_STAGES.has(opp.stage)) {
        this.logger.log(`Emitting Opportunity:StageChanged [userId=${opp.ownerId} ${existing.stage}→${opp.stage}]`);
        this.bus.emit({
          userId:               opp.ownerId,
          type:                 'Opportunity',
          eventType:            'StageChanged',
          title:                opp.stage === 'Won' ? 'Opportunity Won' : 'Opportunity Lost',
          message:              `Opportunity "${opp.name}" was closed as ${opp.stage}. Reason: ${opp.closeReason}`,
          severity:             opp.stage === 'Won' ? 'Success' : 'Warning',
          notificationCategory: 'BUSINESS',
          accountId:            opp.accountId,
          opportunityId:        opp.id,
          metadata:             { oldStage: existing.stage, newStage: opp.stage, closeReason: opp.closeReason },
        });
      } else if (existing.stage !== opp.stage) {
        this.logger.log(`Emitting Opportunity:StageChanged [userId=${opp.ownerId} ${existing.stage}→${opp.stage}]`);
        this.bus.emit({
          userId:               opp.ownerId,
          type:                 'Opportunity',
          eventType:            'StageChanged',
          title:                'Opportunity Stage Updated',
          message:              `Opportunity "${opp.name}" moved from ${existing.stage} to ${opp.stage}.`,
          severity:             'Info',
          notificationCategory: 'BUSINESS',
          accountId:            opp.accountId,
          opportunityId:        opp.id,
          metadata:             { oldStage: existing.stage, newStage: opp.stage },
        });
      } else {
        this.logger.log(`Emitting Opportunity:Updated [userId=${opp.ownerId} opportunityId=${opp.id}]`);
        this.bus.emit({
          userId:               opp.ownerId,
          type:                 'Opportunity',
          eventType:            'Updated',
          title:                'Opportunity Updated',
          message:              `Opportunity "${opp.name}" details have been updated.`,
          severity:             'Info',
          notificationCategory: 'BUSINESS',
          accountId:            opp.accountId,
          opportunityId:        opp.id,
        });
      }
    }
    return opp;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const opp = await this.findOne(id, userId);
    await this.db.query(`UPDATE opportunities SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1`, [id]);
    await this.log(`Deactivated Opportunity '${opp.name}'`, opp.accountId, opp.id);

    if (opp.ownerId) {
      this.bus.emit({
        userId:               opp.ownerId,
        type:                 'Opportunity',
        eventType:            'Deactivated',
        title:                'Opportunity Deactivated',
        message:              `Opportunity "${opp.name}" has been deactivated.`,
        severity:             'Warning',
        notificationCategory: 'BUSINESS',
        accountId:            opp.accountId,
        opportunityId:        opp.id,
      });
    }
    return { success: true };
  }

  async findAllDeactivated(params: FilterParams = {}): Promise<Opportunity[]> {
    const f = this.filter.normalize(params);
    const owner = this.filter.buildOwnerConditions('o', f, 1);
    const where = ['o.is_deleted = TRUE', ...owner.conditions].join(' AND ');
    // Join accounts without an is_deleted condition: the parent may itself be
    // deactivated (cascade) and its name must still appear in the list.
    const { rows } = await this.db.query(
      `${OPP_SELECT} WHERE ${where} ORDER BY o.updated_at DESC`,
      owner.params,
    );
    return rows.map(await this.mapper());
  }

  async restore(id: string, userId?: string): Promise<Opportunity> {
    const { rows: existing } = await this.db.query(
      `SELECT o.id, a.is_deleted AS account_deleted
       FROM opportunities o
       LEFT JOIN accounts a ON o.account_id = a.id
       WHERE o.id = $1 AND o.is_deleted = TRUE
       AND ($2::TEXT IS NULL OR o.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!existing.length) throw new NotFoundException(`Deactivated opportunity "${id}" not found`);
    // Business rule: a child record cannot be active under a deactivated parent.
    if (existing[0].account_deleted) {
      throw new ConflictException('Please restore the associated Account before restoring this Opportunity.');
    }
    const { rows } = await this.db.query(
      `UPDATE opportunities SET is_deleted=FALSE, updated_at=NOW()
       WHERE id=$1 AND is_deleted=TRUE RETURNING id`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Deactivated opportunity "${id}" not found`);
    const opp = await this.findOne(id);
    await this.log(`Restored Opportunity '${opp.name}'`, opp.accountId, opp.id);

    if (opp.ownerId) {
      this.bus.emit({
        userId:               opp.ownerId,
        type:                 'Opportunity',
        eventType:            'Restored',
        title:                'Opportunity Restored',
        message:              `Opportunity "${opp.name}" has been restored.`,
        severity:             'Success',
        notificationCategory: 'BUSINESS',
        accountId:            opp.accountId,
        opportunityId:        opp.id,
      });
    }
    return opp;
  }

  /** Relational rule: the parent account must exist, be active, and belong to the requesting user. */
  private async assertAccountExists(accountId: string, ownerId?: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT id FROM accounts WHERE id = $1 AND is_deleted = FALSE
       AND ($2::TEXT IS NULL OR owner_id = $2)`,
      [accountId, ownerId ?? null],
    );
    if (!rows.length) throw new BadRequestException('The selected account does not exist');
  }

  /** Relational rule: an assigned stakeholder must belong to the same account and match the expected type. */
  private async assertStakeholderAssignment(
    id: string | undefined,
    accountId: string,
    expectedType: 'CLIENT' | 'SERVICE_PROVIDER',
    label: string,
  ): Promise<void> {
    if (!id) return;
    const { rows } = await this.db.query(
      `SELECT id FROM stakeholders
       WHERE id = $1 AND account_id = $2 AND stakeholder_type = $3 AND is_deleted = FALSE`,
      [id, accountId, expectedType],
    );
    if (!rows.length) throw new BadRequestException(`The selected ${label} is invalid for this account`);
  }

  private async log(text: string, accountId?: string, opportunityId?: string, userId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id, opportunity_id)
         VALUES (gen_random_uuid()::TEXT, 'opportunity', $1, $2, 'System', $3, $4)`,
        [text, userId ?? null, accountId ?? null, opportunityId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
