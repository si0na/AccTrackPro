import { Controller, Get, Put, Post, Body, Param } from '@nestjs/common';
import { AdministrationService } from './administration.service';
import { UpdateFinancialCalendarDto, UpdateSettingsDto, UpdateUserDto, CreateUserDto } from './dto/administration.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('administration')
export class AdministrationController {
  constructor(private readonly service: AdministrationService) {}

  @Get('system-overview')
  @RequirePermission('administration', 'view')
  getSystemOverview() {
    return this.service.getSystemOverview();
  }

  @Get('users')
  @RequirePermission('administration', 'view')
  getUsers() {
    return this.service.getUsers();
  }

  @Post('users')
  @RequirePermission('administration', 'manage')
  createUser(@Body() dto: CreateUserDto, @AuthUser() user: JwtPayload) {
    return this.service.createUser(dto, user.sub);
  }

  @Put('users/:id')
  @RequirePermission('administration', 'manage')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @AuthUser() user: JwtPayload) {
    return this.service.updateUser(id, dto, user.sub);
  }

  @Get('financial-calendar')
  @RequirePermission('administration', 'view')
  getFinancialCalendar() {
    return this.service.getFinancialCalendar();
  }

  @Put('financial-calendar')
  @RequirePermission('administration', 'manage')
  updateFinancialCalendar(@Body() dto: UpdateFinancialCalendarDto) {
    return this.service.updateFinancialCalendar(dto);
  }

  @Get('settings')
  @RequirePermission('administration', 'view')
  getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequirePermission('administration', 'manage')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(dto);
  }
}
