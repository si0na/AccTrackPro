import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { PresenceService } from '../presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    service = new PresenceService();
  });

  it('returns false for unknown or empty user IDs', () => {
    expect(service.isUserOnline('')).toBe(false);
    expect(service.isUserOnline(null)).toBe(false);
    expect(service.isUserOnline(undefined)).toBe(false);
    expect(service.isUserOnline('unknown-user-id')).toBe(false);
  });

  it('marks a user as online when presence is recorded', () => {
    service.recordPresence('user-1');
    expect(service.isUserOnline('user-1')).toBe(true);
  });

  it('marks a user as offline after 45 seconds of inactivity', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    service.recordPresence('user-1');
    expect(service.isUserOnline('user-1')).toBe(true);

    // Fast-forward 46 seconds
    jest.spyOn(Date, 'now').mockReturnValue(now + 46_000);
    expect(service.isUserOnline('user-1')).toBe(false);

    jest.restoreAllMocks();
  });

  it('immediately marks a user as offline when clearPresence is called', () => {
    service.recordPresence('user-1');
    expect(service.isUserOnline('user-1')).toBe(true);

    service.clearPresence('user-1');
    expect(service.isUserOnline('user-1')).toBe(false);
  });
});
