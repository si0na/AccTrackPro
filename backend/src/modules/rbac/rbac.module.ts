import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsService } from './permissions.service';
import { AccessScopeService } from './access-scope.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacController } from './rbac.controller';

/**
 * RBAC module. Global so PermissionsService / AccessScopeService can be injected
 * by every feature module for centralized authorization and role-aware
 * visibility, without duplicate wiring.
 *
 * Registers PermissionsGuard as a global guard. It is imported AFTER AuthModule
 * in app.module.ts so it runs after the global JwtAuthGuard (which populates
 * request.user); the guard also fails closed if no user is present.
 */
@Global()
@Module({
  controllers: [RbacController],
  providers: [
    PermissionsService,
    AccessScopeService,
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PermissionsService, AccessScopeService],
})
export class RbacModule {}
