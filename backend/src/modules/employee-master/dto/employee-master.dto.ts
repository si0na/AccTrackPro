import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase().trim() : value);

export class CreateEmployeeMasterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(lower)
  email!: string;

  @IsOptional() @IsString() @MaxLength(200) @Transform(trim)
  name?: string;

  // Pre-assigned attributes copied onto the user record at registration.
  @IsOptional() @IsString() @MaxLength(64)  roleId?: string;
  @IsOptional() @IsString() @MaxLength(64) @Transform(trim) employeeId?: string;
  @IsOptional() @IsString() @MaxLength(120) @Transform(trim) department?: string;
  @IsOptional() @IsString() @MaxLength(120) @Transform(trim) designation?: string;
}

export class UpdateEmployeeMasterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(lower)
  email!: string;

  @IsOptional() @IsString() @MaxLength(200) @Transform(trim)
  name?: string;

  @IsOptional() @IsString() @MaxLength(64)  roleId?: string;
  @IsOptional() @IsString() @MaxLength(64) @Transform(trim) employeeId?: string;
  @IsOptional() @IsString() @MaxLength(120) @Transform(trim) department?: string;
  @IsOptional() @IsString() @MaxLength(120) @Transform(trim) designation?: string;
}
