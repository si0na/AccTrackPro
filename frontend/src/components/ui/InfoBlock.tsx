import React from 'react';

export interface InfoBlockProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Renders the value in a monospace font — numbers, phone numbers, dates. */
  mono?: boolean;
  /** Renders the value as an external link. */
  href?: string;
  /** Tints the value text blue instead of the default slate. */
  accent?: boolean;
  className?: string;
}

/**
 * Icon + label + value block used across every entity detail page's header
 * attribute strip and contact/summary panels — the shared building block for
 * "information at a glance" sections (Account, Opportunity, Stakeholder, …).
 */
export const InfoBlock: React.FC<InfoBlockProps> = ({ icon, label, value, mono, href, accent, className = '' }) => (
  <div className={`flex items-start gap-3 min-w-0 ${className}`}>
    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 whitespace-nowrap">{label}</p>
      {value === undefined || value === null || value === '' ? (
        <p className="text-xs text-slate-300 italic">Not set</p>
      ) : href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-xs truncate block">
          {value}
        </a>
      ) : (
        <p className={`text-xs font-bold truncate ${accent ? 'text-blue-600' : 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      )}
    </div>
  </div>
);
