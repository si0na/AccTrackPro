import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comment.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  // Comments are scoped to records owned by the authenticated user.
  @Get()
  findAll(@AuthUser() authUser: JwtPayload) {
    return this.service.findAll(authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateCommentDto, @AuthUser() authUser: JwtPayload) {
    // The author is always the authenticated user — any client-sent
    // user/userId is ignored.
    return this.service.create({
      ...body,
      userId: authUser.sub,
      user: authUser.name,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub);
  }
}
