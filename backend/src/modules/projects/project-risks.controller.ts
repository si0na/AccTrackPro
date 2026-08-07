import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectRisksService } from './project-risks.service';
import { CreateProjectRiskDto, UpdateProjectRiskDto } from './dto/project-risks.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('projects/:projectId/risks')
export class ProjectRisksController {
  constructor(private readonly risksService: ProjectRisksService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.risksService.findAll(projectId, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectRiskDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.risksService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectRiskDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.risksService.update(projectId, id, body, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.risksService.remove(projectId, id, authUser.sub);
  }
}
