import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AccountRisksService } from './account-risks.service';
import { CreateAccountRiskDto, UpdateAccountRiskDto } from './dto/account-risk.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('account-risks')
@UseGuards(JwtAuthGuard)
export class AccountRisksController {
  constructor(private readonly service: AccountRisksService) {}

  @Get()
  @RequirePermission('risks', 'view')
  async findAll(@Query('accountId') accountId?: string, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.findAll(accountId, userId);
  }

  @Get(':id')
  @RequirePermission('risks', 'view')
  async findOne(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.findOne(id, userId);
  }

  @Post()
  @RequirePermission('risks', 'create')
  async create(@Body() dto: CreateAccountRiskDto, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.create(dto, userId);
  }

  @Put(':id')
  @RequirePermission('risks', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateAccountRiskDto, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @RequirePermission('risks', 'delete')
  async remove(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.remove(id, userId);
  }
}
