import {
  IsArray, IsBoolean, IsOptional, IsString, IsNotEmpty, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MatrixChangeDto {
  @IsString() @IsNotEmpty() roleId!: string;
  @IsString() @IsNotEmpty() moduleKey!: string;
  @IsString() @IsNotEmpty() permissionKey!: string;
  @IsBoolean() isAllowed!: boolean;
}

export class UpdateMatrixDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => MatrixChangeDto)
  changes!: MatrixChangeDto[];
}

export class CreateRoleDto {
  @IsString() @IsNotEmpty({ message: 'Role name is required' }) @MaxLength(80)
  name!: string;

  @IsString() @IsOptional() @MaxLength(500)
  description?: string;
}

export class UpdateRoleDto {
  @IsString() @IsOptional() @MaxLength(80) name?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
}
