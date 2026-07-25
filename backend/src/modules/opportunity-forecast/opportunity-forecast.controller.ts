import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { OpportunityForecastService, OpportunityForecastResult } from './opportunity-forecast.service';
import { UpsertOpportunityForecastDto } from './dto/opportunity-forecast.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('opportunity-forecast')
export class OpportunityForecastController {
  constructor(private readonly service: OpportunityForecastService) {}

  /** GET /api/opportunity-forecast/:opportunityId — forecast + actuals + revision history. */
  @Get(':opportunityId')
  get(
    @Param('opportunityId') opportunityId: string,
    @AuthUser() authUser: JwtPayload,
  ): Promise<OpportunityForecastResult> {
    return this.service.getForOpportunity(opportunityId, authUser.sub);
  }

  /** PUT /api/opportunity-forecast/:opportunityId — upsert the forecast card. */
  @Put(':opportunityId')
  upsert(
    @Param('opportunityId') opportunityId: string,
    @Body() body: UpsertOpportunityForecastDto,
    @AuthUser() authUser: JwtPayload,
  ): Promise<OpportunityForecastResult> {
    return this.service.upsert(opportunityId, body, { sub: authUser.sub, name: authUser.name });
  }
}
