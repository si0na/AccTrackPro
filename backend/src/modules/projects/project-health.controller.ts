import {
  Controller, Get, Post, Put, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectHealthService } from './project-health.service';
import { CreateProjectHealthDto, UpdateProjectHealthDto } from './dto/project-health.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('projects/:projectId/health')
export class ProjectHealthController {
  constructor(private readonly healthService: ProjectHealthService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.healthService.findAll(projectId, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectHealthDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.healthService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectHealthDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.healthService.update(projectId, id, body, authUser.sub);
  }
}
