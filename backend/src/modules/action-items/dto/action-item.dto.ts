import {
  IsString, IsOptional, IsIn, IsNotEmpty, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class CreateActionItemDto {
  @IsString() @IsNotEmpty({ message: 'Title is required' }) @MaxLength(200)
  title!: string;

  @IsString() @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @EmptyToUndefined()
  @IsString() @IsOptional()
  opportunityId?: string;

  @EmptyToUndefined()
  @IsString() @IsOptional()
  projectId?: string;

  @IsString() @IsNotEmpty({ message: 'Owner is required' })
  ownerStakeholderId!: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `openDate ${ISO_DATE_MSG}` })
  openDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `dueDate ${ISO_DATE_MSG}` })
  dueDate?: string;

  @IsIn(['High', 'Medium', 'Low']) priority!: string;
  @IsIn(['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled']) status!: string;

  @IsString() @IsOptional() @MaxLength(5000) notes?: string;
  @IsString() @IsOptional() @MaxLength(5000) risksAndDependencies?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `completedDate ${ISO_DATE_MSG}` })
  completedDate?: string;
}

export class UpdateActionItemDto extends CreateActionItemDto {
  @IsString() id!: string;
}
