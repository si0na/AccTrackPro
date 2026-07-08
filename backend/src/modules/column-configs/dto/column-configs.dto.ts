import {
  IsArray, IsOptional, IsString, IsBoolean, IsIn, IsNotEmpty, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ColumnConfigItemDto {
  @IsString() @IsNotEmpty() @MaxLength(100) key!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsBoolean() isStandard!: boolean;
  @IsBoolean() isPinned!: boolean;
  @IsBoolean() isDisplayed!: boolean;
  @IsIn(['text', 'number', 'date', 'boolean', 'custom']) type!: string;
}

export class SaveColumnConfigsDto {
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ColumnConfigItemDto)
  rawAccountsConfig?: ColumnConfigItemDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ColumnConfigItemDto)
  rawOpportunitiesConfig?: ColumnConfigItemDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ColumnConfigItemDto)
  rawActionItemsConfig?: ColumnConfigItemDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ColumnConfigItemDto)
  rawPerformanceEvaluationConfig?: ColumnConfigItemDto[];
}
