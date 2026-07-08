import { IsString, IsOptional, IsIn, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @IsIn(['account', 'opportunity', 'actionItem', 'stakeholder', 'general']) type!: string;

  @IsString() @IsNotEmpty({ message: 'Activity text is required' }) @MaxLength(2000)
  text!: string;

  // Accepted for backward compatibility but ignored — the author is always
  // derived from the JWT in the controller.
  @IsString() @IsOptional() @MaxLength(100) user?: string;

  @IsString() @IsOptional() accountId?: string;
  @IsString() @IsOptional() opportunityId?: string;
}
