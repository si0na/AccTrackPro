import React from 'react';
import { Info } from 'lucide-react';
import type { ProjectHealth, SqaWeeklyHealth } from '@/types';
import { HEALTH_COLORS, SELECT_CLS, StatusBadge } from '@/components/ui';
import { SQA_WEEK_HEALTH_CHOICES } from '@/constants';

/**
 * Renders one week's RAG badge for a table cell.
 *
 * A carried-forward week — no health entry of its own, so the previous week's
 * status still stands — is shown muted with a "held" marker rather than as a
 * fresh reading, so a stale RAG can't be mistaken for this week's assessment.
 */
export const SqaWeekHealthCell: React.FC<{ week?: SqaWeeklyHealth }> = ({ week }) => {
  if (!week || !week.health) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <StatusBadge value={week.health} colorMap={HEALTH_COLORS} muted={week.carriedForward} />
      {week.carriedForward && (
        <span
          className="text-[9px] font-bold text-slate-400 uppercase tracking-wide"
          title="No health update this week — the previous week's status still stands."
        >
          held
        </span>
      )}
    </span>
  );
};

export interface SqaWeeklyHealthGridProps {
  /** The record's trailing weeks, oldest first. */
  weeks: SqaWeeklyHealth[];
  /**
   * Called when a week's RAG is changed. Omit (or pass `readOnly`) to render the
   * grid as badges only.
   */
  onChange?: (week: SqaWeeklyHealth, health: ProjectHealth) => void;
  readOnly?: boolean;
  /** Week keys currently being saved, as `${isoYear}-${weekNumber}`. */
  savingKeys?: Set<string>;
  className?: string;
}

export const weekKey = (w: { isoYear: number; weekNumber: number }) => `${w.isoYear}-${w.weekNumber}`;

/**
 * The "Health Week 31 / 32 / 33 / …" panel.
 *
 * The weeks are whatever the server sent — never a hardcoded 31/32/33 — so the
 * grid rolls forward on its own and widens with the record's `weeks` setting.
 * Each value is stored in the project's own Project Health trail, which is why
 * editing here shows up on the project's Health Tracker too; the note at the
 * bottom says so, since that is a surprising side effect otherwise.
 */
export const SqaWeeklyHealthGrid: React.FC<SqaWeeklyHealthGridProps> = ({
  weeks,
  onChange,
  readOnly = false,
  savingKeys,
  className = '',
}) => {
  const editable = !readOnly && !!onChange;

  if (!weeks.length) {
    return (
      <p className={`text-xs text-slate-400 font-medium italic ${className}`}>
        No weekly health window available yet.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {weeks.map((week) => {
          const isSaving = savingKeys?.has(weekKey(week)) ?? false;
          return (
            <div
              key={weekKey(week)}
              className="border border-slate-200 rounded-lg p-3 bg-white min-w-0"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="text-label font-bold text-slate-500 uppercase tracking-wide">
                  Health {week.label}
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {week.weekStart}
                </span>
              </div>

              {editable ? (
                <>
                  <select
                    className={SELECT_CLS}
                    aria-label={`Health ${week.label}`}
                    disabled={isSaving}
                    value={week.health ?? ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      onChange!(week, e.target.value as ProjectHealth);
                    }}
                  >
                    <option value="">Not set</option>
                    {SQA_WEEK_HEALTH_CHOICES.map((h) => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                  {week.carriedForward && week.health && (
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-tight">
                      Carried over from an earlier week — save to pin it to {week.label}.
                    </p>
                  )}
                  {isSaving && (
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Saving…</p>
                  )}
                </>
              ) : (
                <div className="pt-0.5">
                  <SqaWeekHealthCell week={week} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-tight">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" aria-hidden="true" />
        <span>
          Weekly health is stored in the project's own Project Health tracker — SQA
          reads and writes the same history, so both always agree. A week shown as
          <span className="font-semibold"> held</span> has no update of its own and
          keeps the previous week's status.
        </span>
      </p>
    </div>
  );
};
