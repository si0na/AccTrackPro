import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { NpsService } from './nps.service';
import { CreateNpsDto, UpdateNpsDto } from './dto/nps.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('nps')
export class NpsController {
  constructor(private readonly npsService: NpsService) {}

  @Get()
  @RequirePermission('accounts', 'view')
  findAll(
    @Query('accountId') accountId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.npsService.findAll({ accountId, projectId });
  }

  @Get(':id')
  @RequirePermission('accounts', 'view')
  findOne(@Param('id') id: string) {
    return this.npsService.findOne(id);
  }

  @Post()
  @RequirePermission('accounts', 'update')
  create(@Body() dto: CreateNpsDto) {
    return this.npsService.create(dto);
  }

  @Put(':id')
  @RequirePermission('accounts', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateNpsDto) {
    return this.npsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('accounts', 'delete')
  remove(@Param('id') id: string) {
    return this.npsService.remove(id);
  }
}
