import { Controller, Get } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // Alerts reflect the current state and are never fiscal-period-filtered.
  // Scope is always the authenticated user (JWT); any client-sent userId is ignored.
  @Get()
  findAll(@AuthUser() authUser: JwtPayload) {
    return this.alertsService.findAll({ userId: authUser.sub });
  }
}
