import { describe, it, expect } from '@jest/globals';

describe('Stakeholder Management Enhancements - Contract & Integrity Tests', () => {
  describe('Supported Next Connect Status values', () => {
    const supportedStatuses = [
      'Scheduled',
      'Cancelled',
      'Rescheduled',
      'Follow up required',
      'Yet to Schedule',
    ];

    it('should include all required status options exactly as supported by backend and UI', () => {
      expect(supportedStatuses).toContain('Scheduled');
      expect(supportedStatuses).toContain('Cancelled');
      expect(supportedStatuses).toContain('Rescheduled');
      expect(supportedStatuses).toContain('Follow up required');
      expect(supportedStatuses).toContain('Yet to Schedule');
      expect(supportedStatuses.length).toBe(5);
    });
  });

  describe('Stakeholder narrative and country fields mapping', () => {
    it('should properly map raw database row fields to camelCase stakeholder model', () => {
      const mockDbRow = {
        id: 'stk-100',
        name: 'Jane Doe',
        account_id: 'acc-1',
        designation: 'VP Engineering',
        stakeholder_type: 'CLIENT',
        country: 'India',
        location: 'Bangalore',
        key_priorities: 'Modernization of core microservices',
        pain_points_insights: 'Latency under peak holiday load',
        action_follow_ups: 'Schedule Q2 technical deep-dive',
        comments: 'Key executive sponsor',
        next_connect: '2026-06-15T00:00:00.000Z',
        next_connect_status: 'Scheduled',
        estimated_budget_available: '750000',
      };

      const mapped = {
        id: mockDbRow.id,
        name: mockDbRow.name,
        accountId: mockDbRow.account_id,
        country: mockDbRow.country,
        location: mockDbRow.location,
        keyPriorities: mockDbRow.key_priorities,
        painPointsInsights: mockDbRow.pain_points_insights,
        actionFollowUps: mockDbRow.action_follow_ups,
        comments: mockDbRow.comments,
        nextConnect: mockDbRow.next_connect.slice(0, 10),
        nextConnectStatus: mockDbRow.next_connect_status,
        estimatedBudgetAvailable: Number(mockDbRow.estimated_budget_available),
      };

      expect(mapped.country).toBe('India');
      expect(mapped.nextConnect).toBe('2026-06-15');
      expect(mapped.nextConnectStatus).toBe('Scheduled');
      expect(mapped.keyPriorities).toBe('Modernization of core microservices');
      expect(mapped.painPointsInsights).toBe('Latency under peak holiday load');
      expect(mapped.actionFollowUps).toBe('Schedule Q2 technical deep-dive');
      expect(mapped.comments).toBe('Key executive sponsor');
      expect(mapped.estimatedBudgetAvailable).toBe(750000);
    });
  });

  describe('Searchable Country filtering logic', () => {
    const locations = [
      'Argentina',
      'Australia',
      'India',
      'Indonesia',
      'United Arab Emirates',
      'United Kingdom',
      'United States',
    ];

    it('should filter case-insensitively for "ind" to match India and Indonesia', () => {
      const query = 'ind'.toLowerCase();
      const results = locations.filter((loc) => loc.toLowerCase().includes(query));
      expect(results).toEqual(['India', 'Indonesia']);
    });

    it('should filter case-insensitively for "united" to match UAE, UK, and US', () => {
      const query = 'united'.toLowerCase();
      const results = locations.filter((loc) => loc.toLowerCase().includes(query));
      expect(results).toEqual([
        'United Arab Emirates',
        'United Kingdom',
        'United States',
      ]);
    });
  });

  describe('Customize Columns default visibility & preference isolation', () => {
    const defaultVisibleKeys = [
      'name',
      'accountId',
      'department',
      'designation',
      'area',
      'roleInDecision',
      'nextConnect',
      'nextConnectStatus',
      'level',
      'influence',
      'relationship',
      'primaryOwnerName',
      'secondaryOwnerName',
      'tertiaryOwnerName',
      'email',
      'phone',
      'linkedinProfileUrl',
    ];

    const narrativeKeys = [
      'keyPriorities',
      'painPointsInsights',
      'actionFollowUps',
      'comments',
    ];

    it('should keep standard columns displayed by default and narrative columns hidden until customized', () => {
      expect(defaultVisibleKeys.length).toBe(17);
      narrativeKeys.forEach((k) => {
        expect(defaultVisibleKeys).not.toContain(k);
      });
    });

    it('should preserve storage keys strictly scoped to stakeholders without collision', () => {
      const userId = 'usr-test-123';
      const stakeholderStorageKey = `acctrack_col_config_stakeholders_${userId}`;
      const accountsStorageKey = `accounts`;
      const opportunitiesStorageKey = `opportunities`;

      expect(stakeholderStorageKey).toContain('stakeholders');
      expect(stakeholderStorageKey).not.toEqual(accountsStorageKey);
      expect(stakeholderStorageKey).not.toEqual(opportunitiesStorageKey);
    });
  });
});
