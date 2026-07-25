import {
  IsString, IsOptional, IsIn, IsNotEmpty, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateProjectIssueDto {
  @IsIn(['High', 'Medium', 'Low'], { message: 'Priority must be High, Medium, or Low' })
  priority!: string;

  @IsString() @IsNotEmpty({ message: 'Description is required' }) @MaxLength(5000)
  description!: string;

  @IsString() @IsOptional() @MaxLength(2000)
  impact?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  ownerId?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `dateIdentified ${ISO_DATE_MSG}` })
  dateIdentified?: string;

  @IsOptional() @IsIn(['Open', 'In Progress', 'Resolved', 'Closed'], {
    message: 'Status must be one of: Open, In Progress, Resolved, Closed',
  })
  status?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  resolutionPlan?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `targetResolutionDate ${ISO_DATE_MSG}` })
  targetResolutionDate?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  remarks?: string;
}

export class UpdateProjectIssueDto extends CreateProjectIssueDto {
  @IsString() id!: string;
}
