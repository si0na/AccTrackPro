/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { OpportunityStage } from '@/types';
import {
  Users,
  CheckCircle2,
  FileText,
  Handshake,
  MessageSquareText,
  Trophy,
  Check,
  Construction,
  Hourglass,
  XCircle,
} from 'lucide-react';

/** The linear business pipeline — the only stages the strip ever renders.
 *  Blocked / Delayed / Lost are operational states layered *over* this
 *  progression, never inserted into it. */
const CORE_STAGES: OpportunityStage[] = [
  'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Verbal Agreement', 'Won',
];

const CORE_META: Record<string, { icon: React.ComponentType<{ className?: string }> }> = {
  Lead: { icon: Users },
  Qualified: { icon: CheckCircle2 },
  Proposal: { icon: FileText },
  Negotiation: { icon: Handshake },
  'Verbal Agreement': { icon: MessageSquareText },
  Won: { icon: Trophy },
};

/**
 * States that sit *on top of* the pipeline as a distinct visual identity:
 * the positive terminal state (Won) and the three operational states
 * (Blocked / Delayed / Lost). Each has its own colour, icon, ribbon and
 * descriptive message so a user can tell them apart without reading a label.
 */
type OverlayState = 'Won' | 'Blocked' | 'Delayed' | 'Lost';

interface OverlayStyle {
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  label: string;
  /** Framing applied to the pipeline container. */
  frame: string;
  /** Ribbon badge in the top-right corner. */
  ribbon: string;
  /** Circle classes for the highlighted (current / last active) stage. */
  node: string;
  /** Label classes for the highlighted stage. */
  nodeLabel: string;
  /** Ring animation behind the highlighted node (empty = none). */
  ring: string;
  /** Message card shown beneath the strip. */
  banner: string;
  /** Icon tint inside the message card. */
  bannerIcon: string;
  /** Primary descriptive line beneath the strip. */
  headline: string;
  /** Optional supporting sentence beneath the headline. */
  secondary?: string;
  /** Label prefixing the free-text reason, when one is present. */
  reasonLabel: string;
}

const OVERLAY_STYLES: Record<OverlayState, OverlayStyle> = {
  Won: {
    icon: Trophy,
    emoji: '🏆',
    label: 'Won',
    frame: 'border-emerald-300 bg-emerald-50/50 shadow-sm shadow-emerald-500/10',
    ribbon: 'bg-emerald-100 border-emerald-300 text-emerald-700',
    node: 'bg-emerald-50 border-emerald-500 text-emerald-600 scale-110 shadow-md shadow-emerald-500/25',
    nodeLabel: 'text-emerald-700',
    ring: 'bg-emerald-400/30 animate-ping',
    banner: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    bannerIcon: 'text-emerald-600',
    headline: 'Opportunity Won',
    secondary: 'This deal has been successfully closed.',
    reasonLabel: 'Win reason',
  },
  Blocked: {
    icon: Construction,
    emoji: '🚧',
    label: 'Blocked',
    frame: 'border-orange-300 bg-orange-50/50 shadow-md shadow-orange-500/20 ring-1 ring-orange-200',
    ribbon: 'bg-orange-100 border-orange-300 text-orange-700',
    node: 'bg-orange-50 border-orange-500 text-orange-600 scale-110 shadow-md shadow-orange-500/25',
    nodeLabel: 'text-orange-700',
    ring: 'bg-orange-400/25',
    banner: 'bg-orange-50 border-orange-200 text-orange-800',
    bannerIcon: 'text-orange-600',
    headline: 'Opportunity is currently Blocked',
    secondary: 'This opportunity cannot progress until the blocking issue is resolved.',
    reasonLabel: 'Blocking reason',
  },
  Delayed: {
    icon: Hourglass,
    emoji: '⏳',
    label: 'Delayed',
    frame: 'border-amber-300 bg-amber-50/50 shadow-sm shadow-amber-500/15',
    ribbon: 'bg-amber-100 border-amber-300 text-amber-700 animate-pulse',
    node: 'bg-amber-50 border-amber-500 text-amber-600 scale-110 shadow-md shadow-amber-500/25',
    nodeLabel: 'text-amber-700',
    ring: 'bg-amber-400/30 animate-pulse',
    banner: 'bg-amber-50 border-amber-200 text-amber-800',
    bannerIcon: 'text-amber-600',
    headline: 'Opportunity has been Delayed',
    secondary: 'This opportunity is temporarily on hold and is expected to resume.',
    reasonLabel: 'Delay reason',
  },
  Lost: {
    icon: XCircle,
    emoji: '❌',
    label: 'Lost',
    frame: 'border-red-300 bg-red-50/50 shadow-sm shadow-red-500/10',
    ribbon: 'bg-red-100 border-red-300 text-red-700',
    node: 'bg-red-50 border-red-500 text-red-600 scale-110 shadow-md shadow-red-500/25',
    nodeLabel: 'text-red-700',
    ring: '',
    banner: 'bg-red-50 border-red-200 text-red-800',
    bannerIcon: 'text-red-600',
    headline: 'Opportunity has been Lost',
    secondary: 'This deal is closed and can no longer progress through the pipeline.',
    reasonLabel: 'Loss reason',
  },
};

