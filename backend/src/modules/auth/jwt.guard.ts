import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();

    // Primary: read access token from HttpOnly cookie
    // Fallback: Authorization: Bearer header (API testing / CLI tools)
    let token: string | undefined = request.cookies?.['crm_access'];

    if (!token) {
      const auth: string | undefined = request.headers['authorization'];
      if (auth?.startsWith('Bearer ')) token = auth.split(' ')[1];
    }

    if (!token) throw new UnauthorizedException('Authentication required');

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      // Reject refresh tokens used as access tokens
      if (payload.type !== 'access') throw new Error('Invalid token type');
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
