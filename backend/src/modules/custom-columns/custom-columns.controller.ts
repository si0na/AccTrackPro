import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CustomColumnsService } from './custom-columns.service';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('custom-columns')
export class CustomColumnsController {
  constructor(private readonly service: CustomColumnsService) {}

  @Get() findAll(@AuthUser() user: JwtPayload) { return this.service.findAll(user.sub); }
  @Post() @HttpCode(HttpStatus.CREATED) create(@Body() body: any, @AuthUser() user: JwtPayload) { return this.service.create(user.sub, body); }
  @Delete(':module/:id') @HttpCode(HttpStatus.OK)
  remove(@Param('module') module: string, @Param('id') id: string, @AuthUser() user: JwtPayload) { return this.service.remove(user.sub, module, id); }
}
