import {
  IsString, IsOptional, IsIn, IsNotEmpty, MaxLength, Matches,
} from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

const ACTION_ITEM_TYPES = [
  'Account mining',
  'Approval',
  'Board Meeting',
  'CEO Connect',
  'Communication',
  'Customer Request',
  'Decision',
  'Dependency',
  'Documentation',
  'Escalation',
  'Follow-up',
  'Issue Resolution',
  'Meeting Action',
  'Opportunity / Growth',
  'Other',
  'Proposals',
  'Review',
  'Risk Mitigation',
  'Stakeholder connect',
  'Task',
];

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

  @EmptyToUndefined()
  @IsString() @IsOptional()
  ownerStakeholderId?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `openDate ${ISO_DATE_MSG}` })
  openDate?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `dueDate ${ISO_DATE_MSG}` })
  dueDate?: string;

  @IsIn(['High', 'Medium', 'Low']) priority!: string;
  @IsIn(['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled']) status!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(ACTION_ITEM_TYPES)
  actionItemType?: string;

  @IsString() @IsOptional() @MaxLength(5000) notes?: string;
  @IsString() @IsOptional() @MaxLength(5000) risksAndDependencies?: string;
  @IsString() @IsOptional() @MaxLength(5000) nextAction?: string;
  @IsString() @IsOptional() @MaxLength(5000) impediments?: string;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `completedDate ${ISO_DATE_MSG}` })
  completedDate?: string;
}

export class UpdateActionItemDto {
  @IsString() id!: string;

  @EmptyToUndefined() @IsString() @IsOptional() @MaxLength(50) actionItemNumber?: string;
  @IsString() @IsOptional() @MaxLength(200) title?: string;
  @IsString() @IsOptional() accountId?: string;
  @EmptyToUndefined() @IsString() @IsOptional() opportunityId?: string;
  @EmptyToUndefined() @IsString() @IsOptional() projectId?: string;
  @EmptyToUndefined() @IsString() @IsOptional() ownerStakeholderId?: string;
  @EmptyToUndefined() @IsOptional() @Matches(ISO_DATE_RE, { message: `openDate ${ISO_DATE_MSG}` }) openDate?: string;
  @EmptyToUndefined() @IsOptional() @Matches(ISO_DATE_RE, { message: `dueDate ${ISO_DATE_MSG}` }) dueDate?: string;
  @IsOptional() @IsIn(['High', 'Medium', 'Low']) priority?: string;
  @IsOptional() @IsIn(['To Do', 'In Progress', 'Blocked', 'Completed', 'Cancelled']) status?: string;
  @EmptyToUndefined() @IsOptional() @IsIn(ACTION_ITEM_TYPES) actionItemType?: string;
  @IsString() @IsOptional() @MaxLength(5000) notes?: string;
  @IsString() @IsOptional() @MaxLength(5000) risksAndDependencies?: string;
  @IsString() @IsOptional() @MaxLength(5000) nextAction?: string;
  @IsString() @IsOptional() @MaxLength(5000) impediments?: string;
  @EmptyToUndefined() @IsOptional() @Matches(ISO_DATE_RE, { message: `completedDate ${ISO_DATE_MSG}` }) completedDate?: string;
}
