import { Module } from '@nestjs/common';
import { OpportunityForecastController } from './opportunity-forecast.controller';
import { OpportunityForecastService } from './opportunity-forecast.service';
import { OpportunitiesModule } from '../opportunities/opportunities.module';

@Module({
  // OpportunitiesModule exports OpportunitiesService, reused here for ownership
  // enforcement and the opportunity summary shown on the Forecast page.
  imports: [OpportunitiesModule],
  controllers: [OpportunityForecastController],
  providers: [OpportunityForecastService],
})
export class OpportunityForecastModule {}
