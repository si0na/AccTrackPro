import {
  IsInt,
  IsString,
  IsArray,
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