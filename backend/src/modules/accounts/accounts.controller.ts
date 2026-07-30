import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AccessScopeService } from '../rbac/access-scope.service';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';
import { parsePagination } from '../../common/utils/pagination.util';

// Maps a role's account_scope_field (DB column) to the camelCase DTO key so the
// creator can be auto-stamped into the ownership field matching their role.
const SCOPE_FIELD_TO_KEY: Record<string, string> = {
  account_manager_id: 'accountManagerId',
  practice_lead_id:   'practiceLeadId',
  client_partner_id:  'clientPartnerId',
  vertical_head_id:   'verticalHeadId',
};

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly access: AccessScopeService,
  ) {}

  // Accounts exist independently of any fiscal period — the Global Period
  // Selector never filters them, so only role-based visibility applies. The
  // authenticated user (JWT) drives what rows they can see.
  // Optional ?page=&pageSize= switches the response to a paginated envelope.
  @Get()
  @RequirePermission('accounts', 'view')
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.accountsService.findAll({ userId: authUser.sub }, parsePagination(page, pageSize));
  }

  @Get('deactivated')
  @RequirePermission('accounts', 'view')
  findAllDeactivated(@AuthUser() authUser: JwtPayload) {
    return this.accountsService.findAllDeactivated({ userId: authUser.sub });
  }

  @Get(':id')
  @RequirePermission('accounts', 'view')
  findOne(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.accountsService.findOne(id, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('accounts', 'create')
  async create(
    @Body() body: CreateAccountDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});

    // The Account Manager is never chosen on the create form — it is always the
    // logged-in creator, and only when they actually hold the Account Manager
    // role. Any account_manager_id arriving in the request is ignored.
    delete fullData.accountManagerId;

    // "Is the creator an Account Manager?" is answered from the data model, not
    // a hardcoded role name: the Account Manager role is the one configured to
    // scope accounts by the account_manager_id FK (roles.account_scope_field).
    // A user may hold several roles at once (e.g. Admin + Account Manager), so we
    // inspect the full set of scope fields their roles grant — never assume one.
    const ctx = await this.access.getContext(authUser.sub);

    // Stamp the creator into every ownership field their roles are scoped by so
    // they retain visibility of the account they just created. When one of those
    // is account_manager_id (i.e. the creator is an Account Manager), the service
    // auto-registers them as this account's Service Provider stakeholder.
    for (const scopeField of ctx.accountScopeFields) {
      const key = SCOPE_FIELD_TO_KEY[scopeField];
      if (key && (fullData[key] === undefined || fullData[key] === null || fullData[key] === '')) {
        fullData[key] = authUser.sub;
      }
    }

    return this.accountsService.create({ ...fullData, ownerId: authUser.sub });
  }

  @Put(':id')
  @RequirePermission('accounts', 'update')
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
  @RequirePermission('accounts', 'update')
  restore(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.accountsService.restore(id, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('accounts', 'delete')
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.accountsService.remove(id, authUser.sub);
  }
}
