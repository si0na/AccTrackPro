import { Body, Controller, Get, Put, Post } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { UpdateServiceProviderProfileDto } from './dto/service-provider-profile.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

/**
 * Service Provider endpoints:
 *   GET  /service-providers        — all system users as SP options (no active filter)
 *   GET  /service-provider-profile/me — logged-in user's own SP profile
 *   PUT  /service-provider-profile/me — update phone / identity fields
 */
@Controller()
export class ServiceProviderController {
  constructor(private readonly service: ServiceProviderService) {}

  /**
   * Returns ALL system users as Service Provider options.
   * No is_active filter — every System User is a Service Provider.
   */
  @Get('service-providers')
  getAllServiceProviders() {
    return this.service.findAllAsServiceProviders();
  }

  @Get('service-provider-profile/me')
  getMine(@AuthUser() authUser: JwtPayload) {
    return this.service.getMine(authUser.sub);
  }

  @Put('service-provider-profile/me')
  updateMine(
    @Body() body: UpdateServiceProviderProfileDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.updateProfile(authUser.sub, {
      phone:       body.phone,
      name:        body.name,
      department:  body.department,
      designation: body.designation,
      email:       body.email,
    });
  }

  @Post('service-providers/associate')
  associate(
    @Body() body: { userId: string; accountId: string },
  ) {
    return this.service.resolveOrCreate(body.userId, body.accountId);
  }
}
