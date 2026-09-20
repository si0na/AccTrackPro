import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmployeeMasterService } from './employee-master.service';
import { CreateEmployeeMasterDto, UpdateEmployeeMasterDto } from './dto/employee-master.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('employee-master')
export class EmployeeMasterController {
  constructor(private readonly service: EmployeeMasterService) {}

  @Get()
  @RequirePermission('administration', 'view')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermission('administration', 'manage')
  create(@Body() dto: CreateEmployeeMasterDto) {
    return this.service.create(dto);
  }

  @Post(':id/update')
  @RequirePermission('administration', 'manage')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeMasterDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('administration', 'manage')
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { success: true };
  }
}
