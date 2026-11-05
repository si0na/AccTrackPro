import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { EmptyToUndefined } from '../../../common/utils/dto-transforms.util';

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
}

export class UpdateDraftFollowUpDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  description?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  suggestedOwnerId?: string;
}
