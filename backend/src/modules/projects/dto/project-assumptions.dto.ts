import {
  IsString, IsOptional, IsIn, IsNotEmpty, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateProjectAssumptionDto {
  @IsIn(['High', 'Medium', 'Low'], { message: 'Priority must be High, Medium, or Low' })
  priority!: string;

  @IsString() @IsNotEmpty({ message: 'Description is required' }) @MaxLength(5000)
  description!: string;

  @IsString() @IsOptional() @MaxLength(2000)
  impactIfFalse?: string;

  @IsOptional() @IsIn(['Unvalidated', 'Validated', 'Invalidated'], {
    message: 'Validation Status must be one of: Unvalidated, Validated, Invalidated',
  })
  validationStatus?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString()
  ownerId?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `dateIdentified ${ISO_DATE_MSG}` })
  dateIdentified?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `targetValidationDate ${ISO_DATE_MSG}` })
  targetValidationDate?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  remarks?: string;
}

export class UpdateProjectAssumptionDto extends CreateProjectAssumptionDto {
  @IsString() id!: string;
}
