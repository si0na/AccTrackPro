import { Module } from '@nestjs/common';
import { PerformanceEvaluationsController } from './performance-evaluations.controller';
import { PerformanceEvaluationsService } from './performance-evaluations.service';
import { EmployeeMasterModule } from '../employee-master/employee-master.module';

@Module({
  imports: [EmployeeMasterModule],
  controllers: [PerformanceEvaluationsController],
  providers: [PerformanceEvaluationsService],
})
export class PerformanceEvaluationsModule {}
