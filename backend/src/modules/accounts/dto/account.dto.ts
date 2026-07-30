import {
  IsString, IsNumber, IsOptional, IsIn, IsEmail,
  IsNotEmpty, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

// Permissive on purpose: enough to reject clearly-wrong values without
// fighting legitimate regional formats already stored on existing accounts.
const WEBSITE_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;
const PHONE_RE = /^\+?[\d\s().\-\/]{5,}$/;

export class CreateAccountDto {
  @IsString() @IsNotEmpty({ message: 'Account name is required' }) @MaxLength(200)
  @Matches(/\S/, { message: 'Account name cannot be blank' })
  name!: string;

  @IsIn(['Strategic', 'Non Strategic', 'New']) type!: string;
  @IsIn(['Green', 'Amber', 'Red']) health!: string;

  // ownerId is optional in the DTO — the controller always overrides it from the JWT.
  // Keeping the field optional so existing API clients that still send it don't fail validation.
  @IsString() @IsOptional() ownerId?: string;

  // Role-ownership FKs (drive account visibility). Each references a users.id; a
  // blank string clears the assignment.
  @EmptyToUndefined() @IsString() @IsOptional() accountManagerId?: string;
  @EmptyToUndefined() @IsString() @IsOptional() practiceLeadId?: string;
  @EmptyToUndefined() @IsString() @IsOptional() clientPartnerId?: string;
  @EmptyToUndefined() @IsString() @IsOptional() verticalHeadId?: string;

  @IsNumber() @Min(0, { message: 'Revenue cannot be negative' })
  @Max(9999999999999, { message: 'Revenue exceeds the maximum supported amount' })
  revenue!: number;

  @IsString() @MaxLength(200) industry!: string;

  @IsString() @IsOptional() @MaxLength(50) since?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(500)
  @Matches(WEBSITE_RE, { message: 'website must be a valid URL (e.g. www.example.com)' })
  website?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(50)
  @Matches(PHONE_RE, { message: 'phone must be a valid phone number' })
  phone?: string;

  @EmptyToUndefined()
  @IsOptional() @IsEmail({}, { message: 'email must be a valid email address' }) @MaxLength(200)
  email?: string;

  @IsString() @IsOptional() @MaxLength(1000) address?: string;
  @IsString() @IsOptional() @MaxLength(1000) location?: string;
  @IsString() @IsOptional() @MaxLength(5000) description?: string;
}

export class UpdateAccountDto extends CreateAccountDto {
  @IsString() @IsOptional() id?: string;
}
