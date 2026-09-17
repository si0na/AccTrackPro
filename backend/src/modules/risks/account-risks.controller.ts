import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AccountRisksService } from './account-risks.service';
import { CreateAccountRiskDto, UpdateAccountRiskDto } from './dto/account-risk.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('account-risks')
@UseGuards(JwtAuthGuard)
export class AccountRisksController {
  constructor(private readonly service: AccountRisksService) {}

  @Get()
  @RequirePermission('risks', 'view')
  async findAll(@Query('accountId') accountId?: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.findAll(accountId, authUser?.sub);
  }

  @Get(':id')
  @RequirePermission('risks', 'view')
  async findOne(@Param('id') id: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.findOne(id, authUser?.sub);
  }

  @Post()
  @RequirePermission('risks', 'create')
  async create(@Body() dto: CreateAccountRiskDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.create(dto, authUser?.sub);
  }

  @Put(':id')
  @RequirePermission('risks', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateAccountRiskDto, @AuthUser() authUser?: JwtPayload) {
    return this.service.update(id, dto, authUser?.sub);
  }

  @Delete(':id')
  @RequirePermission('risks', 'delete')
  async remove(@Param('id') id: string, @AuthUser() authUser?: JwtPayload) {
    return this.service.remove(id, authUser?.sub);
  }
}
