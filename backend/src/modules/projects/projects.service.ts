import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilterContextService, FilterParams } from '../../common/services/filter-context.service';
import { PermissionsService } from '../rbac/permissions.service';
import { Project } from '../../types';
import { extractCustomData } from '../../common/utils/db-mapping.util';
import { Pagination, Paginated, extractTotal } from '../../common/utils/pagination.util';
import { insertHealthHistory } from './project-health-history.util';

const KNOWN = new Set([
  'id', 'name', 'description', 'accountId', 'accountName',
  'opportunityId', 'opportunityName',
  'ownerId', 'ownerName',
  'startDate', 'endDate', 'methodology',
  'serviceProviderPmId', 'serviceProviderPmName',
  'practiceLeadId', 'practiceLeadName',
  'clientPartnerId', 'clientPartnerName',
  'clientPmName',
  'status', 'health', 'asOnDate',
  'plannedCompletionPct', 'actualCompletionPct',
  'plannedEffortHours', 'actualEffortHours',
  'plannedCost', 'actualCost', 'dealValue',
  'priority', 'deliveryModel', 'billingModel', 'tower',
]);

function rowToProject(row: any): Project {
  const {
    custom_data, is_deleted, created_at, updated_at,
    account_id, account_name,
    opportunity_id, opportunity_name,
    owner_id, owner_name,
    start_date, end_date,
    service_provider_pm_id, service_provider_pm_name,
    practice_lead_id, practice_lead_name,
    client_partner_id, client_partner_name,
    client_pm_name,
    as_on_date,
    planned_completion_pct, actual_completion_pct,
    planned_effort_hours, actual_effort_hours,
    planned_cost, actual_cost, deal_value,
    priority, delivery_model, billing_model, tower,
    ...base
  } = row;
  return {
    ...base,
    name:          base.name?.replace(/ — Project$/, ''),
    accountId:     account_id,
    accountName:   account_name ?? undefined,
    opportunityId: opportunity_id,
    opportunityName: opportunity_name ?? undefined,
    ownerId:       owner_id ?? undefined,
    ownerName:     owner_name ?? undefined,
    startDate:     start_date ?? undefined,
    endDate:       end_date ?? undefined,
    serviceProviderPmId:   service_provider_pm_id ?? undefined,
    serviceProviderPmName: service_provider_pm_name ?? undefined,
    practiceLeadId:   practice_lead_id ?? undefined,
    practiceLeadName: practice_lead_name ?? undefined,
    clientPartnerId:          client_partner_id ?? undefined,
    clientPartnerName:        client_partner_name ?? undefined,
    clientPmName:                 client_pm_name ?? undefined,
    asOnDate: as_on_date ?? undefined,
    plannedCompletionPct: planned_completion_pct !== null && planned_completion_pct !== undefined ? Number(planned_completion_pct) : undefined,
    actualCompletionPct:  actual_completion_pct  !== null && actual_completion_pct  !== undefined ? Number(actual_completion_pct)  : undefined,
    plannedEffortHours:   planned_effort_hours   !== null && planned_effort_hours   !== undefined ? Number(planned_effort_hours)   : undefined,
    actualEffortHours:    actual_effort_hours    !== null && actual_effort_hours    !== undefined ? Number(actual_effort_hours)    : undefined,
    plannedCost:          planned_cost           !== null && planned_cost           !== undefined ? Number(planned_cost)           : undefined,
    actualCost:           actual_cost            !== null && actual_cost            !== undefined ? Number(actual_cost)            : undefined,
    dealValue:            deal_value             !== null && deal_value             !== undefined ? Number(deal_value)             : undefined,
    priority:             priority      ?? undefined,
    deliveryModel:        delivery_model ?? undefined,
    billingModel:         billing_model  ?? undefined,
    tower:                tower         ?? undefined,
    ...(custom_data || {}),
  } as Project;
}

/** Used by findOne()/findAllDeactivated() — a deactivated project's parent account/opportunity
 *  may itself be deactivated (cascade), so those joins carry no is_deleted condition here. */
