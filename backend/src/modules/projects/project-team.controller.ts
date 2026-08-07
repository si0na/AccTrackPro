import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectTeamService } from './project-team.service';
import { CreateProjectTeamMemberDto, UpdateProjectTeamMemberDto } from './dto/project-team.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('projects/:projectId/team')
export class ProjectTeamController {
  constructor(private readonly teamService: ProjectTeamService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.teamService.findAll(projectId, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectTeamMemberDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.teamService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectTeamMemberDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.teamService.update(projectId, id, body, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.teamService.remove(projectId, id, authUser.sub);
  }
}
