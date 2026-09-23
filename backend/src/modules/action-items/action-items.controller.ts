import { Controller, Get, Post, Body, Param, Query, Req, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { CreateActionItemDto, UpdateActionItemDto } from './dto/action-item.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { PermissionsService } from '../rbac/permissions.service';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('action-items')
export class ActionItemsController {
  constructor(
    private readonly service: ActionItemsService,
    private readonly permissions: PermissionsService,
  ) {}

  // Operational task list — never fiscal-period-filtered; owner/role scope applied server-side.
  @Get()
  async findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = authUser.sub;
    const canViewNormal = (await this.permissions.can(userId, 'action-items', 'view')) || (await this.permissions.can(userId, 'action-items', 'view-all'));
    const canViewProject = (await this.permissions.can(userId, 'project-action-items', 'view')) || (await this.permissions.can(userId, 'project-action-items', 'view-all'));

    if (!canViewNormal && !canViewProject) {
      throw new ForbiddenException('You do not have permission to view action items.');
    }

    return this.service.findAll({ userId }, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  async findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    const userId = authUser.sub;
    const canViewNormal = (await this.permissions.can(userId, 'action-items', 'view')) || (await this.permissions.can(userId, 'action-items', 'view-all'));
    const canViewProject = (await this.permissions.can(userId, 'project-action-items', 'view')) || (await this.permissions.can(userId, 'project-action-items', 'view-all'));

    if (!canViewNormal && !canViewProject) {
      throw new ForbiddenException('You do not have permission to view action items.');
    }

    return this.service.findAllDeactivated({ userId });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateActionItemDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    const projectId = fullData.projectId;
    const requiredModule = projectId ? 'project-action-items' : 'action-items';

    const allowed = await this.permissions.can(authUser.sub, requiredModule, 'create');
    if (!allowed) {
      throw new ForbiddenException(`You do not have permission to create ${requiredModule}.`);
    }

    return this.service.create({ ...fullData, ownerId: authUser.sub }, authUser.sub);
  }

  @Post(':id/update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateActionItemDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const { ownerId: _strip, ...safeDto } = body as Record<string, any>;
    const fullData = mergeWithCustomFields(safeDto, req.body ?? {});
    await this.service.assertUpdatePermission(id, fullData, authUser.sub);
    return this.service.update(id, fullData, authUser.sub);
  }

  @Post(':id/delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    await this.service.assertDeletePermission(id, authUser.sub);
    return this.service.remove(id, authUser.sub);
  }
}
