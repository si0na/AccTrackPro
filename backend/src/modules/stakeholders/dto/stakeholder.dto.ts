import {
  IsString, IsOptional, IsIn, IsEmail, IsNotEmpty, MaxLength, Matches,
  IsDateString, IsNumber, Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

export class CreateStakeholderDto {
  @IsString() @IsNotEmpty({ message: 'Stakeholder name is required' }) @MaxLength(200)
  name!: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  accountId?: string;

  @IsString() @IsOptional() @MaxLength(200) designation?: string;

  @IsIn(['High', 'Medium', 'Low']) influence!: string;
  @IsIn(['Strong', 'Weak', 'Neutral', 'No Relationship']) relationship!: string;
  @IsIn(['CLIENT', 'SERVICE_PROVIDER']) stakeholderType!: string;
  @IsIn(['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6+'])
  @IsOptional()
  level?: string;

  @EmptyToUndefined()
  @IsOptional() @IsEmail({}, { message: 'email must be a valid email address' }) @MaxLength(200)
  email?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(50)
  phone?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(150)
  department?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  linkedinProfileUrl?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  primaryOwnerId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  secondaryOwnerId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  tertiaryOwnerId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn([
    'AI', 'Cloud', 'Cyber Security', 'Data', 'Application Development',
    'GCC', 'Application Support/AMS', 'SharePoint', 'QA', 'Projects', 'Others',
  ])
  area?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  keyPriorities?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  painPointsInsights?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString({}, { message: 'lastConnect must be a valid ISO date string (YYYY-MM-DD)' })
  lastConnect?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsDateString({}, { message: 'nextConnect must be a valid ISO date string (YYYY-MM-DD)' })
  nextConnect?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['Scheduled', 'Cancelled', 'Rescheduled', 'Follow up required', 'Yet to Schedule'])
  nextConnectStatus?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actionFollowUps?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  country?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return isNaN(n) ? value : n;
  })
  @IsOptional()
  @IsNumber({}, { message: 'estimatedBudgetAvailable must be a number' })
  @Min(0, { message: 'estimatedBudgetAvailable cannot be negative' })
  estimatedBudgetAvailable?: number;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['Decision Maker', 'Sponsor', 'Influencer', 'User', 'Procurement', 'Gatekeeper', 'Other'])
  roleInDecision?: string;
}

export class UpdateStakeholderDto extends CreateStakeholderDto {
  @IsString() id!: string;
}
