import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Right-aligned action buttons (stack under the title on mobile). */
  actions?: React.ReactNode;
  /** Accent color of the title's left border. */
  accent?: 'blue' | 'slate';
  /** Optional icon rendered inline before the title text. */
  icon?: React.ReactNode;
}

/**
 * Standard page header: accent-bordered title, muted subtitle, and an actions
 * slot that collapses below the title on small screens.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  accent = 'blue',
  icon,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="min-w-0">
      <h2
        className={`text-page-title font-bold text-slate-900 tracking-tight border-l-4 pl-3 flex items-center gap-2 ${
          accent === 'slate' ? 'border-slate-900' : 'border-blue-600'
        }`}
      >
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {subtitle && <p className="text-body text-slate-500 font-medium mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
