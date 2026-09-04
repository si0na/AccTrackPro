import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import { NpsService } from './nps.service';
import { CreateNpsDto, UpdateNpsDto } from './dto/nps.dto';

@Controller('nps')
export class NpsController {
  constructor(private readonly npsService: NpsService) {}

  @Get()
  findAll(
    @Query('accountId') accountId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.npsService.findAll({ accountId, projectId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.npsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateNpsDto) {
    return this.npsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNpsDto) {
    return this.npsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.npsService.remove(id);
  }
}
