import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';
import {
  SQA_BILLING_MODEL_OPTIONS,
  SQA_DELIVERY_MODEL_OPTIONS,
  SQA_HEALTH_OPTIONS,
  SQA_IMPORTANCE_OPTIONS,
  SQA_RESOURCING_STATUS_OPTIONS,
  SQA_SDLC_PHASE_OPTIONS,
  SQA_TOWER_OPTIONS,
} from '../../../common/utils/sqa-options.util';

/**
 * One weekly RAG value submitted with an SQA record — "Health Week 31" and its
 * siblings. The week is identified by its ISO year + number rather than a
 * hardcoded field name, so the grid extends to any week without a schema or
 * DTO change. Applied against the existing project health trail (see
 * ProjectHealthService.setWeekHealth), never stored on the SQA record.
 */
export class SqaWeekHealthDto {
  @IsInt() @Min(1970) @Max(2999)
  isoYear!: number;

  @IsInt() @Min(1) @Max(53)
  weekNumber!: number;

  @IsIn(SQA_HEALTH_OPTIONS as unknown as string[], {
    message: `Weekly health must be one of: ${SQA_HEALTH_OPTIONS.join(', ')}`,
  })
  health!: string;
}

export class CreateSqaRecordDto {
  @IsString() @IsNotEmpty({ message: 'Project is required' })
  projectId!: string;

  @IsOptional() @IsIn(SQA_IMPORTANCE_OPTIONS as unknown as string[], {
    message: `Importance must be one of: ${SQA_IMPORTANCE_OPTIONS.join(', ')}`,
  })
  importance?: string;

  // ── Delivery attributes ───────────────────────────────────────────────────
  // deliveryModel is SQA's own (no source exists elsewhere); the three
  // *Override fields are only sent when SQA disagrees with the inherited
  // Project/Opportunity value — an empty value means "inherit".
  @EmptyToUndefined()
  @IsOptional() @IsIn(SQA_DELIVERY_MODEL_OPTIONS as unknown as string[], {
    message: `Delivery Model must be one of: ${SQA_DELIVERY_MODEL_OPTIONS.join(', ')}`,
  })
  deliveryModel?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(SQA_BILLING_MODEL_OPTIONS as unknown as string[], {
    message: `Billing Model must be one of: ${SQA_BILLING_MODEL_OPTIONS.join(', ')}`,
  })
  billingModelOverride?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(SQA_TOWER_OPTIONS as unknown as string[], {
    message: 'Tower must be one of the configured Service Line values',
  })
  towerOverride?: string;

  @IsNumber() @IsOptional() @Min(0, { message: 'FTE cannot be negative' })
  fteOverride?: number;

  @IsNumber() @IsOptional() @Min(0, { message: 'Revenue cannot be negative' })
  revenueOverride?: number;

  // ── SQA-specific weekly tracking ──────────────────────────────────────────
  @IsBoolean() @IsOptional()
  wsrPublished?: boolean;

  @IsBoolean() @IsOptional()
  clientEscalation?: boolean;

  @IsString() @IsOptional() @MaxLength(5000)
  currentWeekUpdate?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  nextWeekPlan?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  issuesChallenges?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  pathToGreen?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(SQA_RESOURCING_STATUS_OPTIONS as unknown as string[], {
    message: `Resourcing Status must be one of: ${SQA_RESOURCING_STATUS_OPTIONS.join(', ')}`,
  })
  resourcingStatus?: string;

  @EmptyToUndefined()
  @IsOptional() @IsIn(SQA_SDLC_PHASE_OPTIONS as unknown as string[], {
    message: `Current SDLC Phase must be one of: ${SQA_SDLC_PHASE_OPTIONS.join(', ')}`,
  })
  currentSdlcPhase?: string;

  @IsString() @IsOptional() @MaxLength(5000)
  sqaRemarks?: string;

  /** Weekly RAG values changed on the form; each is written to the project health trail. */
  @IsArray() @IsOptional()
  @ValidateNested({ each: true }) @Type(() => SqaWeekHealthDto)
  weeklyHealth?: SqaWeekHealthDto[];
}

/**
 * PUT replaces the record's own fields. `projectId` stays required and is
 * validated against the existing row: re-pointing an SQA record at a different
 * project would silently rewrite which account/PM/revenue it reports on, so the
 * service rejects a change rather than accepting it.
 */
export class UpdateSqaRecordDto extends CreateSqaRecordDto {
  @IsString() @IsOptional()
  id?: string;
}

/** Body of the standalone "set one week's health" endpoint. */
export class SetSqaWeekHealthDto extends SqaWeekHealthDto {}
