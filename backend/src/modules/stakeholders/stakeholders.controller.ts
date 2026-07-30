import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { StakeholdersService } from './stakeholders.service';
import { CreateStakeholderDto, UpdateStakeholderDto } from './dto/stakeholder.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('stakeholders')
export class StakeholdersController {
  constructor(private readonly service: StakeholdersService) {}

  // Stakeholders belong to an account and are never period-filtered — the
  // scope is always the authenticated user's accounts (JWT); any client-sent
  // userId is ignored.
  @Get()
  @RequirePermission('stakeholders', 'view')
  findAll(@AuthUser() authUser: JwtPayload) {
    return this.service.findAll({ userId: authUser.sub });
  }

  @Get('deactivated')
  @RequirePermission('stakeholders', 'view')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.service.findAllDeactivated({ userId: authUser.sub });
  }

  @Post()
  @RequirePermission('stakeholders', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateStakeholderDto, @AuthUser() authUser: JwtPayload) {
    return this.service.create(body, authUser.sub);
  }

  @Put(':id')
  @RequirePermission('stakeholders', 'update')
  update(
    @Param('id') id: string,
    @Body() body: UpdateStakeholderDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.update(id, body, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('stakeholders', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub);
  }
}
