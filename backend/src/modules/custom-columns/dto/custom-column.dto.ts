import { IsString, IsIn, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCustomColumnDto {
  @IsIn(['accounts', 'opportunities', 'actionItems', 'performanceEvaluation']) module!: string;

  @IsString() @IsNotEmpty({ message: 'Column name is required' }) @MaxLength(100)
  name!: string;

  @IsIn(['text', 'number', 'date', 'boolean']) type!: string;
}
