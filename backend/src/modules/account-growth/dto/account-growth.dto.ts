import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn, IsArray, IsDateString } from 'class-validator';

export class ClientPriorityDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsString() @IsNotEmpty() digitalTechPriorities!: string;
  @IsOptional() @IsString() potentialServicesInvolved?: string;
  @IsOptional() @IsIn(['High', 'Medium', 'Low']) customerMaturity?: string;
  @IsOptional() @IsIn(['Yes', 'No']) ourPresence?: string;
  @IsOptional() @IsString() competitorPresence?: string;
  @IsOptional() @IsNumber() estimatedClientSpend?: number;
  @IsOptional() @IsNumber() revenuePotential?: number;
}

export class IndustryTrendDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsString() @IsNotEmpty() industryTrend!: string;
  @IsOptional() @IsIn(['High', 'Medium', 'Low']) clientImpact?: string;
  @IsOptional() @IsIn(['High', 'Medium', 'Low']) customerMaturity?: string;
  @IsOptional() @IsString() ourCapabilityToAddress?: string;
  @IsOptional() @IsNumber() estimatedClientSpend?: number;
  @IsOptional() @IsNumber() revenuePotential?: number;
}

export class BudgetPositioningDto {
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsOptional() @IsNumber() clientRevenue?: number;
  @IsOptional() @IsNumber() itBudgetTam?: number;
  @IsOptional() @IsNumber() inhouseSpendSam?: number;
  @IsOptional() @IsNumber() outsourcingSpend?: number;
  @IsOptional() @IsNumber() reflectionsWalletSharePrevFyPct?: number;
  @IsOptional() @IsNumber() walletSharePlanCurrentFyPct?: number;
}

export class WalletSharePlanDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsString() @IsNotEmpty() initiativeTitle!: string;
  @IsOptional() @IsString() strategyDetails?: string;
  @IsOptional() @IsNumber() targetRevenueImpact?: number;
}

export class SuccessParametersSaveDto {
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsArray() items!: Array<{
    parameterKey: string;
    parameterName: string;
    clientPerception: 'Expert' | 'Good' | 'Average' | 'Weak';
  }>;
}

export class OutsourcingSplitDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsString() @IsNotEmpty() businessDivision!: string;
  @IsOptional() @IsNumber() outsourcingSpendPct?: number;
  @IsOptional() @IsIn(['Y', 'N']) presence?: string;
}

export class SwotDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsIn(['Strength', 'Weakness', 'Opportunity', 'Threat']) category!: string;
  @IsString() @IsNotEmpty() details!: string;
}

export class CompetitorDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsString() @IsNotEmpty() competitorName!: string;
  @IsOptional() @IsString() areasInvolved?: string;
  @IsOptional() @IsNumber() resCount?: number;
  @IsOptional() @IsString() relationshipStatus?: string;
  @IsOptional() @IsString() sponsorFromClient?: string;
  @IsOptional() @IsString() majorSkillsProvided?: string;
  @IsOptional() @IsString() reasonConsideringCompetitor?: string;
  @IsOptional() @IsString() reflectionsPresence?: string;
}

export class ActionPlanDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() accountId!: string;
  @IsString() @IsNotEmpty() financialYearId!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsString() @IsNotEmpty() actionPlanned!: string;
  @IsOptional() @IsString() ourApproach?: string;
  @IsOptional() @IsString() timeline?: string;
  @IsOptional() @IsString() expectedOutcome?: string;
  @IsOptional() @IsDateString() targetDate?: string;
}
