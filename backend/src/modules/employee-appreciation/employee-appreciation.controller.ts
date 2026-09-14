import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req,
} from '@nestjs/common';
import { EmployeeAppreciationService } from './employee-appreciation.service';
import { CreateEmployeeAppreciationDto, UpdateEmployeeAppreciationDto } from './dto/employee-appreciation.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('employee-appreciation')
export class EmployeeAppreciationController {
  constructor(private readonly service: EmployeeAppreciationService) {}

  @Get()
  @RequirePermission('employeeAppreciation', 'view')
  findAll(
    @Query('accountId') accountId?: string,
    @Query('projectId') projectId?: string,
    @Query('internalExternal') internalExternal?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ accountId, projectId, internalExternal, search });
  }

  @Get(':id')
  @RequirePermission('employeeAppreciation', 'view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('employeeAppreciation', 'create')
  create(@Body() dto: CreateEmployeeAppreciationDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.service.create(dto, userId);
  }

  @Put(':id')
  @RequirePermission('employeeAppreciation', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeAppreciationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('employeeAppreciation', 'delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
