import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AccessScopeService } from '../rbac/access-scope.service';
import {
  ClientPriorityDto,
  IndustryTrendDto,
  BudgetPositioningDto,
  WalletSharePlanDto,
  SuccessParametersSaveDto,
  OutsourcingSplitDto,
  SwotDto,
  CompetitorDto,
  ActionPlanDto,
} from './dto/account-growth.dto';

const DEFAULT_SUCCESS_PARAMETERS = [
  { key: 'relationship', name: 'Relationship', defaultPerception: 'Good' },
  { key: 'domain_expertise', name: 'Domain Expertise', defaultPerception: 'Good' },
  { key: 'technology_expertise', name: 'Technology Expertise', defaultPerception: 'Good' },
  { key: 'delivery_expertise', name: 'Delivery Expertise', defaultPerception: 'Good' },
  { key: 'talent_availability', name: 'Talent Availability', defaultPerception: 'Good' },
  { key: 'nps_score', name: 'NPS Score', defaultPerception: 'Good' },
];

function mapRowToCamelCase(row: any): any {
  if (!row) return row;
  const result: any = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}


@Injectable()
export class AccountGrowthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessScopeService,
  ) {}

  private async assertAccountAccess(userId: string | undefined, accountId: string): Promise<void> {
    if (!userId) return;
    const ctx = await this.access.getContext(userId);
    if (ctx.canViewAllAccounts) return;
    const vis = this.access.buildAccountVisibility('a', ctx, 2);
    const whereClause = vis.conditions.length ? `AND ${vis.conditions.join(' AND ')}` : '';
    const query = `SELECT 1 FROM accounts a WHERE a.id = $1 AND a.is_deleted = FALSE ${whereClause}`;
    const res = await this.db.query(query, [accountId, ...vis.params]);
    if (res.rows.length === 0) {
      throw new ForbiddenException(`Access denied for account ${accountId}`);
    }
  }

  private async ensureSuccessParametersInitialized(accountId: string, financialYearId: string): Promise<void> {
    for (const param of DEFAULT_SUCCESS_PARAMETERS) {
      await this.db.query(
        `INSERT INTO account_growth_success_parameters
           (account_id, financial_year_id, parameter_key, parameter_name, client_perception)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, financial_year_id, parameter_key) DO NOTHING`,
        [accountId, financialYearId, param.key, param.name, param.defaultPerception],
      );
    }
  }

  async getWorkspace(accountId: string, financialYearId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    await this.ensureSuccessParametersInitialized(accountId, financialYearId);

    const [
      cpRes,
      itRes,
      bpRes,
      wspRes,
      spRes,
      osRes,
      swotRes,
      compRes,
      apRes,
    ] = await Promise.all([
      this.db.query(
        `SELECT * FROM account_growth_client_priorities WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_industry_trends WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_budget_positioning WHERE account_id = $1 AND financial_year_id = $2 LIMIT 1`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_wallet_share_plans WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_success_parameters WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_outsourcing_splits WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_swot WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_competitors WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
      this.db.query(
        `SELECT * FROM account_growth_action_plans WHERE account_id = $1 AND financial_year_id = $2 ORDER BY created_at ASC`,
        [accountId, financialYearId],
      ),
    ]);

    return {
      clientPriorities: cpRes.rows.map(mapRowToCamelCase),
      industryTrends: itRes.rows.map(mapRowToCamelCase),
      budgetPositioning: mapRowToCamelCase(bpRes.rows[0]) ?? null,
      walletSharePlans: wspRes.rows.map(mapRowToCamelCase),
      successParameters: spRes.rows.map(mapRowToCamelCase),
      outsourcingSplits: osRes.rows.map(mapRowToCamelCase),
      swot: swotRes.rows.map(mapRowToCamelCase),
      competitors: compRes.rows.map(mapRowToCamelCase),
      actionPlans: apRes.rows.map(mapRowToCamelCase),
    };
  }

  // --- Client Priorities ---
  async createClientPriority(dto: ClientPriorityDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_client_priorities
         (account_id, financial_year_id, digital_tech_priorities, potential_services_involved, customer_maturity, our_presence, competitor_presence, estimated_client_spend, revenue_potential)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [dto.accountId, dto.financialYearId, dto.digitalTechPriorities, dto.potentialServicesInvolved, dto.customerMaturity, dto.ourPresence, dto.competitorPresence, dto.estimatedClientSpend, dto.revenuePotential],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateClientPriority(id: string, dto: ClientPriorityDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_client_priorities
       SET digital_tech_priorities = $3, potential_services_involved = $4, customer_maturity = $5, our_presence = $6, competitor_presence = $7, estimated_client_spend = $8, revenue_potential = $9, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, dto.accountId, dto.digitalTechPriorities, dto.potentialServicesInvolved, dto.customerMaturity, dto.ourPresence, dto.competitorPresence, dto.estimatedClientSpend, dto.revenuePotential],
    );
    if (!rows.length) throw new NotFoundException('Client Priority record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteClientPriority(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_client_priorities WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('Client Priority record not found');
    return { success: true, id };
  }

  // --- Industry Trends ---
  async createIndustryTrend(dto: IndustryTrendDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_industry_trends
         (account_id, financial_year_id, industry_trend, client_impact, customer_maturity, our_capability_to_address, estimated_client_spend, revenue_potential)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [dto.accountId, dto.financialYearId, dto.industryTrend, dto.clientImpact, dto.customerMaturity, dto.ourCapabilityToAddress, dto.estimatedClientSpend, dto.revenuePotential],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateIndustryTrend(id: string, dto: IndustryTrendDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_industry_trends
       SET industry_trend = $3, client_impact = $4, customer_maturity = $5, our_capability_to_address = $6, estimated_client_spend = $7, revenue_potential = $8, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, dto.accountId, dto.industryTrend, dto.clientImpact, dto.customerMaturity, dto.ourCapabilityToAddress, dto.estimatedClientSpend, dto.revenuePotential],
    );
    if (!rows.length) throw new NotFoundException('Industry Trend record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteIndustryTrend(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_industry_trends WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('Industry Trend record not found');
    return { success: true, id };
  }

  // --- Budget Positioning Snapshot ---
  async saveBudgetPositioning(dto: BudgetPositioningDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_budget_positioning
         (account_id, financial_year_id, client_revenue, it_budget_tam, inhouse_spend_sam, outsourcing_spend, reflections_wallet_share_prev_fy_pct, wallet_share_plan_current_fy_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_id, financial_year_id) DO UPDATE SET
         client_revenue = EXCLUDED.client_revenue,
         it_budget_tam = EXCLUDED.it_budget_tam,
         inhouse_spend_sam = EXCLUDED.inhouse_spend_sam,
         outsourcing_spend = EXCLUDED.outsourcing_spend,
         reflections_wallet_share_prev_fy_pct = EXCLUDED.reflections_wallet_share_prev_fy_pct,
         wallet_share_plan_current_fy_pct = EXCLUDED.wallet_share_plan_current_fy_pct,
         updated_at = NOW()
       RETURNING *`,
      [
        dto.accountId,
        dto.financialYearId,
        dto.clientRevenue,
        dto.itBudgetTam,
        dto.inhouseSpendSam,
        dto.outsourcingSpend,
        dto.reflectionsWalletSharePrevFyPct,
        dto.walletSharePlanCurrentFyPct,
      ],
    );
    return mapRowToCamelCase(rows[0]);
  }

  // --- Wallet Share Plans ---
  async createWalletSharePlan(dto: WalletSharePlanDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_wallet_share_plans
         (account_id, financial_year_id, initiative_title, strategy_details, target_revenue_impact)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dto.accountId, dto.financialYearId, dto.initiativeTitle, dto.strategyDetails, dto.targetRevenueImpact],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateWalletSharePlan(id: string, dto: WalletSharePlanDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_wallet_share_plans
       SET initiative_title = $3, strategy_details = $4, target_revenue_impact = $5, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, dto.accountId, dto.initiativeTitle, dto.strategyDetails, dto.targetRevenueImpact],
    );
    if (!rows.length) throw new NotFoundException('Wallet Share Plan record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteWalletSharePlan(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_wallet_share_plans WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('Wallet Share Plan record not found');
    return { success: true, id };
  }

  // --- Success Parameters Snapshot ---
  async saveSuccessParameters(dto: SuccessParametersSaveDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const results = [];
    for (const item of dto.items) {
      const { rows } = await this.db.query(
        `INSERT INTO account_growth_success_parameters
           (account_id, financial_year_id, parameter_key, parameter_name, client_perception)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, financial_year_id, parameter_key) DO UPDATE SET
           client_perception = EXCLUDED.client_perception,
           updated_at = NOW()
         RETURNING *`,
        [dto.accountId, dto.financialYearId, item.parameterKey, item.parameterName, item.clientPerception],
      );
      results.push(mapRowToCamelCase(rows[0]));
    }
    return results;
  }

  // --- Outsourcing Splits ---
  async createOutsourcingSplit(dto: OutsourcingSplitDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_outsourcing_splits
         (account_id, financial_year_id, business_division, outsourcing_spend_pct, presence)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dto.accountId, dto.financialYearId, dto.businessDivision, dto.outsourcingSpendPct, dto.presence],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateOutsourcingSplit(id: string, dto: OutsourcingSplitDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_outsourcing_splits
       SET business_division = $3, outsourcing_spend_pct = $4, presence = $5, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, dto.accountId, dto.businessDivision, dto.outsourcingSpendPct, dto.presence],
    );
    if (!rows.length) throw new NotFoundException('Outsourcing Split record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteOutsourcingSplit(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_outsourcing_splits WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('Outsourcing Split record not found');
    return { success: true, id };
  }

  // --- SWOT ---
  async createSwot(dto: SwotDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_swot
         (account_id, financial_year_id, category, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [dto.accountId, dto.financialYearId, dto.category, dto.details],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateSwot(id: string, dto: SwotDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_swot
       SET category = $3, details = $4, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, dto.accountId, dto.category, dto.details],
    );
    if (!rows.length) throw new NotFoundException('SWOT record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteSwot(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_swot WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('SWOT record not found');
    return { success: true, id };
  }

  // --- Competitors ---
  async createCompetitor(dto: CompetitorDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_competitors
         (account_id, financial_year_id, competitor_name, areas_involved, res_count, relationship_status, sponsor_from_client, major_skills_provided, reason_considering_competitor, reflections_presence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        dto.accountId,
        dto.financialYearId,
        dto.competitorName,
        dto.areasInvolved,
        dto.resCount,
        dto.relationshipStatus,
        dto.sponsorFromClient,
        dto.majorSkillsProvided,
        dto.reasonConsideringCompetitor,
        dto.reflectionsPresence,
      ],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateCompetitor(id: string, dto: CompetitorDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_competitors
       SET competitor_name = $3, areas_involved = $4, res_count = $5, relationship_status = $6, sponsor_from_client = $7, major_skills_provided = $8, reason_considering_competitor = $9, reflections_presence = $10, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [
        id,
        dto.accountId,
        dto.competitorName,
        dto.areasInvolved,
        dto.resCount,
        dto.relationshipStatus,
        dto.sponsorFromClient,
        dto.majorSkillsProvided,
        dto.reasonConsideringCompetitor,
        dto.reflectionsPresence,
      ],
    );
    if (!rows.length) throw new NotFoundException('Competitor record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteCompetitor(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_competitors WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('Competitor record not found');
    return { success: true, id };
  }

  // --- Action Plans ---
  async createActionPlan(dto: ActionPlanDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `INSERT INTO account_growth_action_plans
         (account_id, financial_year_id, category, action_planned, our_approach, timeline, expected_outcome, target_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [dto.accountId, dto.financialYearId, dto.category, dto.actionPlanned, dto.ourApproach, dto.timeline, dto.expectedOutcome, dto.targetDate || null],
    );
    return mapRowToCamelCase(rows[0]);
  }

  async updateActionPlan(id: string, dto: ActionPlanDto, userId?: string) {
    await this.assertAccountAccess(userId, dto.accountId);
    const { rows } = await this.db.query(
      `UPDATE account_growth_action_plans
       SET category = $3, action_planned = $4, our_approach = $5, timeline = $6, expected_outcome = $7, target_date = $8, updated_at = NOW()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, dto.accountId, dto.category, dto.actionPlanned, dto.ourApproach, dto.timeline, dto.expectedOutcome, dto.targetDate || null],
    );
    if (!rows.length) throw new NotFoundException('Action Plan record not found');
    return mapRowToCamelCase(rows[0]);
  }

  async deleteActionPlan(id: string, accountId: string, userId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const { rows } = await this.db.query(
      `DELETE FROM account_growth_action_plans WHERE id = $1 AND account_id = $2 RETURNING id`,
      [id, accountId],
    );
    if (!rows.length) throw new NotFoundException('Action Plan record not found');
    return { success: true, id };
  }
}
