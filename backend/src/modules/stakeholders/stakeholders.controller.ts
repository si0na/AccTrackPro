import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { StakeholdersService } from './stakeholders.service';
import { CreateStakeholderDto, UpdateStakeholderDto } from './dto/stakeholder.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('stakeholders')
export class StakeholdersController {
  constructor(private readonly service: StakeholdersService) {}

  // Stakeholders belong to an account and are never period-filtered — the
  // scope is always the authenticated user's accounts (JWT); any client-sent
  // userId is ignored.
  @Get()
  findAll(@AuthUser() authUser: JwtPayload) {
    return this.service.findAll({ userId: authUser.sub });
  }

  @Get('deactivated')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.service.findAllDeactivated({ userId: authUser.sub });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateStakeholderDto, @AuthUser() authUser: JwtPayload) {
    return this.service.create(body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateStakeholderDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.update(id, body, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub);
  }
}
