import {
  IsString, IsOptional, IsIn, IsNotEmpty, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateProjectRiskDto {
  @IsIn(['High', 'Medium', 'Low'], { message: 'Priority must be High, Medium, or Low' })
  priority!: string;

  @IsString() @IsNotEmpty({ message: 'Description is required' }) @MaxLength(5000)
  description!: string;

  @IsString() @IsOptional() @MaxLength(2000)
  impact?: string;

  @IsString() @IsOptional() @MaxLength(500)
  likelihood?: string;

  @IsString() @IsOptional() @MaxLength(500)
  severity?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  ownerId?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  mitigationPlan?: string;

  @IsOptional() @IsIn(['Open', 'Mitigated', 'Closed', 'Accepted'], {
    message: 'Status must be one of: Open, Mitigated, Closed, Accepted',
  })
  status?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `targetResolutionDate ${ISO_DATE_MSG}` })
  targetResolutionDate?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['Red', 'Amber', 'Green'], { message: 'RAG must be Red, Amber, or Green' })
  rag?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  impactDescription?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(['Cost', 'Resource', 'Schedule', 'Operational', 'Technical', 'Environment', 'Quality', 'Scope', 'Others'], {
    message: 'Classification must be one of allowed values',
  })
  classification?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  contingencyPlan?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `riskOpenDate ${ISO_DATE_MSG}` })
  riskOpenDate?: string;
}

export class UpdateProjectRiskDto extends CreateProjectRiskDto {
  @IsString() id!: string;
}
