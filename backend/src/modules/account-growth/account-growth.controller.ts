import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AccountGrowthService } from './account-growth.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
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

@Controller('account-growth')
@UseGuards(JwtAuthGuard)
export class AccountGrowthController {
  constructor(private readonly service: AccountGrowthService) {}

  @Get()
  @RequirePermission('accountGrowth', 'view')
  async getWorkspace(
    @Query('accountId') accountId: string,
    @Query('financialYearId') financialYearId: string,
    @AuthUser() authUser?: JwtPayload,
  ) {
    return this.service.getWorkspace(accountId, financialYearId, authUser?.sub);
  }

  // --- Client Priorities ---
  @Post('client-priorities')
  @RequirePermission('accountGrowth', 'create')
  async createClientPriority(@Body() dto: ClientPriorityDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createClientPriority(dto, authUser?.sub);
  }

  @Post('client-priorities/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateClientPriority(@Param('id') id: string, @Body() dto: ClientPriorityDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateClientPriority(id, dto, authUser?.sub);
  }

  @Post('client-priorities/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteClientPriority(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteClientPriority(id, accountId, authUser?.sub);
  }

  // --- Industry Trends ---
  @Post('industry-trends')
  @RequirePermission('accountGrowth', 'create')
  async createIndustryTrend(@Body() dto: IndustryTrendDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createIndustryTrend(dto, authUser?.sub);
  }

  @Post('industry-trends/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateIndustryTrend(@Param('id') id: string, @Body() dto: IndustryTrendDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateIndustryTrend(id, dto, authUser?.sub);
  }

  @Post('industry-trends/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteIndustryTrend(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteIndustryTrend(id, accountId, authUser?.sub);
  }

  // --- Budget Positioning Snapshot ---
  @Post('budget-positioning/save')
  @RequirePermission('accountGrowth', 'update')
  async saveBudgetPositioning(@Body() dto: BudgetPositioningDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.saveBudgetPositioning(dto, authUser?.sub);
  }

  // --- Wallet Share Plans ---
  @Post('wallet-share-plans')
  @RequirePermission('accountGrowth', 'create')
  async createWalletSharePlan(@Body() dto: WalletSharePlanDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createWalletSharePlan(dto, authUser?.sub);
  }

  @Post('wallet-share-plans/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateWalletSharePlan(@Param('id') id: string, @Body() dto: WalletSharePlanDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateWalletSharePlan(id, dto, authUser?.sub);
  }

  @Post('wallet-share-plans/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteWalletSharePlan(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteWalletSharePlan(id, accountId, authUser?.sub);
  }

  // --- Success Parameters Snapshot ---
  @Post('success-parameters/save')
  @RequirePermission('accountGrowth', 'update')
  async saveSuccessParameters(@Body() dto: SuccessParametersSaveDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.saveSuccessParameters(dto, authUser?.sub);
  }

  // --- Outsourcing Splits ---
  @Post('outsourcing-splits')
  @RequirePermission('accountGrowth', 'create')
  async createOutsourcingSplit(@Body() dto: OutsourcingSplitDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createOutsourcingSplit(dto, authUser?.sub);
  }

  @Post('outsourcing-splits/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateOutsourcingSplit(@Param('id') id: string, @Body() dto: OutsourcingSplitDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateOutsourcingSplit(id, dto, authUser?.sub);
  }

  @Post('outsourcing-splits/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteOutsourcingSplit(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteOutsourcingSplit(id, accountId, authUser?.sub);
  }

  // --- SWOT ---
  @Post('swot')
  @RequirePermission('accountGrowth', 'create')
  async createSwot(@Body() dto: SwotDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createSwot(dto, authUser?.sub);
  }

  @Post('swot/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateSwot(@Param('id') id: string, @Body() dto: SwotDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateSwot(id, dto, authUser?.sub);
  }

  @Post('swot/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteSwot(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteSwot(id, accountId, authUser?.sub);
  }

  // --- Competitors ---
  @Post('competitors')
  @RequirePermission('accountGrowth', 'create')
  async createCompetitor(@Body() dto: CompetitorDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createCompetitor(dto, authUser?.sub);
  }

  @Post('competitors/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateCompetitor(@Param('id') id: string, @Body() dto: CompetitorDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateCompetitor(id, dto, authUser?.sub);
  }

  @Post('competitors/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteCompetitor(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteCompetitor(id, accountId, authUser?.sub);
  }

  // --- Action Plans ---
  @Post('action-plans')
  @RequirePermission('accountGrowth', 'create')
  async createActionPlan(@Body() dto: ActionPlanDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.createActionPlan(dto, authUser?.sub);
  }

  @Post('action-plans/:id/update')
  @RequirePermission('accountGrowth', 'update')
  async updateActionPlan(@Param('id') id: string, @Body() dto: ActionPlanDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.updateActionPlan(id, dto, authUser?.sub);
  }

  @Post('action-plans/:id/delete')
  @RequirePermission('accountGrowth', 'delete')
  async deleteActionPlan(@Param('id') id: string, @Body('accountId') accountId: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.deleteActionPlan(id, accountId, authUser?.sub);
  }
}
