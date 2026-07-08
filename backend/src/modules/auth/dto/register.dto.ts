import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100)
  @Transform(({ value }) => (value as string).trim())
  name!: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(200)
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be no more than 128 characters' })
  @Matches(/\d/, { message: 'Password must contain at least one number' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2097152, { message: 'Avatar image is too large' })
  avatarData?: string;
}
