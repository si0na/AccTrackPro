import {
  IsString, IsOptional, IsIn, IsEmail, IsNotEmpty, MaxLength,
} from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

export class CreateStakeholderDto {
  @IsString() @IsNotEmpty({ message: 'Stakeholder name is required' }) @MaxLength(200)
  name!: string;

  @IsString() @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @IsString() @IsOptional() @MaxLength(200) designation?: string;

  @IsIn(['High', 'Medium', 'Low']) influence!: string;
  @IsIn(['Strong', 'Neutral', 'Weak']) relationship!: string;
  @IsIn(['CLIENT', 'SERVICE_PROVIDER']) stakeholderType!: string;

  @EmptyToUndefined()
  @IsOptional() @IsEmail({}, { message: 'email must be a valid email address' }) @MaxLength(200)
  email?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(50)
  phone?: string;

  @EmptyToUndefined()
  @IsOptional() @IsString() @MaxLength(150)
  department?: string;
}

export class UpdateStakeholderDto extends CreateStakeholderDto {
  @IsString() id!: string;
}
