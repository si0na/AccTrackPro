import { Module } from '@nestjs/common';
import { AccountGrowthController } from './account-growth.controller';
import { AccountGrowthService } from './account-growth.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AccountGrowthController],
  providers: [AccountGrowthService],
  exports: [AccountGrowthService],
})
export class AccountGrowthModule {}
