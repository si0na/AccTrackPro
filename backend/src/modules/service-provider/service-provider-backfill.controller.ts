import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { RequirePermission } from '../rbac/require-permission.decorator';

/**
 * Admin-only manual trigger for the Service Provider backfill. The sweep also
 * runs automatically at startup (see ServiceProviderBackfillRunner); this
 * endpoint lets an administrator re-run it on demand. It is idempotent, so
 * re-running it never creates duplicate stakeholders.
 *
 * Gated by administration:manage — the same permission that guards every other
 * administrative mutation.
 */
@Controller('service-provider')
export class ServiceProviderBackfillController {
  constructor(private readonly service: ServiceProviderService) {}

  @Post('backfill')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('administration', 'manage')
  backfill() {
    return this.service.backfillServiceProviders();
  }
}