const PROJECT_SELECT = `
  SELECT p.*, a.name AS account_name, o.name AS opportunity_name,
         ou.name AS owner_name, spu.name AS service_provider_pm_name, plu.name AS practice_lead_name,
         cpu.name AS client_partner_name
  FROM projects p
  LEFT JOIN accounts      a   ON p.account_id = a.id
  LEFT JOIN opportunities o   ON p.opportunity_id = o.id
  LEFT JOIN users         ou  ON p.owner_id = ou.id
  LEFT JOIN users         spu ON p.service_provider_pm_id = spu.id
  LEFT JOIN users         plu ON p.practice_lead_id = plu.id
  LEFT JOIN users         cpu ON p.client_partner_id  = cpu.id
`;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly filter: FilterContextService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Operational list — every project remains visible until deactivated;
   * module-specific filtering (health, methodology, status, PM, practice lead)
   * happens in the UI.
   */
  async findAll(
    params: FilterParams = {},
    pg: Pagination | null = null,
  ): Promise<Project[] | Paginated<Project>> {
    const f = this.filter.normalize(params);
    const owner = this.filter.buildOwnerConditions('p', f, 1);
    const where = ['p.is_deleted = FALSE', ...owner.conditions].join(' AND ');

    const totalCol    = pg ? ', COUNT(*) OVER()::INTEGER AS __total' : '';
    const limitClause = pg ? ` LIMIT $${owner.nextIdx} OFFSET $${owner.nextIdx + 1}` : '';
    const qParams     = pg ? [...owner.params, pg.limit, pg.offset] : owner.params;

    const { rows } = await this.db.query(
      `SELECT p.*, a.name AS account_name, o.name AS opportunity_name,
              ou.name AS owner_name, spu.name AS service_provider_pm_name, plu.name AS practice_lead_name,
              cpu.name AS client_partner_name${totalCol}
       FROM projects p
       INNER JOIN accounts      a   ON p.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN opportunities o   ON p.opportunity_id = o.id
       LEFT  JOIN users         ou  ON p.owner_id = ou.id
       LEFT  JOIN users         spu ON p.service_provider_pm_id = spu.id
       LEFT  JOIN users         plu ON p.practice_lead_id = plu.id
       LEFT  JOIN users         cpu ON p.client_partner_id  = cpu.id
       WHERE ${where}
       ORDER BY p.created_at DESC${limitClause}`,
      qParams,
    );
    if (!pg) return rows.map(rowToProject);

    const total = extractTotal(rows);
    return { data: rows.map(rowToProject), total, page: pg.page, pageSize: pg.pageSize };
  }

  async findOne(id: string, userId?: string): Promise<Project> {
    const { rows } = await this.db.query(
      `${PROJECT_SELECT} WHERE p.id = $1 AND p.is_deleted = FALSE
       AND ($2::TEXT IS NULL OR p.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Project "${id}" not found`);
    return rowToProject(rows[0]);
  }

  async create(data: any): Promise<Project> {
    this.logger.log(`Creating project [name="${data.name}" accountId=${data.accountId} opportunityId=${data.opportunityId}]`);

    await this.assertAccountExists(data.accountId, data.ownerId);
    await this.assertOpportunityBelongsToAccount(data.opportunityId, data.accountId, data.ownerId);
    return this.insertProject(data);
  }

  /**
   * Shared insert path for both create() and createFromOpportunity(). Validates
   * only the client stakeholder assignments (which are account-scoped, never
   * owner-scoped) and writes the row. The account/opportunity relational rules
   * are the caller's responsibility: create() enforces them with owner scoping,
   * while createFromOpportunity() relies on the already-loaded, RBAC-visible
   * Opportunity — so a project whose opportunity owner differs from the account
   * owner (a valid RBAC case) is never wrongly rejected. The `uq_project_opportunity`
   * unique index still guarantees one active project per opportunity (409).
   *
   * Also seeds the project's first Project Health entry from the health chosen
   * on the form, so the Health Tracker's audit trail begins at creation rather
   * than at the first manual update.
   */
  private async insertProject(data: any, requestingUserId?: string): Promise<Project> {
    await this.validatePm(data.serviceProviderPmId);
    await this.validatePracticeLead(data.practiceLeadId);
    await this.validateClientPartner(data.clientPartnerId);

    const cd = extractCustomData(data, KNOWN);
    const health = data.health || 'Green';

    // The project row and the health entry that opens its audit trail commit
    // together — the Health Tracker's history must start at project creation.
    const newId = await this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO projects
           (id, name, description, account_id, opportunity_id, owner_id,
            start_date, end_date, methodology,
            service_provider_pm_id, practice_lead_id,
            client_partner_id, client_pm_name,
            status, health, as_on_date,
            planned_completion_pct, actual_completion_pct,
            planned_effort_hours, actual_effort_hours,
            planned_cost, actual_cost, custom_data, deal_value,
            priority, delivery_model, billing_model, tower)
         VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
         RETURNING id`,
        [
          data.name, data.description ?? '', data.accountId, data.opportunityId, data.ownerId ?? null,
          data.startDate || null, data.endDate || null, data.methodology || 'Agile',
          data.serviceProviderPmId ?? null, data.practiceLeadId ?? null,
          data.clientPartnerId ?? null, data.clientPmName ?? null,
          data.status || 'Active', health, data.asOnDate || null,
          data.plannedCompletionPct ?? null, data.actualCompletionPct ?? null,
          data.plannedEffortHours ?? null, data.actualEffortHours ?? null,
          data.plannedCost ?? null, data.actualCost ?? null, JSON.stringify(cd), data.dealValue ?? null,
          data.priority ?? null, data.deliveryModel ?? null, data.billingModel ?? null, data.tower ?? null,
        ],
      );
      // No summary text is invented here — the history entry records the health
      // and who set it; only a user-written summary ever fills status_summary.
      await insertHealthHistory(client, {
        projectId: rows[0].id,
        health,
        statusSummary: '',
        updatedById: requestingUserId ?? data.ownerId ?? null,
      });
      return rows[0].id as string;
    }).catch((err) => { throw this.mapOpportunityConflict(err); });
    const project = await this.findOne(newId);
    this.logger.log(`Project created [id=${project.id} opportunityId=${project.opportunityId}]`);
    await this.log(`Created Project '${project.name}'`, project.accountId, project.id, data.ownerId);
    return project;
  }

  /**
   * @param requestingUserId UUID of the authenticated user (enforces ownership + audit).
   */
  async update(id: string, data: any, requestingUserId?: string): Promise<Project> {
    const existing = await this.findOne(id, requestingUserId);
    if (data.accountId && data.accountId !== existing.accountId) {
      await this.assertAccountExists(data.accountId, requestingUserId);
    }
    if (data.opportunityId && data.opportunityId !== existing.opportunityId) {
      await this.assertOpportunityBelongsToAccount(data.opportunityId, data.accountId ?? existing.accountId, requestingUserId);
    }
    if ('serviceProviderPmId' in data) {
      await this.validatePm(data.serviceProviderPmId);
    }
    if ('practiceLeadId' in data) {
      await this.validatePracticeLead(data.practiceLeadId);
    }
    if ('clientPartnerId' in data) {
      await this.validateClientPartner(data.clientPartnerId);
    }

    const cd = extractCustomData(data, KNOWN);

    // Ownership (owner_id) preserved from DB — never overwritten by a regular update.
    const effectiveOwnerId = existing.ownerId ?? null;

    // A changed Health must land in the Project Health Tracker's history too —
    // the Overview reads the latest entry, so the two can never diverge. An
    // unchanged Health (every save that isn't about health) writes nothing.
    const health = data.health || existing.health || 'Green';
    const healthChanged = health !== existing.health;

    const clientPmName = 'clientPmName' in data ? (data.clientPmName ?? null) : (existing.clientPmName ?? null);

    const priority = data.priority !== undefined ? (data.priority || null) : (existing.priority ?? null);
    const deliveryModel = data.deliveryModel !== undefined ? (data.deliveryModel || null) : (existing.deliveryModel ?? null);
    const billingModel  = data.billingModel !== undefined ? (data.billingModel || null) : (existing.billingModel ?? null);
    const tower         = data.tower !== undefined ? (data.tower || null) : (existing.tower ?? null);

    await this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE projects SET
           name=$1, description=$2, account_id=$3, opportunity_id=$4, owner_id=$5,
           start_date=$6, end_date=$7, methodology=$8,
           service_provider_pm_id=$9, practice_lead_id=$10,
           client_partner_id=$11, client_pm_name=$12,
           status=$13, health=$14, as_on_date=$15,
           planned_completion_pct=$16, actual_completion_pct=$17,
           planned_effort_hours=$18, actual_effort_hours=$19,
           planned_cost=$20, actual_cost=$21,
           custom_data=$22, deal_value=$23,
           priority=$24, delivery_model=$25, billing_model=$26, tower=$27,
           updated_at=NOW()
         WHERE id=$28 AND is_deleted=FALSE`,
        [
          data.name ?? existing.name, data.description ?? existing.description ?? '',
          data.accountId ?? existing.accountId, data.opportunityId ?? existing.opportunityId, effectiveOwnerId,
          data.startDate || null, data.endDate || null, data.methodology || existing.methodology || 'Agile',
          data.serviceProviderPmId ?? null, data.practiceLeadId ?? null,
          data.clientPartnerId ?? null, clientPmName,
          data.status || existing.status || 'Active', health, data.asOnDate || null,
          data.plannedCompletionPct ?? null, data.actualCompletionPct ?? null,
          data.plannedEffortHours ?? null, data.actualEffortHours ?? null,
          data.plannedCost ?? null, data.actualCost ?? null, JSON.stringify(cd), data.dealValue ?? null,
          priority, deliveryModel, billingModel, tower,
          id,
        ],
      );
      if (healthChanged) {
        // Health-only entry: no generated summary text (see create()).
        await insertHealthHistory(client, {
          projectId: id,
          health,
          statusSummary: '',
          updatedById: requestingUserId ?? null,
        });
      }
    }).catch((err) => { throw this.mapOpportunityConflict(err); });
    const project = await this.findOne(id);
    await this.log(`Updated Project '${project.name}'`, project.accountId, project.id, requestingUserId);
    return project;
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const project = await this.findOne(id, userId);
    await this.db.query(`UPDATE projects SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1`, [id]);
    await this.log(`Deactivated Project '${project.name}'`, project.accountId, project.id, userId);
    return { success: true };
  }

  async findAllDeactivated(params: FilterParams = {}): Promise<Project[]> {
    const f = this.filter.normalize(params);
    const owner = this.filter.buildOwnerConditions('p', f, 1);
    const where = ['p.is_deleted = TRUE', ...owner.conditions].join(' AND ');
    const { rows } = await this.db.query(
      `${PROJECT_SELECT} WHERE ${where} ORDER BY p.updated_at DESC`,
      owner.params,
    );
    return rows.map(rowToProject);
  }

  async restore(id: string, userId?: string): Promise<Project> {
    const { rows: existing } = await this.db.query(
      `SELECT p.id, a.is_deleted AS account_deleted
       FROM projects p
       LEFT JOIN accounts a ON p.account_id = a.id
       WHERE p.id = $1 AND p.is_deleted = TRUE
       AND ($2::TEXT IS NULL OR p.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!existing.length) throw new NotFoundException(`Deactivated project "${id}" not found`);
    // Business rule: a child record cannot be active under a deactivated parent.
    if (existing[0].account_deleted) {
      throw new ConflictException('Please restore the associated Account before restoring this Project.');
    }
    const { rows } = await this.db.query(
      `UPDATE projects SET is_deleted=FALSE, updated_at=NOW()
       WHERE id=$1 AND is_deleted=TRUE RETURNING id`,
      [id],
    ).catch((err) => { throw this.mapOpportunityConflict(err); });
    if (!rows.length) throw new NotFoundException(`Deactivated project "${id}" not found`);
    const project = await this.findOne(id);
    await this.log(`Restored Project '${project.name}'`, project.accountId, project.id, userId);
    return project;
  }

  /**
   * Creates a Project from a Won Opportunity as an explicit, user-initiated
   * action (no longer automatic on the Won transition). The relational links —
   * account, originating opportunity, and owner — are always forced from the
   * Opportunity so they can't be tampered with via the form; every other field
   * comes from the user-reviewed `data`, falling back to values derived from the
   * Opportunity. The Service Provider PM is never auto-assigned — a user chooses
   * it after the project exists.
   *
   * Delegates to create(), which enforces the account/opportunity/stakeholder
   * relational rules and maps the `uq_project_opportunity` unique-index violation
   * (one active project per opportunity) to a friendly 409, so concurrent
   * conversions can never produce a duplicate project for the same deal.
   */
  async createFromOpportunity(opp: any, data: any = {}, requestingUserId?: string): Promise<Project> {
    // Retrieve parent account's practice_lead_id and client_partner_id
    const { rows: accountRows } = await this.db.query(
      `SELECT practice_lead_id, client_partner_id FROM accounts WHERE id = $1 AND is_deleted = FALSE`,
      [opp.accountId],
    );
    const parentPracticeLeadId = accountRows.length ? accountRows[0].practice_lead_id : null;
    const parentClientPartnerId = accountRows.length ? accountRows[0].client_partner_id : null;

    const merged = {
      ...data,
      accountId:     opp.accountId,
      opportunityId: opp.id,
      ownerId:       opp.ownerId ?? null,
      name:          typeof data.name === 'string' && data.name.trim() ? data.name.trim() : opp.name,
      description:   data.description ?? opp.description ?? '',
      startDate:     data.startDate ?? opp.allocationStartDate ?? undefined,
      endDate:       data.endDate ?? opp.allocationEndDate ?? undefined,
      clientPartnerId: data.clientPartnerId ?? parentClientPartnerId ?? undefined,
      dealValue:     data.dealValue ?? opp.value ?? undefined,
      serviceProviderPmId: data.serviceProviderPmId ?? opp.serviceProviderPmId ?? undefined,
      practiceLeadId: data.practiceLeadId ?? parentPracticeLeadId ?? undefined,
      priority:      data.priority ?? opp.priority ?? undefined,
      deliveryModel: data.deliveryModel ?? opp.deliveryModel ?? undefined,
      billingModel:  data.billingModel ?? opp.billingModel ?? undefined,
      tower:         data.tower ?? opp.tower ?? undefined,
    };
    const project = await this.insertProject(merged, requestingUserId);
    this.logger.log(`Project created from Won Opportunity [projectId=${project.id} opportunityId=${opp.id}]`);
    return project;
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

  /** Relational rule: the originating opportunity must exist, be active, and belong to the same account. */
  private async assertOpportunityBelongsToAccount(opportunityId: string, accountId: string, ownerId?: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT account_id FROM opportunities WHERE id = $1 AND is_deleted = FALSE
       AND ($2::TEXT IS NULL OR owner_id = $2)`,
      [opportunityId, ownerId ?? null],
    );
    if (!rows.length) throw new BadRequestException('The selected opportunity does not exist');
    if (rows[0].account_id !== accountId) {
      throw new BadRequestException('The selected opportunity belongs to a different account');
    }
  }

  private async validatePm(pmId: string | undefined | null): Promise<void> {
    if (!pmId) return;
    const hasRole = await this.permissions.userHasRole(pmId, 'project-manager');
    if (!hasRole) {
      throw new BadRequestException(
        'The selected Service Provider Project Manager does not have the Project Manager role.',
      );
    }
  }

  private async validatePracticeLead(practiceLeadId: string | undefined | null): Promise<void> {
    if (!practiceLeadId) return;
    const hasRole = await this.permissions.userHasRole(practiceLeadId, 'practice-lead');
    if (!hasRole) {
      throw new BadRequestException(
        'The selected Practice Lead does not have the Practice Lead role.',
      );
    }
  }

  private async validateClientPartner(clientPartnerId: string | undefined | null): Promise<void> {
    if (!clientPartnerId) return;
    const hasRole = await this.permissions.userHasRole(clientPartnerId, 'client-partner');
    if (!hasRole) {
      throw new BadRequestException(
        'The selected Client Partner does not have the Client Partner role.',
      );
    }
  }

  /** Maps the uq_project_opportunity unique-index violation (concurrent Won-transitions) to a friendly 409. */
  private mapOpportunityConflict(err: any): any {
    if (err?.code === '23505' && String(err?.constraint ?? '').includes('uq_project_opportunity')) {
      return new ConflictException('A project already exists for this opportunity.');
    }
    return err;
  }

  private async log(text: string, accountId?: string, projectId?: string, userId?: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO activities (id, type, text, user_id, user_name, account_id)
         VALUES (gen_random_uuid()::TEXT, 'project', $1, $2, 'System', $3)`,
        [text, userId ?? null, accountId ?? null],
      );
    } catch (err) {
      this.logger.error(`Failed to write activity log [text="${text}"]`, err instanceof Error ? err.stack : String(err));
    }
  }
}
