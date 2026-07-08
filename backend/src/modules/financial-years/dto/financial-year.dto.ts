import { IsInt, Min, Max } from 'class-validator';

export class CreateFinancialYearDto {
  @IsInt({ message: 'startYear must be an integer' })
  @Min(2000, { message: 'startYear must be 2000 or later' })
  @Max(2100, { message: 'startYear must be 2100 or earlier' })
  startYear!: number;
}
