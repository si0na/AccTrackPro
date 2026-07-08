import { Module } from '@nestjs/common';
import { EmployeeMasterController } from './employee-master.controller';
import { EmployeeMasterService } from './employee-master.service';

@Module({
  controllers: [EmployeeMasterController],
  providers:   [EmployeeMasterService],
  exports:     [EmployeeMasterService],
})
export class EmployeeMasterModule {}
