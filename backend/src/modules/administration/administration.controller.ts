import { Controller, Get, Put, Body } from '@nestjs/common';
import { AdministrationService } from './administration.service';
import { UpdateFinancialCalendarDto, UpdateSettingsDto } from './dto/administration.dto';

@Controller('administration')
export class AdministrationController {
  constructor(private readonly service: AdministrationService) {}

  @Get('system-overview')
  getSystemOverview() {
    return this.service.getSystemOverview();
  }

  @Get('users')
  getUsers() {
    return this.service.getUsers();
  }

  @Get('financial-calendar')
  getFinancialCalendar() {
    return this.service.getFinancialCalendar();
  }

  @Put('financial-calendar')
  updateFinancialCalendar(@Body() dto: UpdateFinancialCalendarDto) {
    return this.service.updateFinancialCalendar(dto);
  }

  @Get('settings')
  getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(dto);
  }
}
