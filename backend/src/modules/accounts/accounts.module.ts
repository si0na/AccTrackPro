import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountWeeklyHealthController } from './account-weekly-health.controller';
import { AccountWeeklyHealthService } from './account-weekly-health.service';
import { ServiceProviderModule } from '../service-provider/service-provider.module';

@Module({
  imports: [ServiceProviderModule],
  controllers: [AccountsController, AccountWeeklyHealthController],
  providers: [AccountsService, AccountWeeklyHealthService],
  exports: [AccountsService, AccountWeeklyHealthService],
})
export class AccountsModule {}
