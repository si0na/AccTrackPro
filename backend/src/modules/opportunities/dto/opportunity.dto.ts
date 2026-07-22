import {
  IsString, IsNumber, IsOptional, IsArray, IsIn, IsBoolean, ValidateIf,
  IsNotEmpty, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG, AOP_YEAR_RE, AOP_YEAR_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateOpportunityDto {
  @IsString() @IsNotEmpty({ message: 'Opportunity name is required' }) @MaxLength(200)
  name!: string;

  @IsString() @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @IsOptional() @IsIn(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won', 'Blocked', 'Delayed', 'Lost'])
  stage?: string;

  @IsNumber() @IsOptional() @Min(0, { message: 'Value cannot be negative' })
  @Max(9999999999999, { message: 'Value exceeds the maximum supported deal size' })
  value?: number;

  @IsNumber() @IsOptional() @Min(0) @Max(100)
  probability?: number;

  @IsString() @IsOptional() @MaxLength(1000)
  closeReason?: string;

  @IsString() @IsOptional() @MaxLength(1000)
  blockedReason?: string;

  @IsString() @IsOptional() @MaxLength(1000)
  delayedReason?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `closeDate ${ISO_DATE_MSG}` })
  closeDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `allocationStartDate ${ISO_DATE_MSG}` })
  allocationStartDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `allocationEndDate ${ISO_DATE_MSG}` })
  allocationEndDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `dealStartDate ${ISO_DATE_MSG}` })
  dealStartDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `dealCloseDate ${ISO_DATE_MSG}` })
  dealCloseDate?: string;

  @IsNumber() @IsOptional() @Min(0, { message: 'CRM value cannot be negative' })
  crmValue?: number;

  @IsString() @IsOptional() @MaxLength(5000) description?: string;
  @IsString() @IsOptional() @MaxLength(1000) nextStep?: string;
  @IsString() @IsOptional() @MaxLength(5000) risksAndDependencies?: string;

  @IsArray() @IsOptional() @IsString({ each: true }) @MaxLength(100, { each: true })
  tags?: string[];

  @IsArray() @IsOptional() @IsString({ each: true }) @MaxLength(100, { each: true })
  team?: string[];

  @EmptyToUndefined()
  @IsOptional() @IsString()
  clientStakeholderId?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  serviceProviderStakeholderId?: string;

  @IsBoolean() @IsOptional()
  aopAvailable?: boolean;

  @ValidateIf((o) => o.aopAvailable === true)
  @IsNotEmpty({ message: 'AOP Year is required when AOP Available is Yes' })
  @Matches(AOP_YEAR_RE, { message: AOP_YEAR_MSG })
  aopYear?: string;

  @IsOptional() @IsIn(['Growth', 'Pursuit', 'Whitespace', 'New', 'Extension'], {
    message: 'Opportunity Type must be one of: Growth, Pursuit, Whitespace, New, or Extension',
  })
  opportunityType?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(
    ['Data', 'AI', 'Cloud', 'Application Development', 'Application Support', 'Infrastructure', 'Cyber Security', 'SharePoint'],
    { message: 'Service Line must be one of the allowed values' },
  )
  serviceLine?: string;
}

export class UpdateOpportunityDto extends CreateOpportunityDto {
  @IsString() id!: string;
}
