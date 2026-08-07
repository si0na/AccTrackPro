import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Owner scope only, always the authenticated user (JWT). Any client-sent
  // userId is ignored. Optional ?page=&pageSize= switches the response to a
  // paginated envelope.
  @Get()
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.projectsService.findAll({ userId: authUser.sub }, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.projectsService.findAllDeactivated({ userId: authUser.sub });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.projectsService.findOne(id, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreateProjectDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Preserve custom-column fields stripped by the whitelist pipe; the
    // backend is authoritative for ownerId — always set from the verified JWT.
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.projectsService.create({ ...fullData, ownerId: authUser.sub });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Strip any frontend-supplied ownerId: ownership is preserved from the database.
    const { ownerId: _strip, ...safeDto } = body as Record<string, any>;
    const fullData = mergeWithCustomFields(safeDto, req.body ?? {});
    return this.projectsService.update(id, fullData, authUser.sub);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.projectsService.restore(id, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.projectsService.remove(id, authUser.sub);
  }
}
