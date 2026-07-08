import { Module } from '@nestjs/common';
import { FinancialYearsController } from './financial-years.controller';
import { FinancialYearsService } from './financial-years.service';

@Module({ controllers: [FinancialYearsController], providers: [FinancialYearsService] })
export class FinancialYearsModule {}
