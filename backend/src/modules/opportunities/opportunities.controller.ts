import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto, UpdateOpportunityDto } from './dto/opportunity.dto';
import { CreateProjectDto } from '../projects/dto/project.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  // Operational list — never fiscal-period-filtered; owner scope only, always
  // the authenticated user (JWT). Any client-sent userId is ignored.
  // Optional ?page=&pageSize= switches the response to a paginated envelope.
  @Get()
  @RequirePermission('opportunities', 'view')
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.opportunitiesService.findAll({ userId: authUser.sub }, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  @RequirePermission('opportunities', 'view')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.opportunitiesService.findAllDeactivated({ userId: authUser.sub });
  }

  @Get(':id')
  @RequirePermission('opportunities', 'view')
  findOne(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.opportunitiesService.findOne(id, authUser.sub);
  }

  @Post()
  @RequirePermission('opportunities', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreateOpportunityDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Preserve custom-column fields stripped by the whitelist pipe; the
    // backend is authoritative for ownerId — always set from the verified JWT.
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.opportunitiesService.create({ ...fullData, ownerId: authUser.sub });
  }

  // Manual, user-initiated conversion of a Won opportunity into a Project.
  // The body carries the user-reviewed project fields; the service forces the
  // account/opportunity/owner links from the opportunity and rejects the call
  // unless the deal is Won and has no project yet.
  @Post(':id/create-project')
  @RequirePermission('opportunities', 'update')
  @HttpCode(HttpStatus.CREATED)
  createProject(
    @Param('id') id: string,
    @Body() body: CreateProjectDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Preserve any custom-column fields the whitelist pipe stripped.
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.opportunitiesService.createProject(id, fullData, authUser.sub);
  }

  @Put(':id')
  @RequirePermission('opportunities', 'update')
  update(
    @Param('id') id: string,
    @Body() body: UpdateOpportunityDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Strip any frontend-supplied ownerId: ownership is preserved from the database.
    const { ownerId: _strip, ...safeDto } = body as Record<string, any>;
    const fullData = mergeWithCustomFields(safeDto, req.body ?? {});
    return this.opportunitiesService.update(id, fullData, authUser.sub);
  }

  @Patch(':id/restore')
  @RequirePermission('opportunities', 'update')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.opportunitiesService.restore(id, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('opportunities', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.opportunitiesService.remove(id, authUser.sub);
  }
}
