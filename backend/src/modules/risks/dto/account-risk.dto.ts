import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAccountRiskDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

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

  @IsString()
  @IsOptional()
  @IsEnum(['Red', 'Amber', 'Green'])
  rag?: 'Red' | 'Amber' | 'Green';

  @IsString()
  @IsOptional()
  impact?: string;

  @IsString()
  @IsOptional()
  likelihood?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  mitigationPlan?: string;

  @IsString()
  @IsOptional()
  impactDescription?: string;

  @IsString()
  @IsOptional()
  contingencyPlan?: string;

  @IsString()
  @IsOptional()
  riskOpenDate?: string;

  @IsString()
  @IsOptional()
  classification?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['Open', 'Mitigated', 'Closed', 'Accepted', 'In Progress', 'Resolved'])
  status?: string;

  @IsString()
  @IsOptional()
  targetResolutionDate?: string;
}

export class UpdateAccountRiskDto {
  @IsString()
  @IsOptional()
  @IsEnum(['Risk', 'Dependency', 'Issue'])
  riskType?: 'Risk' | 'Dependency' | 'Issue';

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['High', 'Medium', 'Low'])
  priority?: 'High' | 'Medium' | 'Low';

  @IsString()
  @IsOptional()
  @IsEnum(['Red', 'Amber', 'Green'])
  rag?: 'Red' | 'Amber' | 'Green';

  @IsString()
  @IsOptional()
  impact?: string;

  @IsString()
  @IsOptional()
  likelihood?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  mitigationPlan?: string;

  @IsString()
  @IsOptional()
  impactDescription?: string;

  @IsString()
  @IsOptional()
  contingencyPlan?: string;

  @IsString()
  @IsOptional()
  riskOpenDate?: string;

  @IsString()
  @IsOptional()
  classification?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['Open', 'Mitigated', 'Closed', 'Accepted', 'In Progress', 'Resolved'])
  status?: string;

  @IsString()
  @IsOptional()
  targetResolutionDate?: string;
}
