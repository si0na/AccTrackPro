import { IsNotEmpty, IsOptional, IsString, IsIn, Matches } from 'class-validator';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateEmployeeAppreciationDto {
  @IsNotEmpty({ message: 'Received date is required' })
  @Matches(ISO_DATE_RE, { message: 'receivedDate must be in YYYY-MM-DD format' })
  receivedDate!: string;

  @IsNotEmpty({ message: 'Account ID is required' })
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  empId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsNotEmpty({ message: 'Employee name is required' })
  @IsString()
  employeeName!: string;

  @IsOptional()
  @IsString()
  respondentId?: string;

  @IsNotEmpty({ message: 'Respondent name is required' })
  @IsString()
  respondentName!: string;

  @IsNotEmpty({ message: 'Internal/External indicator is required' })
  @IsIn(['Internal', 'External'], { message: 'internalExternal must be either Internal or External' })
  internalExternal!: 'Internal' | 'External';

  @IsNotEmpty({ message: 'Feedback is required' })
  @IsString()
  feedback!: string;
}

export class UpdateEmployeeAppreciationDto {
  @IsOptional()
  @Matches(ISO_DATE_RE, { message: 'receivedDate must be in YYYY-MM-DD format' })
  receivedDate?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  empId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  employeeName?: string;

  @IsOptional()
  @IsString()
  respondentId?: string;

  @IsOptional()
  @IsString()
  respondentName?: string;

  @IsOptional()
  @IsIn(['Internal', 'External'], { message: 'internalExternal must be either Internal or External' })
  internalExternal?: 'Internal' | 'External';

  @IsOptional()
  @IsString()
  feedback?: string;
}
