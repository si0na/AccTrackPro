import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import * as bcrypt from 'bcrypt';

describe('AuthService - Password Reset Flow', () => {
  let service: AuthService;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockDb: any;
  let mockBus: any;
  let mockEmployeeMasterService: any;
  let mockGraphMailService: any;

  beforeEach(() => {
    mockUsersService = {
      findByEmail: jest.fn(),
      updatePassword: jest.fn(),
    };
    mockJwtService = {};
    mockDb = {
      query: jest.fn() as any,
      withTransaction: jest.fn(async (fn: any) => {
        // mock transactional wrapper
        const client = {
          query: jest.fn() as any,
        };
        return fn(client);
      }) as any,
    };
    mockBus = {
      emit: jest.fn(),
    };
    mockEmployeeMasterService = {};
    mockGraphMailService = {
      sendMail: jest.fn(),
    };

    service = new AuthService(
      mockUsersService,
      mockJwtService,
      mockDb,
      mockBus,
      mockEmployeeMasterService,
      mockGraphMailService,
    );
  });

  describe('forgotPassword', () => {
    it('should return immediately and not send email if user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.forgotPassword('unknown@example.com', '127.0.0.1', 'Mozilla')).resolves.not.toThrow();

      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockGraphMailService.sendMail).not.toHaveBeenCalled();
    });

    it('should return immediately and not send email if user is inactive', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', isActive: false });

      await expect(service.forgotPassword('inactive@example.com', '127.0.0.1', 'Mozilla')).resolves.not.toThrow();

      expect(mockDb.query).not.toHaveBeenCalled();
      expect(mockGraphMailService.sendMail).not.toHaveBeenCalled();
    });

    it('should enforce cooldown and not send email if requested too quickly', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', isActive: true, email: 'user@example.com', name: 'User' });
      // Recent request 30 seconds ago
      mockDb.query.mockResolvedValueOnce({
        rows: [{ created_at: new Date(Date.now() - 30 * 1000).toISOString() }],
      });

      await expect(service.forgotPassword('user@example.com', '127.0.0.1', 'Mozilla')).resolves.not.toThrow();

      // Should only have queried recent requests, not inserted token or sent email
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockGraphMailService.sendMail).not.toHaveBeenCalled();
    });

    it('should generate token, hash it, store it in DB, and send email if user is active and cooldown has passed', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u1', isActive: true, email: 'user@example.com', name: 'User' });
      // No recent requests
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // recent request check
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // invalidate previous tokens
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // insert new token

      mockGraphMailService.sendMail.mockResolvedValue(true);

      await expect(service.forgotPassword('user@example.com', '127.0.0.1', 'Mozilla')).resolves.not.toThrow();

      // Check that it queried database to insert token
      expect(mockDb.query).toHaveBeenCalledTimes(4);
      const insertCall = (mockDb.query.mock.calls as any)[2];
      expect(insertCall[0]).toContain('INSERT INTO password_reset_tokens');
      // inserted token_hash must be SHA-256 hash (64 hex characters)
      expect(insertCall[1][1]).toMatch(/^[a-f0-9]{64}$/);

      // Verify email send
      expect(mockGraphMailService.sendMail).toHaveBeenCalledTimes(1);
      expect(mockGraphMailService.sendMail.mock.calls[0][0]).toBe('user@example.com');
      expect(mockGraphMailService.sendMail.mock.calls[0][1]).toBe('AccTrack Pro – Password Reset Request');
      expect(mockGraphMailService.sendMail.mock.calls[0][2]).toContain('Reset Password');
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException if token is invalid or expired', async () => {
      // Mock db.withTransaction query to return empty rows (token not found/used/expired)
      mockDb.withTransaction.mockImplementationOnce(async (fn: any) => {
        const client = {
          query: (jest.fn() as any).mockResolvedValueOnce({ rows: [] }),
        };
        return fn(client);
      });

      await expect(service.resetPassword('token-123', 'newPassword123', '127.0.0.1', 'Mozilla')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reset password, invalidate other tokens, and revoke refresh tokens on valid request', async () => {
      const mockClient = {
        query: jest.fn() as any,
      };

      mockClient.query
        // 1. Select token record
        .mockResolvedValueOnce({
          rows: [{ id: 'token-rec-id', uid: 'user-123', email: 'user@example.com' }],
        })
        // 2. Mark token as consumed
        .mockResolvedValueOnce({ rows: [] })
        // 3. Invalidate other active tokens
        .mockResolvedValueOnce({ rows: [] })
        // 4. Update user's password hash
        .mockResolvedValueOnce({ rows: [] })
        // 5. Revoke sessions/refresh tokens
        .mockResolvedValueOnce({ rows: [] })
        // 6. Write audit log
        .mockResolvedValueOnce({ rows: [] });

      mockDb.withTransaction.mockImplementationOnce(async (fn: any) => {
        return fn(mockClient);
      });

      await expect(service.resetPassword('token-123', 'newPassword123', '127.0.0.1', 'Mozilla')).resolves.not.toThrow();

      // Verify update password query was executed with bcrypt hash
      const updatePasswordCall = (mockClient.query.mock.calls as any)[3];
      expect(updatePasswordCall[0]).toContain('UPDATE users SET password_hash = $1');
      const hash = updatePasswordCall[1][0];
      expect(await bcrypt.compare('newPassword123', hash)).toBe(true);

      // Verify revoke sessions query
      const revokeCall = (mockClient.query.mock.calls as any)[4];
      expect(revokeCall[0]).toContain('UPDATE refresh_tokens SET revoked_at = NOW()');

      // Verify event bus notification emitted
      expect(mockBus.emit).toHaveBeenCalledTimes(1);
      expect(mockBus.emit.mock.calls[0][0].eventType).toBe('PasswordReset');
    });
  });
});
