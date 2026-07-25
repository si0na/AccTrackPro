import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min, Max } from 'class-validator';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

/**
 * Upsert payload for a single opportunity's forecast + actuals. Every field is
 * optional — the page saves the whole card at once, and a user may fill in only
 * the forecast, only the actuals, or both. Forecast/actual date and value edits
 * are the source of the forecast-revision history recorded server-side.
 */
export class UpsertOpportunityForecastDto {
  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `forecastDate ${ISO_DATE_MSG}` })
  forecastDate?: string;

  @IsNumber() @IsOptional()
  @Min(0, { message: 'Forecast value cannot be negative' })
  @Max(9999999999999, { message: 'Forecast value exceeds the maximum supported deal size' })
  forecastValue?: number;

  @EmptyToUndefined()
  @IsOptional() @Matches(ISO_DATE_RE, { message: `actualDate ${ISO_DATE_MSG}` })
  actualDate?: string;

  @IsNumber() @IsOptional()
  @Min(0, { message: 'Actual revenue cannot be negative' })
  @Max(9999999999999, { message: 'Actual revenue exceeds the maximum supported amount' })
  actualValue?: number;

  @IsString() @IsOptional() @MaxLength(2000)
  remarks?: string;
}
