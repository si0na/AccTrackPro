import { Body, Controller, Get, Put } from '@nestjs/common';
import { ServiceProviderService } from './service-provider.service';
import { UpdateServiceProviderProfileDto } from './dto/service-provider-profile.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

/**
 * The logged-in user's own Service Provider profile. Authenticated-only (the
 * global JwtAuthGuard applies); no RBAC module gate since every user manages
 * only their own record.
 */
@Controller('service-provider-profile')
export class ServiceProviderController {
  constructor(private readonly service: ServiceProviderService) {}

  @Get('me')
  getMine(@AuthUser() authUser: JwtPayload) {
    return this.service.getMine(authUser.sub);
  }

  @Put('me')
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
}
