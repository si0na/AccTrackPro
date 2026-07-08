import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { CreateActionItemDto, UpdateActionItemDto } from './dto/action-item.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly service: ActionItemsService) {}

  // Operational task list — never fiscal-period-filtered; owner scope only,
  // always the authenticated user (JWT). Any client-sent userId is ignored.
  // Optional ?page=&pageSize= switches the response to a paginated envelope.
  @Get()
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({ userId: authUser.sub }, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.service.findAllDeactivated({ userId: authUser.sub });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreateActionItemDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Preserve custom-column fields stripped by the whitelist pipe; the
    // backend is authoritative for ownerId — always set from the verified JWT.
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.service.create({ ...fullData, ownerId: authUser.sub });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateActionItemDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    // Strip any frontend-supplied ownerId: ownership is preserved from the database.
    const { ownerId: _strip, ...safeDto } = body as Record<string, any>;
    const fullData = mergeWithCustomFields(safeDto, req.body ?? {});
    return this.service.update(id, fullData, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub);
  }
}
