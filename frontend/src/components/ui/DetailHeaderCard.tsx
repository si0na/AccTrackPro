import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from './Card';
import { InfoBlock, InfoBlockProps } from './InfoBlock';

export interface DetailHeaderCardProps {
  /** Renders the back-arrow button when provided (typically hidden when arriving from a cross-module nav source). */
  onBack?: () => void;
  backTitle?: string;
  /** Content of the identity chip (initials, an icon, ...). */
  avatarContent: React.ReactNode;
  /** Tailwind bg/text classes for the identity chip. */
  avatarColorClass?: string;
  title: string;
  /** Badges rendered immediately after the title (e.g. type/health/stage StatusBadges). */
  badges?: React.ReactNode;
  /** Subtitle/description line under the title. */
  description?: React.ReactNode;
  /** Right-aligned action buttons/menu. */
  actions?: React.ReactNode;
  attributes: InfoBlockProps[];
  /** Grid column classes for the attribute strip. */
  attributesClassName?: string;
}

/**
 * Shared entity-detail header: back button, identity chip, title/badges,
 * description, right-aligned actions, and an attribute strip of InfoBlocks.
 * Used by Account Detail and Opportunity Detail so both pages share one
 * visual hierarchy instead of maintaining separate header implementations.
 */
export const DetailHeaderCard: React.FC<DetailHeaderCardProps> = ({
  onBack,
  backTitle,
  avatarContent,
  avatarColorClass = 'bg-slate-100 text-slate-700',
  title,
  badges,
  description,
  actions,
  attributes,
  attributesClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
}) => (
  <Card padding="none" className="overflow-visible">
    <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-5">
      <div className="flex items-start gap-4 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 mt-0.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 cursor-pointer shrink-0"
            title={backTitle}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-lg tracking-tight ${avatarColorClass}`}>
          {avatarContent}
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight truncate">{title}</h2>
            {badges}
          </div>
          {description && (
            <p className="text-xs text-slate-500 font-medium mt-1.5 max-w-xl leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>

    {/* Attribute strip — equal-width info blocks, balanced spacing */}
    <div className={`px-6 py-5 border-t border-slate-100 bg-slate-50/50 grid ${attributesClassName} gap-x-4 gap-y-5`}>
      {attributes.map((attr, i) => (
        <InfoBlock key={i} {...attr} />
      ))}
    </div>
  </Card>
);
