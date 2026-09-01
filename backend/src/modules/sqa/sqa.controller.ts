import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SqaService } from './sqa.service';
import { CreateSqaRecordDto, SetSqaWeekHealthDto, UpdateSqaRecordDto } from './dto/sqa.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

/**
 * SQA (Software Quality Assurance) — project-level weekly quality tracking.
 *
 * Reads are owner-scoped to the authenticated user, exactly like Projects: any
 * client-sent userId is ignored. `?weeks=N` widens the weekly health window
 * ("Health Week 31/32/33…") from the default 3; `?page=` switches the list to
 * the paginated envelope.
 */
@Controller('sqa')
export class SqaController {
  constructor(private readonly sqaService: SqaService) {}

  /**
   * The ISO weeks the weekly health columns currently cover. The frontend
   * renders its column headers from this instead of computing week numbers of
   * its own, so the grid and the stored trail can never disagree about which
   * week is which.
   */
  @Get('weeks')
  @RequirePermission('sqa', 'view')
  weekWindow(@Query('weeks') weeks?: string) {
    return this.sqaService.weekWindow(SqaService.normalizeWeeks(weeks));
  }

  /** Active projects of the requesting user that do not yet have an SQA record. */
  @Get('available-projects')
  @RequirePermission('sqa', 'create')
  availableProjects(@AuthUser() authUser: JwtPayload) {
    return this.sqaService.findAvailableProjects(authUser.sub);
  }

  @Get('deactivated')
  @RequirePermission('sqa', 'view')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.sqaService.findAllDeactivated({ userId: authUser.sub });
  }

  @Get('tracker')
  @RequirePermission('sqa', 'view')
  findTrackerHistory(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sqaService.findTrackerHistory(
      undefined,
      { userId: authUser.sub },
      parsePagination(page, pageSize) ?? undefined,
    );
  }

  @Get(':id/tracker')
  @RequirePermission('sqa', 'view')
  findRecordTrackerHistory(
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sqaService.findTrackerHistory(
      id,
      { userId: authUser.sub },
      parsePagination(page, pageSize) ?? undefined,
    );
  }

  @Get()
  @RequirePermission('sqa', 'view')
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('weeks') weeks?: string,
  ) {
    return this.sqaService.findAll(
      { userId: authUser.sub },
      parsePagination(page, pageSize),
      SqaService.normalizeWeeks(weeks),
    );
  }

  @Get(':id')
  @RequirePermission('sqa', 'view')
  findOne(
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
    @Query('weeks') weeks?: string,
  ) {
    return this.sqaService.findOne(id, authUser.sub, SqaService.normalizeWeeks(weeks));
  }

  @Post()
  @RequirePermission('sqa', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreateSqaRecordDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
    @Query('weeks') weeks?: string,
  ) {
    // Preserve custom-column fields stripped by the whitelist pipe; ownership
    // always comes from the verified JWT, never the request body.
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.sqaService.create(fullData, authUser.sub, SqaService.normalizeWeeks(weeks));
  }

  @Put(':id')
  @RequirePermission('sqa', 'update')
  update(
    @Param('id') id: string,
    @Body() body: UpdateSqaRecordDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
    @Query('weeks') weeks?: string,
  ) {
    const { ownerId: _strip, ...safeDto } = body as Record<string, any>;
    const fullData = mergeWithCustomFields(safeDto, req.body ?? {});
    return this.sqaService.update(id, fullData, authUser.sub, SqaService.normalizeWeeks(weeks));
  }

  /**
   * Sets one week's RAG value. The value lands in the project's existing health
   * trail (SQA keeps no health store of its own), so this needs the Projects
   * module's update permission as well as SQA's.
   */
  @Put(':id/week-health')
  @RequirePermission('projects', 'update')
  setWeekHealth(
    @Param('id') id: string,
    @Body() body: SetSqaWeekHealthDto,
    @AuthUser() authUser: JwtPayload,
    @Query('weeks') weeks?: string,
  ) {
    return this.sqaService.setWeekHealth(id, body, authUser.sub, SqaService.normalizeWeeks(weeks));
  }

  @Patch(':id/restore')
  @RequirePermission('sqa', 'update')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.sqaService.restore(id, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('sqa', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.sqaService.remove(id, authUser.sub);
  }
}
