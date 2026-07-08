import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(200)
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email!: string;
}
