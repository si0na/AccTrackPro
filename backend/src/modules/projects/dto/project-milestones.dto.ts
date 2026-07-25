import {
  IsString, IsNumber, IsOptional, IsIn, IsNotEmpty, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateProjectMilestoneDto {
  @IsString() @IsNotEmpty({ message: 'Milestone name is required' }) @MaxLength(200)
  name!: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(200)
  sprints?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `plannedStart ${ISO_DATE_MSG}` })
  plannedStart?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `plannedEnd ${ISO_DATE_MSG}` })
  plannedEnd?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `actualStart ${ISO_DATE_MSG}` })
  actualStart?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `actualEnd ${ISO_DATE_MSG}` })
  actualEnd?: string;

  @IsOptional() @IsIn(['Not Started', 'In Progress', 'Completed', 'Delayed'], {
    message: 'Status must be one of: Not Started, In Progress, Completed, Delayed',
  })
  status?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  remarks?: string;

  @IsNumber() @IsOptional() @Min(0, { message: 'Effort Planned cannot be negative' })
  effortPlanned?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Effort Spent cannot be negative' })
  effortSpent?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Cost Planned cannot be negative' })
  costPlanned?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Cost Spent cannot be negative' })
  costSpent?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  completionPct?: number;
}

export class UpdateProjectMilestoneDto extends CreateProjectMilestoneDto {
  @IsString() id!: string;
}
