import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccountWeeklyHealthService } from './account-weekly-health.service';
import {
  CreateAccountWeeklyHealthDto,
  UpdateAccountWeeklyHealthDto,
} from './dto/account-weekly-health.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('accounts/:accountId/weekly-health')
export class AccountWeeklyHealthController {
  constructor(private readonly weeklyHealthService: AccountWeeklyHealthService) {}

  @Get()
  @RequirePermission('accounts', 'view')
  findAll(
    @Param('accountId') accountId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.findAll(accountId, authUser.sub);
  }

  @Get(':id')
  @RequirePermission('accounts', 'view')
  findOne(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.findOne(accountId, id, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('accounts', 'update')
  create(
    @Param('accountId') accountId: string,
    @Body() body: CreateAccountWeeklyHealthDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.create(accountId, body, authUser.sub);
  }

  @Put(':id')
  @RequirePermission('accounts', 'update')
  updatePut(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() body: UpdateAccountWeeklyHealthDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.update(accountId, id, body, authUser.sub);
  }

  @Post(':id/update')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounts', 'update')
  updatePost(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() body: UpdateAccountWeeklyHealthDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.update(accountId, id, body, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('accounts', 'update')
  delete(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.delete(accountId, id, authUser.sub);
  }

  @Post(':id/delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounts', 'update')
  deletePost(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.weeklyHealthService.delete(accountId, id, authUser.sub);
  }
}
