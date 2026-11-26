import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';
import type { AccountHealth } from '../../../types';

export class CreateAccountWeeklyHealthDto {
  @IsString()
  @IsNotEmpty({ message: 'Reporting date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Reporting date must be in YYYY-MM-DD format' })
  reportingDate!: string;

  @IsNotEmpty({ message: 'Health status is required' })
  @IsIn(['Green', 'Amber', 'Red'], { message: 'Health status must be Green, Amber, or Red' })
  healthStatus!: AccountHealth;

  @IsString()
  @IsNotEmpty({ message: 'Health summary is required' })
  @MaxLength(4000, { message: 'Health summary cannot exceed 4000 characters' })
  summary!: string;

  @IsString()
  @IsOptional()
  @MaxLength(8000, { message: 'Key updates cannot exceed 8000 characters' })
  keyUpdates?: string;

  @IsString()
  @IsOptional()
  @MaxLength(8000, { message: 'Risks / issues cannot exceed 8000 characters' })
  risksAndIssues?: string;

  @IsString()
  @IsOptional()
  @MaxLength(8000, { message: 'Action items / mitigation cannot exceed 8000 characters' })
  actionItemsMitigation?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  owner?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(8000, { message: 'Next steps cannot exceed 8000 characters' })
  nextSteps?: string;
}

export class UpdateAccountWeeklyHealthDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Reporting date must be in YYYY-MM-DD format' })
  reportingDate?: string;

  @IsOptional()
  @IsIn(['Green', 'Amber', 'Red'], { message: 'Health status must be Green, Amber, or Red' })
  healthStatus?: AccountHealth;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Health summary cannot be blank' })
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  keyUpdates?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  risksAndIssues?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  actionItemsMitigation?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  owner?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  nextSteps?: string;
}
