import { Controller, Get, Patch, Delete, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { parsePagination } from '../../common/utils/pagination.util';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Notifications are user-scoped only — never fiscal-period-filtered.
  // Optional ?page=&pageSize= returns a paginated envelope; ?category= and
  // ?unread=true narrow the list (both are index-backed).
  @Get()
  findAll(
    @AuthUser() authUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('unread') unread?: string,
  ) {
    return this.notificationsService.findAll(
      { userId: authUser.sub },
      parsePagination(page, pageSize),
      { category, unreadOnly: unread === 'true' },
    );
  }

  @Get('unread-count')
  async getUnreadCount(@AuthUser() authUser: JwtPayload) {
    const count = await this.notificationsService.getUnreadCount({ userId: authUser.sub });
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.notificationsService.markRead(id, authUser.sub);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@AuthUser() authUser: JwtPayload) {
    return this.notificationsService.markAllRead(authUser.sub);
  }

  @Delete('clear-read')
  @HttpCode(HttpStatus.OK)
  clearRead(@AuthUser() authUser: JwtPayload) {
    return this.notificationsService.clearRead(authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.notificationsService.remove(id, authUser.sub);
  }
}
