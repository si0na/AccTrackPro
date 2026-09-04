import { IsString, IsIn, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsIn(['account', 'opportunity', 'actionItem']) targetType!: string;

  @IsString() @IsNotEmpty({ message: 'targetId is required' })
  targetId!: string;

  // Accepted for backward compatibility but ignored — the author is always
  // derived from the JWT in the controller.
  @IsString() @IsOptional() @MaxLength(100) user?: string;

  @IsString() @IsNotEmpty({ message: 'Comment text is required' }) @MaxLength(5000)
  text!: string;
}

export class UpdateCommentDto {
  @IsString() @IsNotEmpty({ message: 'Comment text is required' }) @MaxLength(5000)
  text!: string;
}
