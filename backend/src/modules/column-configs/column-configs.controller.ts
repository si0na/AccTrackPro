import { Controller, Get, Post, Body } from '@nestjs/common';
import { ColumnConfigsService } from './column-configs.service';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('column-configs')
export class ColumnConfigsController {
  constructor(private readonly service: ColumnConfigsService) {}

  @Get() findAll(@AuthUser() user: JwtPayload) { return this.service.findAll(user.sub); }
  @Post() save(@Body() body: any, @AuthUser() user: JwtPayload) { return this.service.save(user.sub, body); }
}
