import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateProjectDocumentationUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'Document name is required' })
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Document URL is required' })
  @MaxLength(2000)
  @Matches(/^https?:\/\/.+/i, { message: 'URL must start with http:// or https://' })
  url!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;
}

export class CreateProjectDocumentationFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Document name is required' })
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;
}

export class UpdateProjectDocumentationDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  url?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;
}
