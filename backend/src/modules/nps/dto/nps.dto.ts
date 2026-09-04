import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateNpsDto {
  @IsString()
  @IsNotEmpty({ message: 'accountId is required' })
  accountId!: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  respondentId?: string;

  @IsString()
  @IsOptional()
  respondentName?: string;

  @IsString()
  @IsNotEmpty({ message: 'receivedMonthYear is required' })
  receivedMonthYear!: string;

  @IsInt({ message: 'npsScore must be an integer between 0 and 10' })
  @Min(0, { message: 'NPS Score cannot be less than 0' })
  @Max(10, { message: 'NPS Score cannot be greater than 10' })
  npsScore!: number;

  @IsString()
  @IsOptional()
  likedMost?: string;

  @IsString()
  @IsOptional()
  improvementSuggestions?: string;
}

export class UpdateNpsDto extends CreateNpsDto {
  @IsString()
  id!: string;
}
