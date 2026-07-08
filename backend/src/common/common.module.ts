import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { FilterContextService } from './services/filter-context.service';
import { TtlCacheService } from './services/ttl-cache.service';
import { RequestIdMiddleware } from './middleware/request-id.middleware';

@Global()
@Module({
  providers: [FilterContextService, TtlCacheService],
  exports:   [FilterContextService, TtlCacheService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply RequestIdMiddleware to every route so every request gets an ALS
    // context (requestId) before guards, interceptors, and handlers run.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
