import {
  IsString, IsNotEmpty, IsOptional, IsIn, Matches, ValidateIf,
} from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';
import {
  REWARDS_RECOGNITION_TYPES,
  REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS,
  REWARDS_RECOGNITION_STATUSES,
} from '../rewards-recognition-categories.constant';

export class CreateEmployeeRewardsRecognitionDto {
  @IsString()
  @IsNotEmpty({ message: 'Month of the R&R is required' })
  monthOfRr!: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  nominatedById?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nominated By is required' })
  nominatedByName!: string;

  @IsIn(REWARDS_RECOGNITION_TYPES as unknown as string[], {
    message: 'Type must be one of: Continous, Quarterly, Annual',
  })
  type!: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category!: string;

  @IsIn(REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS as unknown as string[], {
    message: 'Team/Individual must be either Individual or Team',
  })
  teamOrIndividual!: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  employeeName?: string;

  @IsIn(REWARDS_RECOGNITION_STATUSES as unknown as string[], {
    message: 'Status must be one of: Nominated - Not Won, Won, Nomination Rejected',
  })
  status!: string;

  @IsString()
  @IsNotEmpty({ message: 'Details are required' })
  details!: string;
}

export class UpdateEmployeeRewardsRecognitionDto {
  @IsString()
  @IsOptional()
  monthOfRr?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  nominatedById?: string;

  @IsString()
  @IsOptional()
  nominatedByName?: string;

  @IsOptional()
  @IsIn(REWARDS_RECOGNITION_TYPES as unknown as string[])
  type?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsOptional()
  @IsIn(REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS as unknown as string[])
  teamOrIndividual?: string;

  @EmptyToUndefined()
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  employeeName?: string;

  @IsOptional()
  @IsIn(REWARDS_RECOGNITION_STATUSES as unknown as string[])
  status?: string;

  @IsString()
  @IsOptional()
  details?: string;
}