const isException = (stage: OpportunityStage): stage is 'Blocked' | 'Delayed' | 'Lost' =>
  stage === 'Blocked' || stage === 'Delayed' || stage === 'Lost';

/**
 * Best-effort mapping of an opportunity's probability onto the business stage
 * it had reached, used only to highlight the pipeline when the deal is in an
 * exception state (Blocked/Delayed/Lost) — the schema stores no prior stage.
 * A pure read-time derivation: no business logic or persisted data is changed.
 * Capped at Negotiation because a deal only sits on Won by being *actually* Won.
 */
const inferActiveStage = (probability: number | undefined): OpportunityStage => {
  const p = typeof probability === 'number' ? probability : 0;
  if (p >= 60) return 'Negotiation';
  if (p >= 40) return 'Proposal';
  if (p >= 20) return 'Qualified';
  return 'Lead';
};

export interface OpportunityPipelineProgressProps {
  stage: OpportunityStage;
  /** Opportunity probability — used only to place the highlight when the deal
   *  is Blocked/Delayed/Lost and no business stage is otherwise recorded. */
  probability?: number;
  /** Why the deal was Won or Lost (the opportunity's closeReason); shown in the
   *  message card for the Won and Lost states. */
  closeReason?: string;
  /** Why the opportunity is currently Blocked (the opportunity's blockedReason);
   *  a business concept distinct from risksAndDependencies. */
  blockedReason?: string;
  /** Why the opportunity has been Delayed (the opportunity's delayedReason);
   *  a business concept distinct from risksAndDependencies. */
  delayedReason?: string;
}

/**
 * Horizontal stage progression for the Opportunity Detail Overview tab.
 *
 * The strip always renders the six business stages
 * (Lead → Qualified → Proposal → Negotiation → Verbal Agreement → Won) and
 * never anything else.
 * The four terminal / operational states each get a unique visual identity —
 * a coloured frame, a ribbon badge with its own icon, distinct node styling and
 * a descriptive message card — so Won, Blocked, Delayed and Lost are instantly
 * distinguishable without relying on colour or reading the label:
 *
 *   • Won     — green success frame, trophy, celebratory ring
 *   • Blocked — orange warning frame + glow, construction/barrier icon
 *   • Delayed — amber waiting frame, hourglass, gentle pulse
 *   • Lost    — red terminated frame, greyed-out downstream stages
 *
 * For the three operational states the pipeline stays at the business stage the
 * deal reached; the state is layered over it, never inserted as a stage.
 */
