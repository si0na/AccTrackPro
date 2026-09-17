/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Stakeholder, ServiceProviderUser } from '@/types';

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface StakeholderItem {
  id: string;
  name: string;
  designation?: string;
  department?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  influence?: string;
}

export interface StakeholdersCellProps {
  /** CLIENT stakeholders */
  stakeholders?: Stakeholder[];
  /** Service Provider system users */
  serviceProviders?: ServiceProviderUser[];
  /** Mode tone */
  type?: 'client' | 'service-provider';
  /** Max visible pills before "+N more" overflow count */
  maxAvatars?: number;
  /** Alias for maxAvatars */
  maxVisible?: number;
  /** Empty state label */
  emptyLabel?: string;
}

export const StakeholdersCell: React.FC<StakeholdersCellProps> = ({
  stakeholders = [],
  serviceProviders = [],
  type = 'client',
  maxAvatars,
  maxVisible = 2,
  emptyLabel = type === 'client' ? 'No client stakeholders' : 'No SP stakeholders',
}) => {
  const limit = maxAvatars ?? maxVisible;
  const [expanded, setExpanded] = useState(false);

  // Combine and normalize stakeholder items from both props without duplication
  const items: StakeholderItem[] = useMemo(() => {
    if (type === 'client') {
      return stakeholders.map((s) => ({
        id: s.id,
        name: s.name,
        designation: s.designation,
        department: s.department,
        email: s.email,
        phone: s.phone,
        relationship: s.relationship,
        influence: s.influence,
      }));
    }

    const list: StakeholderItem[] = [];
    const seenEmails = new Set<string>();
    const seenIds = new Set<string>();

    for (const s of stakeholders) {
      if (s.id) seenIds.add(s.id);
      if (s.email) seenEmails.add(s.email.toLowerCase());
      list.push({
        id: s.id,
        name: s.name,
        designation: s.designation,
        department: s.department,
        email: s.email,
        phone: s.phone,
      });
    }

    for (const sp of serviceProviders) {
      if (seenIds.has(sp.id) || (sp.email && seenEmails.has(sp.email.toLowerCase()))) {
        continue;
      }
      list.push({
        id: sp.id,
        name: sp.name,
        designation: sp.designation,
        department: sp.department,
        email: sp.email,
      });
    }

    return list;
  }, [stakeholders, serviceProviders, type]);

  if (items.length === 0) {
    return <span className="text-slate-400 font-normal italic text-xs">{emptyLabel}</span>;
  }

  const isClient = type === 'client';
  const visibleItems = expanded ? items : items.slice(0, limit);
  const overflowCount = items.length - limit;

  const badgeBg = isClient
    ? 'bg-blue-50 hover:bg-blue-100/90 text-blue-800 border-blue-200/90'
    : 'bg-indigo-50 hover:bg-indigo-100/90 text-indigo-800 border-indigo-200/90';
  const avatarBg = isClient ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white';

  return (
    <div className="inline-block max-w-[280px]">
      <div className="flex flex-wrap items-center gap-1.5 py-0.5">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${badgeBg}`}
            title={`${item.name}${item.designation ? ` (${item.designation})` : ''}${item.email ? ` • ${item.email}` : ''}`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-extrabold shrink-0 shadow-2xs ${avatarBg}`}>
              {getInitials(item.name)}
            </span>
            <span className="font-bold text-slate-800">{item.name}</span>
            {item.designation && (
              <span className="text-[10px] text-slate-500 font-normal">
                ({item.designation})
              </span>
            )}
          </div>
        ))}

        {!expanded && overflowCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all cursor-pointer hover:scale-105 shadow-2xs ${badgeBg}`}
            title="Click to view all stakeholders"
          >
            <span>+{overflowCount} more</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
        )}

        {expanded && items.length > limit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all cursor-pointer shadow-2xs"
            title="Click to show less"
          >
            <span>Show less</span>
            <ChevronUp className="w-3 h-3 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
};
