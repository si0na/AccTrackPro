import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Shape of the JWT access-token payload attached to req.user by JwtAuthGuard. */
export interface JwtPayload {
  sub:   string; // Authenticated user UUID (FK → users.id)
  email: string;
  name:  string;
  role:  string;
  type:  'access';
  iat?:  number;
  exp?:  number;
}

/**
 * Route-handler parameter decorator — extracts the verified JWT payload
 * that JwtAuthGuard placed on request.user.
 *
 * Usage:
 *   create(@Body() body: CreateAccountDto, @AuthUser() user: JwtPayload) {
 *     return this.service.create({ ...body, ownerId: user.sub });
 *   }
 */
export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest().user as JwtPayload,
);
