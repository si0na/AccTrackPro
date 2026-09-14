import { Injectable } from '@nestjs/common';

const PRESENCE_THRESHOLD_MS = 45_000; // 45 seconds threshold

@Injectable()
export class PresenceService {
  private readonly userPresenceMap = new Map<string, number>();

  /** Record active presence for a user (called on authenticated requests and heartbeats). */
  recordPresence(userId: string): void {
    if (!userId) return;
    this.userPresenceMap.set(userId, Date.now());
  }

  /** Immediately clear presence for a user (called on explicit logout). */
  clearPresence(userId: string): void {
    if (!userId) return;
    this.userPresenceMap.delete(userId);
  }

  /** Returns true if the user sent an authenticated request or heartbeat within the last 45 seconds. */
  isUserOnline(userId: string | null | undefined): boolean {
    if (!userId) return false;
    const lastActive = this.userPresenceMap.get(userId);
    if (!lastActive) return false;
    return Date.now() - lastActive <= PRESENCE_THRESHOLD_MS;
  }
}
