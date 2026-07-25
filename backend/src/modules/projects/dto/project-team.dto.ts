import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

export class CreateProjectTeamMemberDto {
  @IsString() @IsNotEmpty({ message: 'Role is required' }) @MaxLength(200)
  role!: string;

  @IsString() @IsNotEmpty({ message: 'Employee name is required' }) @MaxLength(200)
  employeeName!: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(100)
  seniorityLevel?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(200)
  location?: string;
}

export class UpdateProjectTeamMemberDto extends CreateProjectTeamMemberDto {}
