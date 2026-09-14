import {
  Controller, Get, Post, Put, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectProgressService } from './project-progress.service';
import { CreateProjectProgressDto, UpdateProjectProgressDto } from './dto/project-progress.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('projects/:projectId/progress')
export class ProjectProgressController {
  constructor(private readonly progressService: ProjectProgressService) {}

  @Get()
  @RequirePermission('projects', 'view')
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.progressService.findAll(projectId, authUser.sub);
  }

  @Post()
  @RequirePermission('projects', 'update')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectProgressDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.progressService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  @RequirePermission('projects', 'update')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectProgressDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.progressService.update(projectId, id, body, authUser.sub);
  }
}
