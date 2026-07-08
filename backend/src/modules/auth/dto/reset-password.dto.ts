import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(64, { message: 'Invalid reset token' })
  @MaxLength(64, { message: 'Invalid reset token' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  newPassword!: string;
}
