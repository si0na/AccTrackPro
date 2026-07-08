import {
  Controller, Post, Get, Put, Body, Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

function clientIp(req: ExpressRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress ?? '';
}

function clientUa(req: ExpressRequest): string {
  return (req.headers['user-agent'] ?? '').slice(0, 500);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/auth/register  — public, rate-limited to 5/min per IP
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.password, body.avatarData);
  }

  // POST /api/auth/login  — public, rate-limited to 10/min per IP
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() body: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.login(body.email, body.password, res, clientIp(req), clientUa(req));
  }

  // POST /api/auth/refresh  — public (called with expired access token), high limit
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const rawRefresh = (req as any).cookies?.['crm_refresh'];
    await this.authService.refresh(rawRefresh, res, clientIp(req), clientUa(req));
  }

  // POST /api/auth/logout  — protected; revokes refresh token
  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const rawRefresh = req.cookies?.['crm_refresh'];
    await this.authService.logout(rawRefresh, req.user?.sub, res, clientIp(req), clientUa(req));
  }

  // GET /api/auth/me  — protected
  @SkipThrottle()
  @Get('me')
  me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }

  // PUT /api/auth/me/avatar  — protected
  @SkipThrottle()
  @Put('me/avatar')
  updateAvatar(@Req() req: any, @Body() body: { avatarData: string }) {
    return this.authService.updateAvatar(req.user.sub, body.avatarData);
  }

  // POST /api/auth/change-password  — protected, rate-limited
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.changePassword(
      req.user.sub, body.currentPassword, body.newPassword,
      res, clientIp(req), clientUa(req),
    );
  }

  // POST /api/auth/forgot-password  — public, strictly rate-limited
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: ExpressRequest) {
    return this.authService.forgotPassword(body.email, clientIp(req), clientUa(req));
  }

  // POST /api/auth/reset-password  — public, rate-limited
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: ExpressRequest) {
    return this.authService.resetPassword(body.token, body.newPassword, clientIp(req), clientUa(req));
  }
}
