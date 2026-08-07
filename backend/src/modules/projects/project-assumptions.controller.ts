import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectAssumptionsService } from './project-assumptions.service';
import { CreateProjectAssumptionDto, UpdateProjectAssumptionDto } from './dto/project-assumptions.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('projects/:projectId/assumptions')
export class ProjectAssumptionsController {
  constructor(private readonly assumptionsService: ProjectAssumptionsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.assumptionsService.findAll(projectId, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectAssumptionDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.assumptionsService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectAssumptionDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.assumptionsService.update(projectId, id, body, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.assumptionsService.remove(projectId, id, authUser.sub);
  }
}
