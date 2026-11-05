import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  ArrayMinSize,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';
import { normalizeDateToIso, normalizeTimeToStandard } from '../date-time.util';

export const CONNECT_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'] as const;
export type ConnectStatus = (typeof CONNECT_STATUSES)[number];

// Matches 24-hour time HH:MM or HH:MM:SS (e.g. "09:30", "14:45:00")
export const TIME_FORMAT_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateStakeholderConnectDto {
  @IsString()
  @IsNotEmpty({ message: 'Account is required' })
  accountId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Meeting title is required' })
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Meeting host/owner is required' })
  ownerId!: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? normalizeDateToIso(value) : value))
  @IsNotEmpty({ message: 'Meeting date is required' })
  @Matches(ISO_DATE_RE, { message: `meetingDate ${ISO_DATE_MSG}` })
  meetingDate!: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? normalizeTimeToStandard(value) : value))
  @IsString()
  @IsNotEmpty({ message: 'Meeting time is required' })
  @Matches(TIME_FORMAT_RE, { message: 'meetingTime must be in HH:MM or HH:MM:SS format' })
  meetingTime!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(CONNECT_STATUSES)
  status?: ConnectStatus;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  momNotes?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  mom?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one stakeholder attendee is required' })
  @IsString({ each: true })
  attendees!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceProviderUserIds?: string[];
}