export const OpportunityPipelineProgress: React.FC<OpportunityPipelineProgressProps> = ({
  stage,
  probability,
  closeReason,
  blockedReason,
  delayedReason,
}) => {
  const exception = isException(stage) ? stage : null;
  // Won is a real, positive terminal stage; the three exceptions are overlays.
  const overlay: OverlayState | null = exception ?? (stage === 'Won' ? 'Won' : null);
  const style = overlay ? OVERLAY_STYLES[overlay] : null;

  // The business stage the strip highlights. For a normal / Won stage that's
  // the stage itself; for an exception it's the last active business stage.
  const activeStage: OpportunityStage = exception ? inferActiveStage(probability) : stage;
  const activeIdx = CORE_STAGES.indexOf(activeStage);

  // Each state draws its reason from its own dedicated field — Blocked/Delayed
  // are kept independent of Risks & Dependencies by design.
  const reason =
    overlay === 'Won' || overlay === 'Lost'
      ? closeReason
      : overlay === 'Blocked'
        ? blockedReason
        : overlay === 'Delayed'
          ? delayedReason
          : undefined;

  const BannerIcon = style?.icon;

  return (
    <div>
      <div
        className={`relative rounded-xl border transition-all duration-500 ${
          style ? `${style.frame} px-4 pt-8 pb-4` : 'border-transparent'
        }`}
      >
        {/* State ribbon — never a pipeline node, always an overlay. */}
        {style && (
          <div
            className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${style.ribbon}`}
          >
            <span aria-hidden="true">{style.emoji}</span>
            <span>{style.label}</span>
          </div>
        )}

        {/* All six stages stay visible at every width — no internal scrolling. */}
        <div className="flex items-start">
          {CORE_STAGES.map((id, i) => {
            const Icon = CORE_META[id].icon;
            const isCurrent = i === activeIdx;
            const isCompleted = i < activeIdx;
            // For Lost, stages beyond where the deal died are explicitly greyed
            // to show the pipeline can no longer advance.
            const isDead = exception === 'Lost' && i > activeIdx;

            const nodeCls = isCurrent
              ? style
                ? style.node
                : 'bg-green-50 border-green-600 text-green-600 scale-110 shadow-md shadow-green-500/20'
              : isCompleted
                ? 'bg-green-600 border-green-600 text-white'
                : isDead
                  ? 'bg-slate-100 border-slate-200 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-400';

            const labelCls = isCurrent
              ? style
                ? style.nodeLabel
                : 'text-green-700'
              : isCompleted
                ? 'text-green-700'
                : isDead
                  ? 'text-slate-300'
                  : 'text-slate-400';

            const connectorFilled = i < activeIdx;

            return (
              <React.Fragment key={id}>
                <div
                  className="flex flex-col items-center gap-1.5 shrink-0"
                  style={{ width: `${100 / CORE_STAGES.length}%` }}
                >
                  <div
                    className={`relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-500 ${nodeCls}`}
                  >
                    {isCurrent && style?.ring && (
                      <span className={`absolute inset-0 rounded-full ${style.ring}`} />
                    )}
                    {isCurrent && !style && (
                      <span className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
                    )}
                    {isCompleted ? (
                      <Check className="w-4 h-4 relative" strokeWidth={3} />
                    ) : (
                      <Icon className="w-4 h-4 relative" />
                    )}
                  </div>
                  <span
                    className={`w-full px-0.5 text-[10px] font-bold text-center leading-tight break-words transition-colors duration-500 ${labelCls}`}
                  >
                    {id}
                  </span>
                </div>

                {i < CORE_STAGES.length - 1 && (
                  <div className="flex-1 mt-[17px] px-0.5 min-w-1">
                    <div
                      className={`h-0.5 rounded-full transition-colors duration-500 ${
                        connectorFilled ? 'bg-green-600' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Descriptive message card — one per overlay state, so Won / Blocked /
          Delayed / Lost each read distinctly. Responsive: icon + text stack
          fluidly and the reason wraps. */}
      {style && BannerIcon && (
        <div
          className={`mt-3 flex items-start gap-3 px-4 py-3 rounded-lg border ${style.banner}`}
        >
          <BannerIcon className={`w-5 h-5 shrink-0 mt-0.5 ${style.bannerIcon}`} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold leading-snug">
              <span aria-hidden="true" className="mr-1">{style.emoji}</span>
              {style.headline}
            </p>
            {style.secondary && (
              <p className="text-xs font-medium opacity-80 leading-relaxed">{style.secondary}</p>
            )}
            {reason && (
              <p className="text-xs font-semibold leading-relaxed break-words">
                <span className="font-bold">{style.reasonLabel}:</span> {reason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
