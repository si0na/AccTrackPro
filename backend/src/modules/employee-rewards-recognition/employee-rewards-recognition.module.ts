import { Module } from '@nestjs/common';
import { EmployeeRewardsRecognitionController } from './employee-rewards-recognition.controller';
import { EmployeeRewardsRecognitionService } from './employee-rewards-recognition.service';

@Module({
  controllers: [EmployeeRewardsRecognitionController],
  providers: [EmployeeRewardsRecognitionService],
  exports: [EmployeeRewardsRecognitionService],
})
export class EmployeeRewardsRecognitionModule {}
