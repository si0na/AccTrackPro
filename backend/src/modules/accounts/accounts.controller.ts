import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // Accounts exist independently of any fiscal period — the Global Period
  // Selector never filters them, so only the owner scope applies. The owner
  // is always the authenticated user (JWT); any client-sent userId is ignored.
  // Optional ?page=&pageSize= switches the response to a paginated envelope.
  @Get()
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.accountsService.findAll({ userId: authUser.sub }, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.accountsService.findAllDeactivated({ userId: authUser.sub });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.accountsService.findOne(id, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreateAccountDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.accountsService.create({ ...fullData, ownerId: authUser.sub });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateAccountDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const { ownerId: _strip, ...safeDto } = body as Record<string, any>;
    const fullData = mergeWithCustomFields(safeDto, req.body ?? {});
    return this.accountsService.update(id, fullData, authUser.sub);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.accountsService.restore(id, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.accountsService.remove(id, authUser.sub);
  }
}
