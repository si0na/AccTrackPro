import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams, FiscalContext } from '../../common/services/filter-context.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { ProjectsService } from '../projects/projects.service';
import { Opportunity, Project } from '../../types';
import { extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';
import { validateDto } from '../../common/utils/validate-dto.util';
import { CreateOpportunityDto } from './dto/opportunity.dto';
import { OPPORTUNITY_FIELDS, opportunityPostValidate } from '../import-export/import-field-schemas';
import { BulkModuleAdapter } from '../import-export/bulk-adapter';

// 'financialYear'/'quarter' remain listed so payloads from older clients are
// stripped instead of leaking into custom_data — fiscal periods are derived
// from allocationEndDate and never stored.
const KNOWN = new Set([
  'id','name','accountId','accountName','stage','value','probability','ownerId',
  'allocationStartDate','allocationEndDate','dealStartDate','dealCloseDate','crmValue','description','nextStep',
  'risksAndDependencies',
  'closeReason','blockedReason','delayedReason','closedAt',
  'tags','team','financialYear','quarter',
  'clientStakeholderId','clientStakeholderName','clientStakeholderDesignation',
  'serviceProviderStakeholderId','serviceProviderStakeholderName','serviceProviderStakeholderDesignation',
  'aopAvailable','aopYear','opportunityType','serviceLine',
  'opportunityHealth','revenueModel','location','cost','grossMargin',
  'projectId',
  // Forecast fields are joined from opportunity_forecasts (read-only on the
  // opportunity payload; edited via the dedicated forecast endpoint). Listed so
  // a full-object round-trip through update() never leaks them into custom_data.
  'forecastDate','forecastValue','actualDate','actualValue','forecastRemarks','forecastUpdatedAt',
]);

/** Deal outcome is now tracked solely via pipeline stage — no separate status field. */
const CLOSED_STAGES = new Set(['Won', 'Lost']);

function rowToOpportunity(row: any, derive: (date: string) => { financialYear: string; quarter: string }): Opportunity {
  const {
    custom_data, is_deleted, created_at, updated_at,
    account_id, account_name, allocation_start_date, allocation_end_date, deal_start_date, deal_close_date, crm_value, next_step,
    risks_and_dependencies,
    close_reason, blocked_reason, delayed_reason, closed_at,
    owner_id,
    client_stakeholder_id, client_stakeholder_name, client_stakeholder_designation,
    service_provider_stakeholder_id, service_provider_stakeholder_name, service_provider_stakeholder_designation,
    aop_available, aop_year, opportunity_type, service_line,
    opportunity_health, revenue_model, location, cost, gross_margin,
    project_id,
    forecast_date, forecast_value, actual_date, actual_value, forecast_remarks, forecast_updated_at,
    ...base
  } = row;
  return {
    ...base,
    accountId:     account_id,
    // Linked Project (nullable) — populated once this opportunity has gone Won.
    projectId:     project_id ?? null,
    accountName:   account_name ?? undefined,
    ownerId:       owner_id   ?? undefined,
    allocationStartDate: allocation_start_date,
    allocationEndDate:   allocation_end_date,
    dealStartDate:       deal_start_date ?? undefined,
    dealCloseDate:       deal_close_date ?? undefined,
    crmValue:      Number(crm_value),
    nextStep:      next_step,
    risksAndDependencies: risks_and_dependencies ?? '',
    closeReason:   close_reason ?? '',
    blockedReason: blocked_reason ?? '',
    delayedReason: delayed_reason ?? '',
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
    opportunityHealth: opportunity_health ?? undefined,
    revenueModel:  revenue_model ?? undefined,
    location:      location ?? undefined,
    cost:          cost !== null && cost !== undefined ? Number(cost) : undefined,
    grossMargin:   gross_margin !== null && gross_margin !== undefined ? Number(gross_margin) : undefined,
    // Persisted forecast + actuals (joined from opportunity_forecasts; edited via
    // the dedicated forecast endpoint, never through opportunity create/update).
    forecastDate:     forecast_date ?? undefined,
    forecastValue:    forecast_value !== null && forecast_value !== undefined ? Number(forecast_value) : undefined,
    actualDate:       actual_date ?? undefined,
    actualValue:      actual_value !== null && actual_value !== undefined ? Number(actual_value) : undefined,
    forecastRemarks:  forecast_remarks ?? undefined,
    forecastUpdatedAt: forecast_updated_at ? new Date(forecast_updated_at).toISOString() : undefined,
    // Read-only reporting labels derived from the business date (allocation end date).
    ...derive(allocation_end_date),
    ...(custom_data || {}),
  } as Opportunity;
}

/**
 * Forecast columns are joined from opportunity_forecasts so the persisted
 * forecast + actuals travel on every opportunity payload — the list, detail,
 * and reporting views read them without a second fetch. Aliased away from the
 * opportunity's own updated_at (forecast_updated_at) and remarks
 * (forecast_remarks) to avoid column-name collisions.
 */
const OPP_FORECAST_SELECT = `
         fc.forecast_date  AS forecast_date,
         fc.forecast_value AS forecast_value,
         fc.actual_date    AS actual_date,
         fc.actual_value   AS actual_value,
         fc.remarks        AS forecast_remarks,
         fc.updated_at     AS forecast_updated_at`;

const OPP_FORECAST_JOIN = `
  LEFT JOIN opportunity_forecasts fc ON fc.opportunity_id = o.id`;

const OPP_SELECT = `
  SELECT o.*, a.name AS account_name,
         cs.name AS client_stakeholder_name, cs.designation AS client_stakeholder_designation,
         sps.name AS service_provider_stakeholder_name, sps.designation AS service_provider_stakeholder_designation,
         proj.id AS project_id,
${OPP_FORECAST_SELECT}
  FROM opportunities o
  LEFT JOIN accounts a ON o.account_id = a.id
  LEFT JOIN stakeholders cs  ON o.client_stakeholder_id           = cs.id
  LEFT JOIN stakeholders sps ON o.service_provider_stakeholder_id = sps.id
  LEFT JOIN projects proj ON proj.opportunity_id = o.id AND proj.is_deleted = FALSE${OPP_FORECAST_JOIN}
`;

/** Business rule: when both dates are present, end date cannot precede start date. */
function assertDateOrder(allocationStartDate?: string, allocationEndDate?: string, dealStartDate?: string, dealCloseDate?: string): void {
  if (allocationStartDate && allocationEndDate && allocationEndDate < allocationStartDate) {
    throw new BadRequestException('Allocation End Date cannot be earlier than Allocation Start Date');
  }
  if (dealStartDate && dealCloseDate && dealCloseDate < dealStartDate) {
    throw new BadRequestException('Deal Close Date cannot be earlier than Deal Start Date');
  }
}

/**
 * Pipeline stage reflects current sales progress only. Moving an opportunity
 * between stages is never blocked by field-completeness checks — deal value,
 * allocation end date, next step and description can be filled in at any time,
 * independent of the stage. Data-integrity rules that validate a *provided*
 * value (date ordering, past-date, formats, ranges) still apply below.
 */

/** Today as a local ISO date string (matches the ISO dates stored on deals). */
function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Allocation end dates: cannot precede the allocation start date and — for a deal that is
 * still open — cannot already be in the past. The past-date rule only applies
 * when the allocation end date is being set or changed, so existing historical records
 * remain editable.
 */
function assertAllocationEndDateValid(
  allocationEndDate: string | undefined,
  allocationStartDate: string | undefined,
  stage: string,
  previousAllocationEndDate?: string,
): void {
  if (!allocationEndDate) return;
  if (allocationStartDate && allocationEndDate < allocationStartDate) {
    throw new BadRequestException('Allocation End Date cannot be earlier than the Allocation Start Date');
  }
  const changed = previousAllocationEndDate === undefined || allocationEndDate !== previousAllocationEndDate;
  if (!CLOSED_STAGES.has(stage) && changed && allocationEndDate < todayISO()) {
    throw new BadRequestException('Allocation End Date cannot be in the past for an open opportunity');
  }
}

/**
 * Win/loss capture: closing a deal (stage becomes Won or Lost) records a
 * reason so pipeline reviews can learn from the outcome. Both the win and
 * loss reasons are optional and captured when available.
 */
function resolveCloseReason(data: any, stage: string, existing?: { stage: string; closeReason?: string }): string {
  const provided = String(data.closeReason ?? '').trim();
  if (!CLOSED_STAGES.has(stage)) return ''; // reopened deals shed their close reason
  const carried = existing?.stage === stage ? (existing.closeReason ?? '') : '';
  return provided || carried;
}

/**
 * Stage-scoped reason capture for the operational Blocked / Delayed states.
 * A distinct business concept from both risksAndDependencies (ongoing risks)
 * and closeReason (win/loss). The reason only lives while the opportunity is
 * in its matching stage: it is cleared the moment the stage moves elsewhere,
 * and carried forward when the stage is unchanged and no new value is supplied.
 * Returns null (not '') so cleared reasons read back as absent from the
 * nullable column. Both are optional — no value is ever required.
 */
function resolveStageReason(
  provided: string | undefined,
  targetStage: string,
  stage: string,
  carriedValue?: string,
): string | null {
  if (stage !== targetStage) return null;
  const value = String(provided ?? '').trim();
  return value || (carriedValue ?? '') || null;
}

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly access: AccessScopeService,
    private readonly bus: NotificationEventBus,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Role-aware visibility fragment for the opportunities alias `o`. An
   * opportunity is visible only when its parent account is visible to the user.
   * When userId is absent (internal calls, e.g. re-reading a row just written)
   * no scoping is applied; view-all roles get no restriction.
   */
  private async childScope(userId: string | null, startIdx: number) {
    if (!userId) return { conditions: [], params: [], nextIdx: startIdx };
    const ctx = await this.access.getContext(userId);
    return this.access.buildChildVisibility('o', ctx, startIdx);
  }

  /**
   * Bulk adapter used by the Global Import/Export service. Each opportunity row
   * is validated against CreateOpportunityDto and created/updated via the
   * standard paths, so account/stakeholder relational checks, date rules, stage
   * logic, custom_data, audit activity and notifications all apply per row.
   * Duplicates are matched by (name, account) within the requesting user's
   * scope. The Account reference (name → id, incl. a parent defined in the same
   * workbook) is resolved centrally by the global service before these hooks run.
   */
  bulkAdapter(userId: string): BulkModuleAdapter {
    return {
      moduleKey: 'opportunities',
      fields: OPPORTUNITY_FIELDS,
      postValidate: (row) => opportunityPostValidate(row),
      validate: (row) => validateDto(CreateOpportunityDto, row),
      naturalKey: (row) =>
        row.accountId && row.name ? `${row.accountId}::${String(row.name).trim().toLowerCase()}` : null,
      findExistingId: (row) => this.findActiveByNameAndAccount(row.name, row.accountId, userId),
      create: (row) => this.create({ ...row, ownerId: userId }),
      update: (id, row) => this.update(id, row, userId),
    };
  }

  private async findActiveByNameAndAccount(
    name?: string,
    accountId?: string,
    ownerId?: string,
  ): Promise<string | null> {
    const n = String(name ?? '').trim();
    if (!n || !accountId) return null;
    const { rows } = await this.db.query(
      `SELECT id FROM opportunities
       WHERE LOWER(TRIM(name)) = LOWER($1) AND account_id = $2 AND is_deleted = FALSE
         AND ($3::TEXT IS NULL OR owner_id = $3)
       LIMIT 1`,
      [n, accountId, ownerId ?? null],
    );
    return rows[0]?.id ?? null;
  }

  /** Row mapper that derives financialYear/quarter labels from allocation_end_date. */
  private async mapper(ctx?: FiscalContext): Promise<(row: any) => Opportunity> {
    const fiscal = ctx ?? await this.filter.getFiscalContext();
    return (row) => rowToOpportunity(row, (d) => this.filter.derivePeriod(d, fiscal));
  }

  /**
   * Operational list — never fiscal-period-filtered. An opportunity remains
   * visible until it is closed; module-specific filtering (stage, status,
   * account, allocation end date, probability) happens in the UI. The response
   * still carries financialYear/quarter labels derived from the allocation end
   * date for reporting views.
   */
  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Opportunity[] | Paginated<Opportunity>> {
    const f = this.filter.normalize(params);
    const owner = await this.childScope(f.userId, 1);
    const where = ['o.is_deleted = FALSE', ...owner.conditions].join(' AND ');

    const totalCol   = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${owner.nextIdx} OFFSET $${owner.nextIdx + 1}` : '';
    const qParams     = pg ? [...owner.params, pg.limit, pg.offset] : owner.params;

    const { rows } = await this.db.query(
      `SELECT o.*, a.name AS account_name,
              cs.name AS client_stakeholder_name, cs.designation AS client_stakeholder_designation,
              sps.name AS service_provider_stakeholder_name, sps.designation AS service_provider_stakeholder_designation,
              proj.id AS project_id,
${OPP_FORECAST_SELECT}${totalCol}
       FROM opportunities o
       INNER JOIN accounts a ON o.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN stakeholders cs  ON o.client_stakeholder_id           = cs.id
       LEFT  JOIN stakeholders sps ON o.service_provider_stakeholder_id = sps.id
       LEFT  JOIN projects proj ON proj.opportunity_id = o.id AND proj.is_deleted = FALSE${OPP_FORECAST_JOIN}
       WHERE ${where}
       ORDER BY o.created_at DESC${limitClause}`,
      qParams,
    );
    if (!pg) return rows.map(await this.mapper());

    const total = extractTotal(rows);
    return { data: rows.map(await this.mapper()), total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(id: string, userId?: string): Promise<Opportunity> {
    const { conditions, params } = await this.childScope(userId ?? null, 2);
    const scopeClause = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `${OPP_SELECT} WHERE o.id = $1 AND o.is_deleted = FALSE${scopeClause}`,
      [id, ...params],
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
    assertDateOrder(data.allocationStartDate, data.allocationEndDate, data.dealStartDate, data.dealCloseDate);
    await this.assertStakeholderAssignment(data.clientStakeholderId, data.accountId, 'CLIENT', 'client stakeholder');
    await this.assertStakeholderAssignment(data.serviceProviderStakeholderId, data.accountId, 'SERVICE_PROVIDER', 'service provider stakeholder');

    const stage = data.stage || 'Lead';
    const cd    = extractCustomData(data, KNOWN);
    assertAllocationEndDateValid(data.allocationEndDate, data.allocationStartDate, stage);
    const closeReason = resolveCloseReason(data, stage);
    const blockedReason = resolveStageReason(data.blockedReason, 'Blocked', stage);
    const delayedReason = resolveStageReason(data.delayedReason, 'Delayed', stage);
    const closedAt = CLOSED_STAGES.has(stage) ? new Date() : null;

    const { rows } = await this.db.query(
      `INSERT INTO opportunities
         (id, name, account_id, stage, value, probability, owner_id,
          allocation_start_date, allocation_end_date, deal_start_date, deal_close_date, crm_value, description, next_step,
          risks_and_dependencies,
          close_reason, blocked_reason, delayed_reason, closed_at, tags, team, custom_data,
          client_stakeholder_id, service_provider_stakeholder_id,
          aop_available, aop_year, opportunity_type, service_line,
          opportunity_health, revenue_model, location, cost, gross_margin)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
       RETURNING id`,
      [
        data.name, data.accountId, stage,
        data.value ?? 0, data.probability ?? 0,
        data.ownerId ?? null,
        data.allocationStartDate || null, data.allocationEndDate ?? '', data.dealStartDate ?? null, data.dealCloseDate ?? null,
        data.crmValue ?? 0, data.description ?? '', data.nextStep ?? '',
        data.risksAndDependencies ?? '',
        closeReason, blockedReason, delayedReason, closedAt,
        data.tags ?? [], data.team ?? [], JSON.stringify(cd),
        data.clientStakeholderId ?? null, data.serviceProviderStakeholderId ?? null,
        data.aopAvailable ?? false, data.aopAvailable ? (data.aopYear ?? null) : null,
        data.opportunityType ?? null, data.serviceLine ?? null,
        data.opportunityHealth ?? null, data.revenueModel ?? null, data.location ?? null,
        data.cost ?? null, data.grossMargin ?? null,
      ],
    );
    const opp = await this.findOne(rows[0].id);
    this.logger.log(`Opportunity created [id=${opp.id} ownerId=${opp.ownerId ?? 'NULL'}]`);
    await this.log(`Created Opportunity '${opp.name}'`, opp.accountId, opp.id, data.ownerId);

    // Note: reaching the Won stage no longer auto-creates a Project. A Project
    // is created only when a user explicitly runs the "Create Project" action
    // (see createProject() below), so a Won opportunity can sit without one.

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
    // Read-only enforcement: a Won opportunity's sales history is frozen —
    // ongoing work happens on its linked Project instead. This guard checks
    // existing.stage (the value BEFORE this update), so the one transition
    // update that first moves the deal INTO Won still passes; only a second
    // edit attempt on an already-Won opportunity is blocked.
    if (existing.stage === 'Won') {
      throw new ConflictException('Won opportunities are read-only. Manage ongoing work through the linked Project instead.');
    }
    if (data.accountId && data.accountId !== existing.accountId) {
      await this.assertAccountExists(data.accountId, requestingUserId);
    }
    assertDateOrder(data.allocationStartDate, data.allocationEndDate, data.dealStartDate, data.dealCloseDate);
    await this.assertStakeholderAssignment(data.clientStakeholderId, data.accountId, 'CLIENT', 'client stakeholder');
    await this.assertStakeholderAssignment(data.serviceProviderStakeholderId, data.accountId, 'SERVICE_PROVIDER', 'service provider stakeholder');
    const cd    = extractCustomData(data, KNOWN);
    const stage = data.stage ?? existing.stage;
    assertAllocationEndDateValid(data.allocationEndDate, data.allocationStartDate, stage, existing.allocationEndDate);
    const closeReason = resolveCloseReason(data, stage, existing);
    const blockedReason = resolveStageReason(
      data.blockedReason, 'Blocked', stage,
      existing.stage === 'Blocked' ? existing.blockedReason : undefined,
    );
    const delayedReason = resolveStageReason(
      data.delayedReason, 'Delayed', stage,
      existing.stage === 'Delayed' ? existing.delayedReason : undefined,
    );
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
    const opportunityHealth = data.opportunityHealth ?? existing.opportunityHealth ?? null;
    const revenueModel = data.revenueModel ?? existing.revenueModel ?? null;
    const location = data.location ?? existing.location ?? null;
    const cost = data.cost ?? existing.cost ?? null;
    const grossMargin = data.grossMargin ?? existing.grossMargin ?? null;

    await this.db.query(
      `UPDATE opportunities SET
         name=$1, account_id=$2, stage=$3, value=$4, probability=$5,
         owner_id=$6,
         allocation_start_date=$7, allocation_end_date=$8, deal_start_date=$9, deal_close_date=$10, crm_value=$11,
         description=$12, next_step=$13, risks_and_dependencies=$14, close_reason=$15,
         blocked_reason=$16, delayed_reason=$17, closed_at=$18,
         tags=$19, team=$20,
         custom_data=$21,
         client_stakeholder_id=$22, service_provider_stakeholder_id=$23,
         aop_available=$24, aop_year=$25, opportunity_type=$26,
         service_line=$27,
         opportunity_health=$28, revenue_model=$29, location=$30, cost=$31, gross_margin=$32,
         updated_at=NOW()
       WHERE id=$33 AND is_deleted=FALSE`,
      [
        data.name, data.accountId, stage,
        data.value ?? existing.value ?? 0, data.probability ?? existing.probability ?? 0,
        effectiveOwnerId,
        data.allocationStartDate || null, data.allocationEndDate ?? '', data.dealStartDate ?? null, data.dealCloseDate ?? null,
        data.crmValue ?? 0, data.description ?? '', data.nextStep ?? '',
        data.risksAndDependencies ?? '',
        closeReason, blockedReason, delayedReason, closedAt,
        data.tags ?? [], data.team ?? [], JSON.stringify(cd),
        data.clientStakeholderId ?? null, data.serviceProviderStakeholderId ?? null,
        aopAvailable, aopYear, opportunityType,
        serviceLine,
        opportunityHealth, revenueModel, location, cost, grossMargin,
        id,
      ],
    );
    const opp = await this.findOne(id);
    await this.log(`Updated Opportunity '${opp.name}'`, opp.accountId, opp.id, requestingUserId);

    // Won transition no longer auto-creates a Project. The opportunity stays in
    // the Opportunity module until a user explicitly runs "Create Project"
    // (createProject() below); it does not enter the Projects module on its own.

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

  /**
   * User-initiated conversion of a Won Opportunity into a Project. Replaces the
   * former automatic-on-Won behaviour: nothing happens until a user explicitly
   * runs this. Validates that the deal is Won and has no Project yet (the DB
   * unique index is the race-safe backstop), then delegates the actual insert to
   * ProjectsService, which forces the account/opportunity/owner links from the
   * Opportunity. `data` carries the user-reviewed project fields from the form.
   *
   * @param requestingUserId UUID of the authenticated user (enforces visibility + ownership).
   */
  async createProject(id: string, data: any, requestingUserId?: string): Promise<Project> {
    const opp = await this.findOne(id, requestingUserId);
    if (opp.stage !== 'Won') {
      throw new BadRequestException('A Project can only be created for a Won opportunity.');
    }
    if (opp.projectId) {
      throw new ConflictException('A project already exists for this opportunity.');
    }
    const project = await this.projectsService.createFromOpportunity(opp, data, requestingUserId);
    this.logger.log(`Project created from Opportunity [opportunityId=${opp.id} projectId=${project.id}]`);

    if (opp.ownerId) {
      this.bus.emit({
        userId:               opp.ownerId,
        type:                 'Opportunity',
        eventType:            'Updated',
        title:                'Project Created',
        message:              `A project has been created for opportunity "${opp.name}".`,
        severity:             'Success',
        notificationCategory: 'BUSINESS',
        accountId:            opp.accountId,
        opportunityId:        opp.id,
      });
    }
    return project;
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
    const owner = await this.childScope(f.userId, 1);
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
    const { conditions, params } = await this.childScope(userId ?? null, 2);
    const scopeClause = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const { rows: existing } = await this.db.query(
      `SELECT o.id, a.is_deleted AS account_deleted
       FROM opportunities o
       LEFT JOIN accounts a ON o.account_id = a.id
       WHERE o.id = $1 AND o.is_deleted = TRUE${scopeClause}`,
      [id, ...params],
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

  /** Relational rule: the parent account must exist, be active, and be visible to the requesting user. */
  private async assertAccountExists(accountId: string, userId?: string): Promise<void> {
    const scope = userId
      ? this.access.buildAccountVisibility('a', await this.access.getContext(userId), 2)
      : { conditions: [] as string[], params: [] as any[] };
    const clause = scope.conditions.length ? ` AND ${scope.conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(
      `SELECT a.id FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE${clause}`,
      [accountId, ...scope.params],
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
