import { Module } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { ServiceProviderController } from './service-provider.controller';
import { ServiceProviderBackfillController } from './service-provider-backfill.controller';
import { ServiceProviderBackfillRunner } from './service-provider-backfill.runner';

/**
 * DatabaseService and PermissionsService (RBAC, @Global) are provided globally,
 * so no imports are needed. Exports the service for AccountsModule (auto-
 * registration on account creation / manager change) and UsersModule (identity-
 * field sync on user update).
 *
 * ServiceProviderBackfillRunner runs the idempotent backfill once at startup;
 * ServiceProviderBackfillController exposes the same backfill as an admin-only
 * manual endpoint.
 */
@Module({
  controllers: [ServiceProviderController, ServiceProviderBackfillController],
  providers: [ServiceProviderService, ServiceProviderBackfillRunner],
  exports: [ServiceProviderService],
})
export class ServiceProviderModule {}

