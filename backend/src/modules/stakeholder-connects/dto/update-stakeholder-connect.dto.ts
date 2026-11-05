import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';
import { CONNECT_STATUSES, ConnectStatus, TIME_FORMAT_RE } from './create-stakeholder-connect.dto';
import { normalizeDateToIso, normalizeTimeToStandard } from '../date-time.util';

export class UpdateStakeholderConnectDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? normalizeDateToIso(value) : undefined))
  @EmptyToUndefined()
  @IsOptional()
  @Matches(ISO_DATE_RE, { message: `meetingDate ${ISO_DATE_MSG}` })
  meetingDate?: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? normalizeTimeToStandard(value) : undefined))
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Matches(TIME_FORMAT_RE, { message: 'meetingTime must be in HH:MM or HH:MM:SS format' })
  meetingTime?: string;

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

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  rescheduleReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendees?: string[];
}

