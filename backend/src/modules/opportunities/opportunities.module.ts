import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { ProjectsModule } from '../projects/projects.module';
import { ServiceProviderModule } from '../service-provider/service-provider.module';

@Module({
  imports: [ProjectsModule, ServiceProviderModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}

