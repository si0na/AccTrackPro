import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmptyToUndefined, ISO_DATE_RE, ISO_DATE_MSG } from '../../../common/utils/dto-transforms.util';

export const DRAFT_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type DraftPriority = (typeof DRAFT_PRIORITIES)[number];

/** Normalizes cleared update strings ('') to null so optional fields can be unset explicitly. */
function EmptyToNull(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );
}

export class CreateDraftFollowUpDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255)
  title!: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  description?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  suggestedOwnerId?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(ISO_DATE_RE, { message: `suggestedDueDate ${ISO_DATE_MSG}` })
  suggestedDueDate?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsIn(DRAFT_PRIORITIES)
  suggestedPriority?: DraftPriority;
}

export class UpdateDraftFollowUpDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Title cannot be empty' })
  @MaxLength(255)
  title?: string;

  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  description?: string | null;

  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  suggestedOwnerId?: string | null;

  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Matches(ISO_DATE_RE, { message: `suggestedDueDate ${ISO_DATE_MSG}` })
  suggestedDueDate?: string | null;

  @EmptyToNull()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsIn(DRAFT_PRIORITIES)
  suggestedPriority?: DraftPriority | null;
}
