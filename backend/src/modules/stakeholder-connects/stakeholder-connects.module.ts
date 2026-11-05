import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RbacModule } from '../rbac/rbac.module';
import { ActionItemsModule } from '../action-items/action-items.module';
import { ServiceProviderModule } from '../service-provider/service-provider.module';
import { StakeholderConnectsController } from './stakeholder-connects.controller';
import { StakeholderConnectsService } from './stakeholder-connects.service';

@Module({
  imports: [
    DatabaseModule,
    RbacModule,
    ActionItemsModule,
    ServiceProviderModule,
  ],
  controllers: [StakeholderConnectsController],
  providers: [StakeholderConnectsService],
  exports: [StakeholderConnectsService],
})
export class StakeholderConnectsModule {}
