import {
  IsString, IsNumber, IsBoolean, IsOptional, IsIn,
  IsNotEmpty, Min, Max, MaxLength,
} from 'class-validator';

export class CreatePerformanceEvaluationDto {
  @IsString() @IsOptional() accountId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() @MaxLength(200) account?: string;
  @IsString() @IsOptional() @MaxLength(200) project?: string;

  /** The evaluated employee — must reference an Employee Master entry. */
  @IsString() @IsNotEmpty({ message: 'Please select the employee to evaluate' })
  employeeId!: string;

  /** Legacy display field — ignored on write; the name is taken from the Employee Master. */
  @IsString() @IsOptional() @MaxLength(200) employeeName?: string;

  @IsString() @MaxLength(200) manager!: string;
  // Free-form period label (existing data is not uniform) — required, bounded.
  @IsString() @IsNotEmpty({ message: 'Evaluation month is required' }) @MaxLength(50) month!: string;
  @IsBoolean() hasReportees!: boolean;

  @IsNumber() @Min(0) @Max(10) deliveryExcellence!: number;
  @IsNumber() @Min(0) @Max(10) qualityStandards!: number;
  @IsNumber() @Min(0) @Max(10) technicalCapability!: number;
  @IsNumber() @Min(0) @Max(10) communication!: number;
  @IsNumber() @Min(0) @Max(10) sla!: number;
  @IsNumber() @Min(0) @Max(10) teamCollaboration!: number;
  @IsNumber() @Min(0) @Max(10) reliability!: number;
  @IsNumber() @Min(0) @Max(10) innovation!: number;
  @IsNumber() @Min(0) @Max(10) ideation!: number;
  @IsNumber() @Min(0) @Max(10) behavioural!: number;
  @IsNumber() @Min(0) @Max(10) @IsOptional() leadership?: number;

  @IsString() @IsOptional() @MaxLength(5000) customerFeedback?: string;
  @IsString() @IsOptional() @MaxLength(5000) employeeFeedback?: string;
  @IsString() @IsOptional() @MaxLength(2000) trainingRequired?: string;
  @IsString() @IsOptional() @MaxLength(2000) strength?: string;
  @IsString() @IsOptional() @MaxLength(2000) improvementArea?: string;
  @IsString() @IsOptional() @MaxLength(5000) keyContributionDetails?: string;
  @IsString() @IsOptional() @MaxLength(5000) ideaDetails?: string;
  @IsString() @IsOptional() @MaxLength(5000) overallComment?: string;
  @IsString() @IsOptional() @MaxLength(2000) actionItemNextMonth?: string;
  @IsIn(['High', 'Medium', 'Low']) retentionRisk!: string;
}

export class UpdatePerformanceEvaluationDto extends CreatePerformanceEvaluationDto {}
