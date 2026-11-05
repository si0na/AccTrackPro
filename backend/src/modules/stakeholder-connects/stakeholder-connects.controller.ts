import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { StakeholderConnectsService } from './stakeholder-connects.service';
import { CreateStakeholderConnectDto } from './dto/create-stakeholder-connect.dto';
import { UpdateStakeholderConnectDto } from './dto/update-stakeholder-connect.dto';
import { RescheduleConnectDto } from './dto/reschedule-connect.dto';
import { CancelConnectDto } from './dto/cancel-connect.dto';
import { CreateDraftFollowUpDto, UpdateDraftFollowUpDto } from './dto/draft-follow-up.dto';
import { ConvertDraftToActionItemDto } from './dto/convert-draft.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission, RequirePermissions } from '../rbac/require-permission.decorator';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('stakeholder-connects')
export class StakeholderConnectsController {
  constructor(private readonly service: StakeholderConnectsService) {}

  @Get()
  @RequirePermission('stakeholder-connects', 'view')
  async findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const filter = {
      userId: authUser.sub,
      accountId,
      status,
      startDate,
      endDate,
      search,
      includeDeleted: includeDeleted === 'true',
    };
    return this.service.findAll(filter, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  @RequirePermission('stakeholder-connects', 'view')
  async findAllDeactivated(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.service.findAllDeactivated(
      { userId: authUser.sub, accountId },
      parsePagination(page, pageSize),
    );
  }

  @Get(':id')
  @RequirePermission('stakeholder-connects', 'view')
  async findOne(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.findOne(id, authUser.sub);
  }

  @Post()
  @RequirePermission('stakeholder-connects', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateStakeholderConnectDto, @AuthUser() authUser: JwtPayload) {
    return this.service.create(body, authUser.sub, authUser.name);
  }

  @Patch(':id')
  @RequirePermission('stakeholder-connects', 'update')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStakeholderConnectDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.update(id, body, authUser.sub, authUser.name);
  }

  @Post(':id/update')
  @RequirePermission('stakeholder-connects', 'update')
  async updatePost(
    @Param('id') id: string,
    @Body() body: UpdateStakeholderConnectDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.update(id, body, authUser.sub, authUser.name);
  }

  @Post(':id/complete')
  @RequirePermission('stakeholder-connects', 'update')
  async complete(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.complete(id, authUser.sub, authUser.name);
  }

  @Post(':id/reschedule')
  @RequirePermission('stakeholder-connects', 'update')
  async reschedule(
    @Param('id') id: string,
    @Body() body: RescheduleConnectDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.reschedule(id, body, authUser.sub, authUser.name);
  }

  @Post(':id/cancel')
  @RequirePermission('stakeholder-connects', 'update')
  async cancel(
    @Param('id') id: string,
    @Body() body: CancelConnectDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.cancel(id, body, authUser.sub, authUser.name);
  }

  @Delete(':id')
  @RequirePermission('stakeholder-connects', 'delete')
  async remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub, authUser.name);
  }

  @Post(':id/delete')
  @RequirePermission('stakeholder-connects', 'delete')
  async removePost(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub, authUser.name);
  }

  @Post(':id/restore')
  @RequirePermission('stakeholder-connects', 'delete')
  async restore(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.restore(id, authUser.sub, authUser.name);
  }

  // ─── Attendees ────────────────────────────────────────────────────────────

  @Post(':id/attendees')
  @RequirePermission('stakeholder-connects', 'update')
  async addAttendee(
    @Param('id') id: string,
    @Body('stakeholderId') stakeholderId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.addAttendee(id, stakeholderId, authUser.sub, authUser.name);
  }

  @Delete(':id/attendees/:stakeholderId')
  @RequirePermission('stakeholder-connects', 'update')
  async removeAttendee(
    @Param('id') id: string,
    @Param('stakeholderId') stakeholderId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.removeAttendee(id, stakeholderId, authUser.sub, authUser.name);
  }

  // ─── Draft Follow-Ups ─────────────────────────────────────────────────────

  @Post(':id/drafts')
  @RequirePermission('stakeholder-connects', 'update')
  @HttpCode(HttpStatus.CREATED)
  async createDraft(
    @Param('id') id: string,
    @Body() body: CreateDraftFollowUpDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.createDraft(id, body, authUser.sub);
  }

  @Patch(':id/drafts/:draftId')
  @RequirePermission('stakeholder-connects', 'update')
  async updateDraft(
    @Param('id') id: string,
    @Param('draftId') draftId: string,
    @Body() body: UpdateDraftFollowUpDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.updateDraft(id, draftId, body, authUser.sub);
  }

  @Post(':id/drafts/:draftId/update')
  @RequirePermission('stakeholder-connects', 'update')
  async updateDraftPost(
    @Param('id') id: string,
    @Param('draftId') draftId: string,
    @Body() body: UpdateDraftFollowUpDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.updateDraft(id, draftId, body, authUser.sub);
  }

  @Delete(':id/drafts/:draftId')
  @RequirePermission('stakeholder-connects', 'update')
  async deleteDraft(
    @Param('id') id: string,
    @Param('draftId') draftId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.deleteDraft(id, draftId, authUser.sub);
  }

  @Post(':id/drafts/:draftId/delete')
  @RequirePermission('stakeholder-connects', 'update')
  async deleteDraftPost(
    @Param('id') id: string,
    @Param('draftId') draftId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.deleteDraft(id, draftId, authUser.sub);
  }

  // Conversion requires BOTH stakeholder-connects:update and action-items:create permissions
  @Post(':id/drafts/:draftId/convert')
  @RequirePermissions(
    { module: 'stakeholder-connects', permission: 'update' },
    { module: 'action-items', permission: 'create' },
  )
  async convertDraft(
    @Param('id') id: string,
    @Param('draftId') draftId: string,
    @Body() body: ConvertDraftToActionItemDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.convertDraft(id, draftId, body, authUser.sub, authUser.name);
  }

  // ─── Action Items Linking ─────────────────────────────────────────────────

  @Post(':id/action-items')
  @RequirePermission('stakeholder-connects', 'update')
  async linkActionItemFromBody(
    @Param('id') id: string,
    @Body('actionItemId') actionItemId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    if (!actionItemId) {
      throw new BadRequestException('actionItemId is required in request body.');
    }
    return this.service.linkActionItem(id, actionItemId, authUser.sub, authUser.name);
  }

  @Post(':id/action-items/:actionItemId')
  @RequirePermission('stakeholder-connects', 'update')
  async linkActionItem(
    @Param('id') id: string,
    @Param('actionItemId') actionItemId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.linkActionItem(id, actionItemId, authUser.sub, authUser.name);
  }

  @Post(':id/action-items/:actionItemId/delete')
  @RequirePermission('stakeholder-connects', 'update')
  async unlinkActionItemPost(
    @Param('id') id: string,
    @Param('actionItemId') actionItemId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.unlinkActionItem(id, actionItemId, authUser.sub, authUser.name);
  }

  @Delete(':id/action-items/:actionItemId')
  @RequirePermission('stakeholder-connects', 'update')
  async unlinkActionItem(
    @Param('id') id: string,
    @Param('actionItemId') actionItemId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.unlinkActionItem(id, actionItemId, authUser.sub, authUser.name);
  }
}
