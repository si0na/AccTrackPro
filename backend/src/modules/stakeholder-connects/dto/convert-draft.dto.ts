import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';
import { DB_SUPPORTED_ACTION_ITEM_TYPES } from '../../action-items/dto/action-item.dto';

export class ConvertDraftToActionItemDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Title cannot be empty' })
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
  @IsIn(DB_SUPPORTED_ACTION_ITEM_TYPES)
  actionItemType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
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
