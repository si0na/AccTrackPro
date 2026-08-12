import {
  Injectable, UnauthorizedException, ConflictException, BadRequestException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { DatabaseService } from '../../database/database.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import { EmployeeMasterService } from '../employee-master/employee-master.service';

const ACCESS_EXPIRY_SECS  = parseInt(process.env.ACCESS_TOKEN_EXPIRY_SECS  || '900',    10); // 15 min
const REFRESH_EXPIRY_SECS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_SECS || '604800', 10); // 7 days
const MAX_ATTEMPTS        = parseInt(process.env.MAX_LOGIN_ATTEMPTS         || '5',      10);
const LOCKOUT_MINS        = parseInt(process.env.LOCKOUT_DURATION_MINUTES   || '15',     10);
const BCRYPT_ROUNDS       = parseInt(process.env.BCRYPT_ROUNDS              || '12',     10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
    private readonly bus: NotificationEventBus,
    private readonly employeeMasterService: EmployeeMasterService,
  ) {}

  // ─── Cookie helpers ─────────────────────────────────────────────────────────

  private isProd(): boolean { return process.env.NODE_ENV === 'production'; }

  private accessCookieOpts() {
    return {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax' as const,
      path: '/',
      maxAge: ACCESS_EXPIRY_SECS * 1000,
    };
  }

  private refreshCookieOpts() {
    return {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax' as const,
      path: '/api/auth',   // Only sent to /api/auth/* endpoints
      maxAge: REFRESH_EXPIRY_SECS * 1000,
    };
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('crm_access',  { ...this.accessCookieOpts(),  maxAge: 0 });
    res.clearCookie('crm_refresh', { ...this.refreshCookieOpts(), maxAge: 0 });
  }

  // ─── Token helpers ───────────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex'); // 64 hex chars
  }

  private async issueTokenPair(
    res: Response, userId: string, email: string, name: string, role: string,
    roleId: string | null, ip: string, userAgent: string,
  ): Promise<void> {
    // Short-lived access token (JWT, 15 min)
    const accessJwt = this.jwtService.sign(
      { sub: userId, email, name, role, roleId, type: 'access' },
      { secret: process.env.JWT_SECRET, expiresIn: ACCESS_EXPIRY_SECS },
    );

    // Opaque refresh token — stored as SHA-256 hash in DB
    const rawRefresh = this.generateRawToken();
    const refreshHash = this.hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_SECS * 1000);

    await this.db.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5)`,
      [userId, refreshHash, expiresAt, ip, userAgent.slice(0, 500)],
    );

    res.cookie('crm_access',  accessJwt,   this.accessCookieOpts());
    res.cookie('crm_refresh', rawRefresh,  this.refreshCookieOpts());
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async register(
    name: string, email: string, password: string, avatarData?: string,
  ): Promise<Record<string, unknown>> {
    // Only employees listed in employee_master may register
    const authorized = await this.employeeMasterService.findByEmail(email);
    if (!authorized) {
      throw new ForbiddenException(
        'Registration is restricted to authorized employees only. ' +
        'Please contact your administrator to be added to the employee list.',
      );
    }

    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('An account already exists for this email address');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Inherit any role / department / designation the administrator pre-assigned
    // on the employee_master (whitelist) record. Resolve the role's display name
    // so the denormalised users.role text (JWT display claim) stays in sync.
    let roleName: string | null = null;
    if (authorized.roleId) {
      const { rows } = await this.db.query(`SELECT name FROM roles WHERE id = $1`, [authorized.roleId]);
      roleName = rows[0]?.name ?? null;
    }
    const user = await this.usersService.create({
      name, email, passwordHash, avatarData,
      role:        roleName ?? undefined,
      roleId:      authorized.roleId ?? null,
      employeeId:  authorized.employeeId ?? null,
      department:  authorized.department ?? null,
      designation: authorized.designation ?? null,
    });

    // Copy multiple preassigned roles from employee_roles to user_roles
    const { rows: preassignedRoles } = await this.db.query(
      `SELECT role_id FROM employee_roles WHERE employee_id = $1`,
      [authorized.id],
    );
    const roleIdsToAssign = new Set<string>(preassignedRoles.map((r) => r.role_id));
    if (authorized.roleId) {
      roleIdsToAssign.add(authorized.roleId);
    }
    for (const rId of roleIdsToAssign) {
      await this.db.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [user.id, rId],
      );
    }

    await this.audit('register', user.id, email, '', '', true, {});

    this.bus.emit({
      userId:               user.id,
      type:                 'System',
      eventType:            'Registered',
      title:                'Welcome to AccTrack Pro',
      message:              `Your account has been created successfully. Welcome, ${name}!`,
      severity:             'Success',
      notificationCategory: 'SYSTEM',
    });

    // Return only safe fields — never expose hash
    const { passwordHash: _, failedAttempts: __, lockedUntil: ___, ...safeUser } = user;
    return safeUser;
  }

  async login(
    email: string, password: string, res: Response, ip: string, userAgent: string,
  ): Promise<{ user: Record<string, unknown> }> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      // Constant-time: still run bcrypt compare even when user not found (prevent timing attacks)
      await bcrypt.compare(password, '$2b$12$invalidhashpadding00000000000000000000000000000000000');
      await this.audit('login_failed', null, email, ip, userAgent, false, { reason: 'user_not_found' });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check lockout before touching the hash
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      await this.audit('login_blocked', user.id, email, ip, userAgent, false, {
        reason: 'account_locked', remainingMinutes: remaining,
      });
      throw new UnauthorizedException(
        `Account temporarily locked. Try again in ${remaining} minute(s).`,
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      const newAttempts = (user.failedAttempts || 0) + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINS * 60 * 1000);
        await this.usersService.lockAccount(user.id, lockedUntil, newAttempts);
        await this.audit('account_locked', user.id, email, ip, userAgent, false, {
          reason: 'too_many_attempts', attempts: newAttempts, lockoutMinutes: LOCKOUT_MINS,
        });
        throw new UnauthorizedException(
          `Too many failed attempts. Account locked for ${LOCKOUT_MINS} minutes.`,
        );
      }

      await this.usersService.incrementFailedAttempts(user.id, newAttempts);
      await this.audit('login_failed', user.id, email, ip, userAgent, false, {
        reason: 'invalid_password', attempts: newAttempts, remaining: MAX_ATTEMPTS - newAttempts,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Success
    await this.usersService.onLoginSuccess(user.id);
    await this.issueTokenPair(res, user.id, user.email, user.name, user.role, user.roleId ?? null, ip, userAgent);
    await this.audit('login', user.id, email, ip, userAgent, true, {});

    const { passwordHash: _, failedAttempts: __, lockedUntil: ___, ...safeUser } = user;
    return { user: safeUser };
  }

  async refresh(rawRefreshToken: string | undefined, res: Response, ip: string, userAgent: string): Promise<void> {
    if (!rawRefreshToken) throw new UnauthorizedException('No refresh token provided');

    const hash = this.hashToken(rawRefreshToken);

    const { rows } = await this.db.query(
      `SELECT rt.id, rt.user_id,
              u.id AS uid, u.email, u.name, u.role, u.role_id, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
         AND rt.expires_at > NOW()
         AND rt.revoked_at IS NULL`,
      [hash],
    );

    if (!rows.length) throw new UnauthorizedException('Invalid or expired session');

    const row = rows[0];
    if (!row.is_active) {
      // Revoke and reject
      await this.db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
        [row.id],
      );
      throw new UnauthorizedException('Account deactivated');
    }

    // Rotate: revoke old token, issue new pair
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [row.id],
    );
    await this.issueTokenPair(res, row.uid, row.email, row.name, row.role, row.role_id ?? null, ip, userAgent);
    await this.audit('token_refreshed', row.uid, row.email, ip, userAgent, true, {});
  }

  async logout(
    rawRefreshToken: string | undefined, userId: string | undefined,
    res: Response, ip: string, userAgent: string,
  ): Promise<void> {
    if (rawRefreshToken) {
      const hash = this.hashToken(rawRefreshToken);
      await this.db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
        [hash],
      );
    }
    this.clearAuthCookies(res);

    if (userId) {
      const user = await this.usersService.findById(userId);
      await this.audit('logout', userId, user?.email ?? '', ip, userAgent, true, {});
    }
  }

  async me(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const { passwordHash: _, failedAttempts: __, lockedUntil: ___, ...safeUser } = user;
    return safeUser;
  }

  async updateAvatar(userId: string, avatarData: string): Promise<Record<string, unknown>> {
    return this.usersService.updateAvatar(userId, avatarData);
  }

  async changePassword(
    userId: string, currentPassword: string, newPassword: string,
    res: Response, ip: string, userAgent: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      await this.audit('password_change_failed', userId, user.email, ip, userAgent, false, {
        reason: 'invalid_current_password',
      });
      throw new BadRequestException('Current password is incorrect');
    }

    // Prevent re-use of the same password
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must differ from the current password');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePassword(userId, newHash);

    // Invalidate all sessions — user must re-authenticate everywhere
    await this.revokeAllRefreshTokens(userId);
    this.clearAuthCookies(res);

    await this.audit('password_changed', userId, user.email, ip, userAgent, true, {});

    this.bus.emit({
      userId,
      type:                 'System',
      eventType:            'PasswordChanged',
      title:                'Password Changed',
      message:              'Your password has been changed successfully. All other sessions have been signed out.',
      severity:             'Warning',
      notificationCategory: 'SYSTEM',
    });
  }

  async forgotPassword(email: string, ip: string, userAgent: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Always respond identically — do not reveal whether email exists
    if (!user || !user.isActive) return;

    // Invalidate any outstanding reset tokens for this user
    await this.db.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    const rawToken  = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.db.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    await this.audit('password_reset_requested', user.id, email, ip, userAgent, true, {});

    if (process.env.NODE_ENV !== 'production') {
      // In production, send via email (SMTP/SendGrid/etc.)
      this.logger.warn(
        `[DEV] Password reset token for <${email}>: ${rawToken}  (expires ${expiresAt.toISOString()})`,
      );
    }
  }

  async resetPassword(token: string, newPassword: string, ip: string, userAgent: string): Promise<void> {
    const tokenHash = this.hashToken(token);

    const { rows } = await this.db.query(
      `SELECT prt.id, u.id AS uid, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.expires_at > NOW()
         AND prt.used_at IS NULL`,
      [tokenHash],
    );

    if (!rows.length) throw new BadRequestException('Invalid or expired reset token');

    const row = rows[0];

    // Mark token as consumed
    await this.db.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id],
    );

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePassword(row.uid, newHash);

    // Force re-login on all devices
    await this.revokeAllRefreshTokens(row.uid);

    await this.audit('password_reset', row.uid, row.email, ip, userAgent, true, {});

    this.bus.emit({
      userId:               row.uid,
      type:                 'System',
      eventType:            'PasswordReset',
      title:                'Password Reset',
      message:              'Your password has been reset successfully. Please sign in with your new password.',
      severity:             'Warning',
      notificationCategory: 'SYSTEM',
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  private async audit(
    event: string, userId: string | null, email: string,
    ip: string, userAgent: string, success: boolean, details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO auth_audit_log
           (id, event, user_id, email, ip_address, user_agent, success, details)
         VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7)`,
        [event, userId, email, ip, userAgent.slice(0, 500), success, JSON.stringify(details)],
      );
    } catch (err) {
      // Audit failure must never break the auth flow
      this.logger.error('Audit log write failed', err);
    }
  }
}
