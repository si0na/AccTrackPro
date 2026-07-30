import {
  IsInt,
  IsString,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FYQuarterDefDto {
  @IsString()
  label!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  startMonth!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  endMonth!: number;
}

export class UpdateFinancialCalendarDto {
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FYQuarterDefDto)
  quarters!: FYQuarterDefDto[];
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  fySelectorCount?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() roleId?: string;
  /**
   * The full set of roles to assign (multi-role). When present it is
   * authoritative and replaces the user's role set; the first entry becomes the
   * primary role. When omitted, a supplied single `roleId` is used instead.
   */
  @IsOptional() @IsArray() @IsString({ each: true }) roleIds?: string[];
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}