import React from 'react';
import { Card, CardTone } from './Card';

export interface SummaryCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** Colors the icon chip and the card's background tint. Defaults to blue. */
  tone?: CardTone;
  /** Short secondary line under the value, e.g. "No pending items". */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Adds a red ring + pulsing corner indicator for KPIs that need immediate attention (e.g. an overdue count > 0). */
  urgent?: boolean;
}

const ICON_CHIP_CLS: Record<CardTone, string> = {
  blue: 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/15',
  emerald: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15',
  purple: 'bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/15',
  amber: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/15',
  indigo: 'bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15',
  slate: 'bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/15',
};

const GLOW_CLS: Record<CardTone, string> = {
  blue: 'bg-blue-400/20',
  emerald: 'bg-emerald-400/20',
  purple: 'bg-purple-400/20',
  amber: 'bg-amber-400/20',
  indigo: 'bg-indigo-400/20',
  slate: 'bg-slate-400/20',
};

/**
 * KPI summary card shared by every detail view's Overview tab — colored icon
 * chip + big value, optionally an actionable drill-down footer link.
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  icon,
  tone = 'blue',
  description,
  actionLabel,
  onAction,
  urgent = false,
}) => {
  const body = (
    <>
      {/* Soft radial highlight in the corner — purely decorative */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none ${GLOW_CLS[tone]}`} />
      {urgent && (
        <span className="absolute top-3.5 right-3.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white" />
        </span>
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1.5 tracking-tight">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${ICON_CHIP_CLS[tone]}`}>
          {icon}
        </div>
      </div>
      {description && <p className="relative mt-1.5 text-[11px] text-slate-400 font-medium">{description}</p>}
      {actionLabel && <p className="relative mt-2 text-[11px] text-blue-600 font-semibold">{actionLabel} →</p>}
    </>
  );

  return (
    <Card
      padding="cozy"
      tone={tone}
      className={`relative overflow-hidden ${
        onAction ? 'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200' : ''
      } ${urgent ? 'ring-2 ring-red-400/40 ring-offset-2 ring-offset-white' : ''}`}
    >
      {onAction ? (
        <button
          onClick={onAction}
          className="relative w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded-xl"
        >
          {body}
        </button>
      ) : (
        body
      )}
    </Card>
  );
};
