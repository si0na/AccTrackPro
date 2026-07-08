import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/activity.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  // Operational activity feed — never fiscal-period-filtered; owner scope
  // only, always the authenticated user (JWT). Any client-sent userId is
  // ignored. Optional ?page=&pageSize= returns a paginated envelope.
  @Get()
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({ userId: authUser.sub }, parsePagination(page, pageSize));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateActivityDto, @AuthUser() authUser: JwtPayload) {
    // The author is always the authenticated user — any client-sent
    // user/userId is ignored.
    return this.service.create({
      ...body,
      userId: authUser.sub,
      user: authUser.name,
    });
  }
}
