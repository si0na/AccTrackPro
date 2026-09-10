import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AccountRisksService } from './account-risks.service';
import { CreateAccountRiskDto, UpdateAccountRiskDto } from './dto/account-risk.dto';

@Controller('account-risks')
@UseGuards(JwtAuthGuard)
export class AccountRisksController {
  constructor(private readonly service: AccountRisksService) {}

  @Get()
  async findAll(@Query('accountId') accountId?: string, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.findAll(accountId, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.findOne(id, userId);
  }

  @Post()
  async create(@Body() dto: CreateAccountRiskDto, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.create(dto, userId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAccountRiskDto, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.service.remove(id, userId);
  }
}
