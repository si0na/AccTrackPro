import { Module } from '@nestjs/common';
import { EmployeeAppreciationController } from './employee-appreciation.controller';
import { EmployeeAppreciationService } from './employee-appreciation.service';

@Module({
  controllers: [EmployeeAppreciationController],
  providers: [EmployeeAppreciationService],
  exports: [EmployeeAppreciationService],
})
export class EmployeeAppreciationModule {}
