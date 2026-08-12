import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';

/**
 * Runs the Service Provider backfill once, at startup.
 *
 * Uses OnApplicationBootstrap rather than OnModuleInit deliberately: Nest fires
 * every module's onModuleInit (which is where DatabaseBootstrap runs the schema
 * migrations) to completion BEFORE any onApplicationBootstrap. That guarantees
 * the intended order — backend starts → migrations run → backfill executes →
 * application continues normally.
 *
 * The backfill is idempotent, so this is safe on every boot. A failure here is
 * logged but never prevents the application from starting.
 */
@Injectable()
export class ServiceProviderBackfillRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServiceProviderBackfillRunner.name);

  constructor(private readonly service: ServiceProviderService) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Service Provider startup backfill has been disabled.');
  }
}
