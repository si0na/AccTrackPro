import {
  IsString, IsNumber, IsOptional, IsIn, IsNotEmpty, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateProjectDto {
  @IsString() @IsNotEmpty({ message: 'Project name is required' }) @MaxLength(200)
  name!: string;

  @IsString() @IsOptional() @MaxLength(5000)
  description?: string;

  @IsString() @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @IsString() @IsNotEmpty({ message: 'opportunityId is required' })
  opportunityId!: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `startDate ${ISO_DATE_MSG}` })
  startDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `endDate ${ISO_DATE_MSG}` })
  endDate?: string;

  @IsOptional() @IsIn(['Agile', 'Waterfall'], { message: 'Methodology must be Agile or Waterfall' })
  methodology?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  serviceProviderPmId?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  practiceLeadId?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  clientPartnerId?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  clientPmName?: string;

  @IsOptional() @IsIn(['Active', 'On Hold', 'Completed', 'Cancelled'], {
    message: 'Status must be one of: Active, On Hold, Completed, Cancelled',
  })
  status?: string;

  @IsOptional() @IsIn(['Green', 'Amber', 'Red'], { message: 'Health must be Green, Amber, or Red' })
  health?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `asOnDate ${ISO_DATE_MSG}` })
  asOnDate?: string;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  plannedCompletionPct?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  actualCompletionPct?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Planned Effort Hours cannot be negative' })
  plannedEffortHours?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Actual Effort Hours cannot be negative' })
  actualEffortHours?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Planned Cost cannot be negative' })
  plannedCost?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Actual Cost cannot be negative' })
  actualCost?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Deal Value cannot be negative' })
  dealValue?: number;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['High', 'Medium', 'Low'], { message: 'Priority must be High, Medium, or Low' })
  priority?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['Staff Aug', 'Fixed Bid', 'Managed', 'Fixed Capacity', 'Others'], { message: 'Delivery Model must be one of the allowed values' })
  deliveryModel?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['T&M', 'Milestone Based', 'Monthly Fixed', 'Others'], { message: 'Billing Model must be one of the allowed values' })
  billingModel?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['Tower 1', 'Tower 2'], { message: 'Tower must be one of: Tower 1, Tower 2' })
  tower?: string;
}

export class UpdateProjectDto extends CreateProjectDto {
  @IsString() id!: string;
}
