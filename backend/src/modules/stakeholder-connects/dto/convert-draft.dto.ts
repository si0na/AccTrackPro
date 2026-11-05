import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export class ConvertDraftToActionItemDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsNotEmpty({ message: 'Owner Stakeholder is required' })
  ownerStakeholderId!: string;

  @IsNotEmpty({ message: 'Due date is required' })
  @Matches(ISO_DATE_RE, { message: `dueDate ${ISO_DATE_MSG}` })
  dueDate!: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(ISO_DATE_RE, { message: `openDate ${ISO_DATE_MSG}` })
  openDate?: string;

  @IsIn(['High', 'Medium', 'Low'])
  priority!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled'])
  status?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  actionItemType?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  notes?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  opportunityId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  projectId?: string;
}
