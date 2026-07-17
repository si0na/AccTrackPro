/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { OpportunityStage } from '@/types';
import { OPPORTUNITY_STAGE_OPTIONS } from '@/constants';
import {
  Users,
  CheckCircle2,
  FileText,
  Handshake,
  Trophy,
  Check,
  PauseCircle,
  Clock,
  XCircle,
  Circle,
} from 'lucide-react';

interface ExceptionMeta {
  /** Circle classes when this exception stage is the current stage. */
  node: string;
  /** Label classes when this exception stage is the current stage. */
  label: string;
  /** Status banner classes shown under the strip. */
  banner: string;
  message: string;
}

interface StageMeta {
  icon: React.ComponentType<{ className?: string }>;
  /** Present only for stages that sit outside the linear happy path. There's
   *  no stored history of which core stage a deal was in when it paused or
   *  died, so we never mark core stages "completed" for them; the strip
   *  highlights the exception node itself and a banner states the real
   *  current state. */
  exception?: ExceptionMeta;
}

const STAGE_META: Record<string, StageMeta> = {
  Lead: { icon: Users },
  Qualified: { icon: CheckCircle2 },
  Proposal: { icon: FileText },
  Negotiation: { icon: Handshake },
  Won: { icon: Trophy },
  Blocked: {
    icon: PauseCircle,
    exception: {
      node: 'bg-orange-50 border-orange-500 text-orange-600 scale-110 shadow-md shadow-orange-500/20',
      label: 'text-orange-700',
      banner: 'bg-orange-50 border-orange-200 text-orange-700',
      message: 'Pipeline paused — this deal is currently marked',
    },
  },
  Delayed: {
    icon: Clock,
    exception: {
      node: 'bg-amber-50 border-amber-500 text-amber-600 scale-110 shadow-md shadow-amber-500/20',
      label: 'text-amber-700',
      banner: 'bg-amber-50 border-amber-200 text-amber-700',
      message: 'Pipeline paused — this deal is currently marked',
    },
  },
  Lost: {
    icon: XCircle,
    exception: {
      node: 'bg-red-50 border-red-500 text-red-600 scale-110 shadow-md shadow-red-500/20',
      label: 'text-red-700',
      banner: 'bg-red-50 border-red-200 text-red-700',
      message: 'Pipeline closed — this deal is marked',
    },
  },
};

const DEFAULT_META: StageMeta = { icon: Circle };

// The strip renders every configured stage, in configured order — adding a
// stage to OPPORTUNITY_STAGE_OPTIONS makes it appear here automatically.
const STAGES = OPPORTUNITY_STAGE_OPTIONS.map((id) => ({
  id,
  meta: STAGE_META[id] ?? DEFAULT_META,
}));

export interface OpportunityPipelineProgressProps {
  stage: OpportunityStage;
}

/**
 * Horizontal stage progression for the Opportunity Detail Overview tab.
 * Renders every stage in OPPORTUNITY_STAGE_OPTIONS with completed / current /
 * upcoming states. Exception stages (Blocked/Delayed/Lost) are connected with
 * dashed links since they sit outside the linear happy path; when one of them
 * is current, the core path renders muted (their prior core stage isn't
 * recorded) and a status banner states the deal's real state.
 */
export const OpportunityPipelineProgress: React.FC<OpportunityPipelineProgressProps> = ({ stage }) => {
  const currentIdx = STAGES.findIndex((s) => s.id === stage);
  const exception = STAGE_META[stage]?.exception;

  return (
    <div>
      {/* All stages stay visible at every width — no internal scrolling. */}
      <div>
        <div className="flex items-start">
          {STAGES.map((s, i) => {
            const Icon = s.meta.icon;
            // When the deal sits in an exception stage, no core stage is shown
            // as completed — only the exception node itself lights up.
            const isCurrent = i === currentIdx;
            const isCompleted = !exception && i < currentIdx;
            const connectorFilled = !exception && i < currentIdx;
            // Links into/inside the exception zone are dashed — off the happy path.
            const connectorDashed = i + 1 < STAGES.length && !!STAGES[i + 1].meta.exception;

            const nodeCls = isCompleted
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : isCurrent
                ? s.meta.exception
                  ? s.meta.exception.node
                  : 'bg-indigo-50 border-indigo-600 text-indigo-600 scale-110 shadow-md shadow-indigo-500/20'
                : 'bg-white border-slate-200 text-slate-400';

            const labelCls = isCurrent && s.meta.exception
              ? s.meta.exception.label
              : isCompleted || isCurrent
                ? 'text-indigo-700'
                : 'text-slate-400';

            return (
              <React.Fragment key={s.id}>
                <div
                  className="flex flex-col items-center gap-1.5 shrink-0"
                  style={{ width: `${100 / STAGES.length}%` }}
                >
                  <div
                    className={`relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-500 ${nodeCls}`}
                  >
                    {isCurrent && !exception && (
                      <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
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
                    {s.id}
                  </span>
                </div>

                {i < STAGES.length - 1 && (
                  <div className="flex-1 mt-[17px] px-0.5 min-w-1">
                    {connectorDashed ? (
                      <div className="border-t-2 border-dashed border-slate-200" />
                    ) : (
                      <div
                        className={`h-0.5 rounded-full transition-colors duration-500 ${
                          connectorFilled ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {exception && (
        <div className={`mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border ${exception.banner}`}>
          {(() => {
            const BannerIcon = STAGE_META[stage].icon;
            return <BannerIcon className="w-4 h-4 shrink-0" />;
          })()}
          <span className="text-xs font-bold">
            {exception.message} <span className="underline">{stage}</span>
          </span>
        </div>
      )}
    </div>
  );
};
