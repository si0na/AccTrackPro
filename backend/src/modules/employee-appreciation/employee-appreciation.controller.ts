import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req,
} from '@nestjs/common';
import { EmployeeAppreciationService } from './employee-appreciation.service';
import { CreateEmployeeAppreciationDto, UpdateEmployeeAppreciationDto } from './dto/employee-appreciation.dto';

@Controller('employee-appreciation')
export class EmployeeAppreciationController {
  constructor(private readonly service: EmployeeAppreciationService) {}

  @Get()
  findAll(
    @Query('accountId') accountId?: string,
    @Query('projectId') projectId?: string,
    @Query('internalExternal') internalExternal?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ accountId, projectId, internalExternal, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeAppreciationDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.service.create(dto, userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeAppreciationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
