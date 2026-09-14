import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectDependenciesService } from './project-dependencies.service';
import { CreateProjectDependencyDto, UpdateProjectDependencyDto } from './dto/project-dependencies.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('projects/:projectId/dependencies')
export class ProjectDependenciesController {
  constructor(private readonly dependenciesService: ProjectDependenciesService) {}

  @Get()
  @RequirePermission('projects', 'view')
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.dependenciesService.findAll(projectId, authUser.sub);
  }

  @Post()
  @RequirePermission('projects', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectDependencyDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.dependenciesService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  @RequirePermission('projects', 'update')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectDependencyDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.dependenciesService.update(projectId, id, body, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.dependenciesService.remove(projectId, id, authUser.sub);
  }
}
