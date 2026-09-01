import { IsString, IsOptional, IsNumber, Min, Max, IsDateString } from 'class-validator';

export class CreateProjectProgressDto {
  @IsDateString()
  @IsOptional()
  asOnDate?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  plannedCompletionPct?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  actualCompletionPct?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  plannedEffortHours?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualEffortHours?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  plannedCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCost?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateProjectProgressDto extends CreateProjectProgressDto {}
