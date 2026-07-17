import React from 'react';

export type CardTone = 'blue' | 'emerald' | 'purple' | 'amber' | 'indigo' | 'slate';

export interface CardProps {
  /** Optional heading rendered in a bordered card header band. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned slot next to the title, e.g. a Button or icon toggle. */
  actions?: React.ReactNode;
  /** Optional footer band, bordered off from the body. */
  footer?: React.ReactNode;
  /** Padding density for the body. 'none' is for cards that host a <table> or
   *  other full-bleed content and manage their own inner spacing. */
  padding?: 'none' | 'compact' | 'cozy';
  /** Adds overflow-hidden — needed whenever body content (e.g. a table) has
   *  its own square corners that must be clipped to the card's rounding. */
  clip?: boolean;
  /** Tints the card with a soft gradient + matching border instead of flat
   *  white — used for KPI/summary-style cards. Omit for the standard surface. */
  tone?: CardTone;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}

const PADDING_CLS: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  compact: 'p-4',
  cozy: 'p-5',
};

const TONE_CLS: Record<CardTone, string> = {
  blue: 'bg-gradient-to-br from-blue-50/80 to-white border-blue-200/70',
  emerald: 'bg-gradient-to-br from-emerald-50/80 to-white border-emerald-200/70',
  purple: 'bg-gradient-to-br from-purple-50/80 to-white border-purple-200/70',
  amber: 'bg-gradient-to-br from-amber-50/80 to-white border-amber-200/70',
  indigo: 'bg-gradient-to-br from-indigo-50/80 to-white border-indigo-200/70',
  slate: 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
};

/**
 * Standard white surface card used across every feature view: rounded-xl,
 * slate-200/80 border, shadow-sm. Optional header (title/subtitle/actions)
 * and footer bands let a table or content list sit edge-to-edge inside
 * `padding="none"`. Pass `tone` for a softly tinted KPI/summary variant.
 */
export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  footer,
  padding = 'cozy',
  clip = false,
  tone,
  className = '',
  bodyClassName = '',
  children,
}) => (
  <div
    className={`rounded-xl border shadow-sm ${
      tone ? TONE_CLS[tone] : 'bg-white border-slate-200/80'
    } ${clip ? 'overflow-hidden' : ''} ${className}`}
  >
    {(title || actions) && (
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {typeof title === 'string' ? (
            <h3 className="text-section-title font-semibold text-slate-800 tracking-tight truncate">{title}</h3>
          ) : (
            title
          )}
          {subtitle && <p className="text-body text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    )}
    <div className={`${PADDING_CLS[padding]} ${bodyClassName}`}>{children}</div>
    {footer && <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">{footer}</div>}
  </div>
);
