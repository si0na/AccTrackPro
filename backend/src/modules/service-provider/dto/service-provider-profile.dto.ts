import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PHONE_ERROR, PHONE_REGEX } from '../../../common/utils/phone.util';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

/**
 * Service Provider profile update.
 *
 * `phone` is always required and lives only on the stakeholder records. The
 * identity fields (name / department / designation / email) normally come from
 * the user record and are omitted; they are only sent when they were missing on
 * the user and the completion modal collected them, in which case they are
 * written back to the users table. Optional fields use EmptyToUndefined so an
 * untouched '' input short-circuits @IsNotEmpty/@IsEmail instead of failing.
 */
export class UpdateServiceProviderProfileDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(PHONE_REGEX, { message: PHONE_ERROR })
  phone!: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @IsNotEmpty({ message: 'Department is required' })
  @MaxLength(150)
  department?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @IsNotEmpty({ message: 'Designation is required' })
  @MaxLength(150)
  designation?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email?: string;
}
