import {
  IsString, IsNumber, IsOptional, IsArray, IsIn,
  IsNotEmpty, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateOpportunityDto {
  @IsString() @IsNotEmpty({ message: 'Opportunity name is required' }) @MaxLength(200)
  name!: string;

  @IsString() @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @IsIn(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won']) stage!: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['Open', 'Won', 'Lost'])
  status?: string;

  @IsNumber() @Min(0, { message: 'Value cannot be negative' })
  @Max(9999999999999, { message: 'Value exceeds the maximum supported deal size' })
  value!: number;

  @IsNumber() @Min(0) @Max(100)
  probability!: number;

  @IsString() @IsOptional() @MaxLength(1000)
  closeReason?: string;

  @IsString() @MaxLength(100) owner!: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `closeDate ${ISO_DATE_MSG}` })
  closeDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `startDate ${ISO_DATE_MSG}` })
  startDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `endDate ${ISO_DATE_MSG}` })
  endDate?: string;

  @IsNumber() @IsOptional() @Min(0, { message: 'CRM value cannot be negative' })
  crmValue?: number;

  @IsString() @IsOptional() @MaxLength(5000) description?: string;
  @IsString() @IsOptional() @MaxLength(1000) nextStep?: string;

  @IsArray() @IsOptional() @IsString({ each: true }) @MaxLength(100, { each: true })
  tags?: string[];

  @IsArray() @IsOptional() @IsString({ each: true }) @MaxLength(100, { each: true })
  team?: string[];
}

export class UpdateOpportunityDto extends CreateOpportunityDto {
  @IsString() id!: string;
}
