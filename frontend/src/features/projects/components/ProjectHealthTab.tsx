import React, { useEffect } from 'react';
import { AdminUser } from '@/types';
import { Card, Button, StatusBadge, HEALTH_COLORS } from '@/components/ui';
import { Plus } from 'lucide-react';
import { HealthUpdateFormModal } from './HealthUpdateFormModal';
import { useProjectHealth } from '../hooks/useProjectHealth';

interface ProjectHealthTabProps {
  projectId: string;
  users: AdminUser[];
  openModalTrigger?: number;
}

/**
 * Health Tracker — the project's full health audit trail: every previous update
 * with its status summary, trend, and review information. The current health is
 * surfaced in the Overview's Project Details card (see
 * ProjectHealthDetailsSection); both
 * read and write through useProjectHealth, so the Overview always shows the most
 * recent entry listed here.
 */
export const ProjectHealthTab: React.FC<ProjectHealthTabProps> = ({ projectId, users, openModalTrigger = 0 }) => {
  const {
    history, loading, canUpdate,
    isModalOpen, openModal, closeModal,
    draft, setDraft, isSaving, save,
  } = useProjectHealth(projectId);

  useEffect(() => {
    if (openModalTrigger > 0 && canUpdate) {
      openModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModalTrigger, canUpdate]);

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatJustDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  // Determine trend: Map last 5 updates
  const trendUpdates = history.slice(0, 5).reverse();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           {trendUpdates.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                 <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Health Trend:</span>
                 <div className="flex items-center gap-1.5">
                   {trendUpdates.map((h, i) => (
                     <React.Fragment key={h.id}>
                       <StatusBadge value={h.health} colorMap={HEALTH_COLORS} />
                       {i < trendUpdates.length - 1 && <span className="text-slate-300">→</span>}
                     </React.Fragment>
                   ))}
                 </div>
              </div>
           )}
        </div>
        {canUpdate && (
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openModal}>
            Update Health
          </Button>
        )}
      </div>

      {history.length === 0 && !loading && (
        <Card>
          <div className="text-center py-8 text-slate-500">
            No health updates recorded yet.
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {history.map((update) => {
          // A health-only entry (set via Create/Edit Project) has no body at all;
          // drop the divider so the card is just status + who/when.
          const hasDetails = Boolean(
            update.keyAchievements || update.currentChallenges || update.risksImpactingHealth ||
            update.mitigationPlan || update.supportRequired || update.nextReviewDate || update.reviewedByName,
          );
          return (
          <Card key={update.id} className="overflow-hidden">
            <div className={`flex flex-col md:flex-row md:items-start justify-between gap-4 ${hasDetails ? 'border-b border-slate-100 pb-4 mb-4' : ''}`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <StatusBadge value={update.health} colorMap={HEALTH_COLORS} />
                  {update.overallConfidencePct !== undefined && (
                     <span className="text-sm font-medium text-slate-600">
                       Confidence: {update.overallConfidencePct}%
                     </span>
                  )}
                </div>
                {/* Entries written by Create/Edit Project carry no summary —
                    show the status and metadata alone rather than filler text. */}
                {update.statusSummary && (
                  <h3 className="text-lg font-semibold text-slate-800 whitespace-pre-wrap">{update.statusSummary}</h3>
                )}
              </div>
              <div className="text-right text-sm">
                <div className="text-slate-500">Updated by <span className="font-medium text-slate-700">{update.updatedByName || 'Unknown'}</span></div>
                <div className="text-slate-400">{formatDate(update.createdAt)}</div>
              </div>
            </div>

            {hasDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {update.keyAchievements && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">Key Achievements</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{update.keyAchievements}</p>
                </div>
              )}
              {update.currentChallenges && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">Current Challenges</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{update.currentChallenges}</p>
                </div>
              )}
              {update.risksImpactingHealth && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">Risks Impacting Health</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{update.risksImpactingHealth}</p>
                </div>
              )}
              {update.mitigationPlan && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">Mitigation Plan</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{update.mitigationPlan}</p>
                </div>
              )}
              {update.supportRequired && (
                <div className="md:col-span-2">
                  <h4 className="font-semibold text-slate-700 mb-1">Support Required</h4>
                  <p className="text-slate-600 whitespace-pre-wrap">{update.supportRequired}</p>
                </div>
              )}

              {(update.nextReviewDate || update.reviewedByName) && (
                 <div className="md:col-span-2 flex flex-wrap gap-6 pt-2 mt-2 border-t border-slate-50">
                    {update.nextReviewDate && (
                       <div>
                         <span className="text-slate-500 font-medium">Next Review: </span>
                         <span className="text-slate-800">{formatJustDate(update.nextReviewDate)}</span>
                       </div>
                    )}
                    {update.reviewedByName && (
                       <div>
                         <span className="text-slate-500 font-medium">Reviewed By: </span>
                         <span className="text-slate-800">{update.reviewedByName}</span>
                       </div>
                    )}
                 </div>
              )}
            </div>
            )}
          </Card>
          );
        })}
      </div>

      {isModalOpen && (
        <HealthUpdateFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={save}
          draft={draft}
          setDraft={setDraft}
          isSaving={isSaving}
          users={users}
        />
      )}
    </div>
  );
};
