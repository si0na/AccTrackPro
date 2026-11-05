import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';
import { TIME_FORMAT_RE } from './create-stakeholder-connect.dto';
import { normalizeDateToIso, normalizeTimeToStandard } from '../date-time.util';

export class RescheduleConnectDto {
  @Transform(({ value, obj }) => {
    const raw = value || obj?.meetingDate;
    return typeof raw === 'string' ? normalizeDateToIso(raw) : raw;
  })
  @IsNotEmpty({ message: 'New meeting date is required' })
  @Matches(ISO_DATE_RE, { message: `newDate ${ISO_DATE_MSG}` })
  newDate!: string;

  @Transform(({ value, obj }) => {
    const raw = value || obj?.meetingTime;
    return typeof raw === 'string' ? normalizeTimeToStandard(raw) : raw;
  })
  @IsString()
  @IsNotEmpty({ message: 'New meeting time is required' })
  @Matches(TIME_FORMAT_RE, { message: 'newTime must be in HH:MM or HH:MM:SS format' })
  newTime!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  reason?: string;
}

