/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdminUser, ProjectTeamMember } from '@/types';

export interface OwnerOption {
  value: string;
  label: string;
}

export const buildOwnerOptions = (
  users: AdminUser[],
  teamMembers?: ProjectTeamMember[]
): { teamOptions: OwnerOption[]; systemOptions: OwnerOption[] } => {
  const teamOptions: OwnerOption[] = [];
  const systemOptions: OwnerOption[] = [];
  const teamUserIds = new Set<string>();

  if (teamMembers && teamMembers.length > 0) {
    teamMembers.forEach((member) => {
      // Find matching system user by name or id
      const matchedUser = users.find(
        (u) =>
          u.name.toLowerCase().trim() === member.employeeName.toLowerCase().trim() ||
          u.id === member.id
      );

      const val = matchedUser ? matchedUser.id : member.employeeName;
      if (matchedUser) {
        teamUserIds.add(matchedUser.id);
      }

      const roleSuffix = member.role ? ` (${member.role})` : '';
      teamOptions.push({
        value: val,
        label: `${member.employeeName}${roleSuffix}`,
        rawName: member.employeeName,
      } as OwnerOption & { rawName: string });
    });
  }

  // System users not in team
  users.forEach((u) => {
    if (!teamUserIds.has(u.id)) {
      systemOptions.push({
        value: u.id,
        label: u.name,
      });
    }
  });

  teamOptions.sort((a, b) => ((a as any).rawName || a.label).localeCompare(((b as any).rawName || b.label), undefined, { sensitivity: 'base' }));
  systemOptions.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return { teamOptions, systemOptions };
};
