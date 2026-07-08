import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService, ForecastResult, ForecastParams } from './analytics.service';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/analytics/forecast?financialYear=&quarter=&accountId=
   *
   * userId is always the authenticated user from the JWT — any client-sent
   * userId query param is discarded to prevent cross-user data leaks.
   */
  @Get('forecast')
  getForecast(
    @Query() query: ForecastParams,
    @AuthUser() authUser: JwtPayload,
  ): Promise<ForecastResult> {
    const { userId: _discard, ...safeQuery } = query as Record<string, any>;
    return this.analyticsService.getForecast({ ...safeQuery, userId: authUser.sub });
  }
}
