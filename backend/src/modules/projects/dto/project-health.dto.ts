import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsDateString, IsIn } from 'class-validator';

export class CreateProjectHealthDto {
  @IsString()
  @IsIn(['Green', 'Amber', 'Red'])
  health!: string;

  @IsString()
  @IsNotEmpty()
  statusSummary!: string;

  @IsString()
  @IsOptional()
  keyAchievements?: string;

  @IsString()
  @IsOptional()
  currentChallenges?: string;

  @IsString()
  @IsOptional()
  risksImpactingHealth?: string;

  @IsString()
  @IsOptional()
  mitigationPlan?: string;

  @IsString()
  @IsOptional()
  supportRequired?: string;

  @IsDateString()
  @IsOptional()
  nextReviewDate?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  overallConfidencePct?: number;

  @IsString()
  @IsOptional()
  reviewedById?: string;
}

/** PUT replaces the whole entry, so it carries the same shape as create. */
export class UpdateProjectHealthDto extends CreateProjectHealthDto {}
