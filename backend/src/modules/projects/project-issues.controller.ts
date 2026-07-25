import {
  Controller, Get, Post, Put, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectIssuesService } from './project-issues.service';
import { CreateProjectIssueDto, UpdateProjectIssueDto } from './dto/project-issues.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('projects/:projectId/issues')
export class ProjectIssuesController {
  constructor(private readonly issuesService: ProjectIssuesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.issuesService.findAll(projectId, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectIssueDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.issuesService.create(projectId, body, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectIssueDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.issuesService.update(projectId, id, body, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.issuesService.remove(projectId, id, authUser.sub);
  }
}
