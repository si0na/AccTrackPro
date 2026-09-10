import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { RbacModule } from '../rbac/rbac.module';
import { AccountRisksService } from './account-risks.service';
import { AccountRisksController } from './account-risks.controller';
import { CentralRisksService } from './central-risks.service';
import { RisksController } from './risks.controller';

@Module({
  imports: [AuthModule, DatabaseModule, RbacModule],
  providers: [AccountRisksService, CentralRisksService],
  controllers: [AccountRisksController, RisksController],
  exports: [AccountRisksService, CentralRisksService],
})
export class RisksModule {}
