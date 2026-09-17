import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

export class CreateAccountRiskDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['Risk', 'Dependency', 'Issue'])
  riskType?: 'Risk' | 'Dependency' | 'Issue';

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['High', 'Medium', 'Low'])
  priority!: 'High' | 'Medium' | 'Low';

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['Red', 'Amber', 'Green'])
  rag?: 'Red' | 'Amber' | 'Green';

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  impact?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  likelihood?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  ownerId?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  mitigationPlan?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  impactDescription?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  contingencyPlan?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  riskOpenDate?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  classification?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['Open', 'Mitigated', 'Closed', 'Accepted', 'In Progress', 'Resolved'])
  status?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  targetResolutionDate?: string;
}

export class UpdateAccountRiskDto {
  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['Risk', 'Dependency', 'Issue'])
  riskType?: 'Risk' | 'Dependency' | 'Issue';

  @IsString()
  @IsOptional()
  description?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['High', 'Medium', 'Low'])
  priority?: 'High' | 'Medium' | 'Low';

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['Red', 'Amber', 'Green'])
  rag?: 'Red' | 'Amber' | 'Green';

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  impact?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  likelihood?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  ownerId?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  mitigationPlan?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  impactDescription?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  contingencyPlan?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  riskOpenDate?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  classification?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @IsEnum(['Open', 'Mitigated', 'Closed', 'Accepted', 'In Progress', 'Resolved'])
  status?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  targetResolutionDate?: string;
}
