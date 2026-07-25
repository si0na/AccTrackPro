import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectDependenciesService } from './project-dependencies.service';
import { CreateProjectDependencyDto, UpdateProjectDependencyDto } from './dto/project-dependencies.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('projects/:projectId/dependencies')
export class ProjectDependenciesController {
  constructor(private readonly dependenciesService: ProjectDependenciesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.dependenciesService.findAll(projectId, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectDependencyDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.dependenciesService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectDependencyDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.dependenciesService.update(projectId, id, body, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.dependenciesService.remove(projectId, id, authUser.sub);
  }
}
