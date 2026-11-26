import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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

  @Post('generate')
  generate(@Body() body: { projectId?: string; accountId?: string }) {
    if (body.projectId) {
      return this.npsService.generateForProject(body.projectId);
    }
    if (body.accountId) {
      return this.npsService.generateForAccount(body.accountId);
    }
    return this.npsService.generateAllPending();
  }

  @Post('generate/:projectId')
  generateForProject(@Param('projectId') projectId: string) {
    return this.npsService.generateForProject(projectId);
  }

  @Post(':id/update')
  update(@Param('id') id: string, @Body() dto: UpdateNpsDto) {
    return this.npsService.update(id, dto);
  }

  @Post(':id/delete')
  remove(@Param('id') id: string) {
    return this.npsService.remove(id);
  }
}
