import React from 'react';
import type {
  AccountHealth,
  AccountType,
  ActionItemStatus,
  InfluenceLevel,
  OpportunityStage,
  OpportunityStatus,
  PriorityLevel,
  RelationshipStatus,
} from '@/types';

export type BadgeShape = 'pill' | 'rounded';

export interface StatusBadgeProps {
  /** Value to display; color is resolved from `colorMap` (falls back to slate). */
  value: string;
  colorMap: Record<string, string>;
  shape?: BadgeShape;
  /** Muted rendering for deactivated/soft-deleted rows. */
  muted?: boolean;
  className?: string;
}

const FALLBACK = 'bg-slate-100 text-slate-700';

/**
 * Standard colored pill for enum-like values (health, stage, priority, …).
 * The domain color maps below are the single source of truth — views must not
 * re-declare per-value ternaries.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  value,
  colorMap,
  shape = 'pill',
  muted = false,
  className = '',
}) => (
  <span
    className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap ${
      shape === 'pill' ? 'rounded-full' : 'rounded'
    } ${colorMap[value] ?? FALLBACK} ${muted ? 'opacity-60' : ''} ${className}`}
  >
    {value}
  </span>
);

// ── Domain color maps ────────────────────────────────────────────────────────

export const HEALTH_COLORS: Record<AccountHealth, string> = {
  Healthy: 'bg-green-100 text-green-700',
  'At Risk': 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  Growth: 'bg-blue-100 text-blue-700',
  Pursuit: 'bg-purple-100 text-purple-700',
  Project: 'bg-emerald-100 text-emerald-700',
};

export const STAGE_COLORS: Record<OpportunityStage, string> = {
  Won: 'bg-green-100 text-green-700',
  Negotiation: 'bg-blue-100 text-blue-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Qualified: 'bg-yellow-100 text-yellow-700',
  Lead: 'bg-slate-100 text-slate-700',
};

export const OPPORTUNITY_STATUS_COLORS: Record<OpportunityStatus, string> = {
  Won: 'bg-emerald-100 text-emerald-700',
  Lost: 'bg-red-100 text-red-700',
  Open: 'bg-sky-100 text-sky-700',
};

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  High: 'bg-red-50 text-red-600',
  Medium: 'bg-orange-50 text-orange-600',
  Low: 'bg-green-50 text-green-600',
};

export const ACTION_STATUS_COLORS: Record<ActionItemStatus, string> = {
  Completed: 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Blocked: 'bg-red-100 text-red-700',
  'Not Started': 'bg-slate-100 text-slate-600',
};

export const INFLUENCE_COLORS: Record<InfluenceLevel, string> = {
  High: 'bg-red-50 text-red-600',
  Medium: 'bg-orange-50 text-orange-600',
  Low: 'bg-green-50 text-green-600',
};

export const RELATIONSHIP_COLORS: Record<RelationshipStatus, string> = {
  Strong: 'bg-green-100 text-green-700',
  Neutral: 'bg-slate-100 text-slate-600',
  Weak: 'bg-red-100 text-red-700',
};

/** Alert severities (Alerts & Notifications view). */
export const ALERT_SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

/** Notification severities. */
export const NOTIFICATION_SEVERITY_COLORS: Record<string, string> = {
  Error: 'bg-red-100 text-red-700',
  Warning: 'bg-amber-100 text-amber-700',
  Success: 'bg-emerald-100 text-emerald-700',
  Info: 'bg-blue-100 text-blue-700',
};

/** Performance-evaluation retention risk. */
export const RETENTION_RISK_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-emerald-100 text-emerald-700',
};
