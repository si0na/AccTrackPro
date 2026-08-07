import React from 'react';
import type { ProjectHealth } from '@/types';
import { FormSection, HEALTH_COLORS, StatusBadge } from '@/components/ui';
import { useProjectHealth } from '../hooks/useProjectHealth';

interface ProjectHealthDetailsSectionProps {
  projectId: string;
  /** Current `projects.health` — the fallback badge before any history exists. */
  fallbackHealth: ProjectHealth;
}

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/**
 * Read-only health status fields inside the Overview's "Project Details" card.
 * Values come from the latest Health Tracker entry through useProjectHealth, so
 * this can never disagree with the tracker. Editing lives on the Health Tracker
 * tab and the Edit Project form.
 */
export const ProjectHealthDetailsSection: React.FC<ProjectHealthDetailsSectionProps> = ({
  projectId, fallbackHealth,
}) => {
  const { latest, loading } = useProjectHealth(projectId);

  // Before the first tracker entry exists the project row is still authoritative.
  const health = latest?.health ?? fallbackHealth;

  return (
    <FormSection title="Project Health">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Current Health</span>
          <StatusBadge value={health} colorMap={HEALTH_COLORS} />
        </div>
        <div>
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Overall Confidence</span>
          <span className="text-sm text-slate-800 font-semibold">
            {latest?.overallConfidencePct !== undefined ? `${latest.overallConfidencePct}%` : '—'}
          </span>
        </div>
        <div>
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Next Review Date</span>
          <span className="text-sm text-slate-800 font-mono font-semibold">{formatDate(latest?.nextReviewDate)}</span>
        </div>
        <div>
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Last Updated By</span>
          <span className="text-sm text-slate-800 font-semibold">{latest?.updatedByName || '—'}</span>
        </div>
        <div>
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Last Updated On</span>
          <span className="text-sm text-slate-800 font-semibold">{formatDateTime(latest?.createdAt)}</span>
        </div>
      </div>

      {!latest && (
        <p className="text-sm text-slate-400 font-medium italic mt-4">
          {loading ? 'Loading…' : 'No health updates recorded yet.'}
        </p>
      )}

      {/* Only a user-written summary is shown — entries created by Create/Edit
          Project carry none, and no placeholder text is invented for them. */}
      {latest?.statusSummary && (
        <div className="mt-4">
          <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Status Summary</span>
          <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
            {latest.statusSummary}
          </p>
        </div>
      )}
    </FormSection>
  );
};
