import React from 'react';
import { Card, Button } from '@/components/ui';
import { Plus, Pencil, Calendar, Clock, DollarSign, Percent } from 'lucide-react';
import { useProjectProgress } from '../hooks/useProjectProgress';
import { ProgressUpdateFormModal } from './ProgressUpdateFormModal';
import { formatCur } from '@/utils';

interface ProjectProgressTabProps {
  projectId: string;
  onProjectUpdated?: () => void;
}

export const ProjectProgressTab: React.FC<ProjectProgressTabProps> = ({ projectId, onProjectUpdated }) => {
  const {
    history,
    latest,
    loading,
    canUpdate,
    isModalOpen,
    openModal,
    openEditModal,
    closeModal,
    isEditing,
    draft,
    setDraft,
    isSaving,
    save,
    errorMessage,
  } = useProjectProgress(projectId);

  const handleSave = async (e?: React.FormEvent) => {
    await save(e);
    if (onProjectUpdated) {
      onProjectUpdated();
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatProgressDate = (dateStr: string) => {
    if (!dateStr) return 'Not set';
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 tracking-tight">Overall Progress & History</h3>
          <p className="text-xs text-slate-500">
            Track and record progress updates over time. Current progress reflects the latest update by Progress Date.
          </p>
        </div>
        {canUpdate && (
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openModal}>
            Update Progress
          </Button>
        )}
      </div>

      {/* Current Progress Summary Card */}
      <Card title="Current Progress Overview" className="border-l-4 border-l-blue-600">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              As On Date
            </div>
            <div className="text-base font-bold text-slate-800 font-mono">
              {latest?.asOnDate ? formatProgressDate(latest.asOnDate) : 'Not set'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              <Percent className="w-3.5 h-3.5 text-emerald-600" />
              Completion (Actual / Plan)
            </div>
            <div className="text-base font-bold text-slate-800">
              <span className="text-emerald-700">{latest?.actualCompletionPct ?? 0}%</span>
              <span className="text-slate-400 font-normal text-xs ml-1">
                / {latest?.plannedCompletionPct ?? 0}% planned
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Effort (Actual / Plan)
            </div>
            <div className="text-base font-bold text-slate-800">
              {latest?.actualEffortHours ?? 0} hrs
              <span className="text-slate-400 font-normal text-xs ml-1">
                / {latest?.plannedEffortHours ?? 0} hrs planned
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              Cost (Actual / Plan)
            </div>
            <div className="text-base font-bold text-slate-800">
              {formatCur(latest?.actualCost ?? 0)}
              <span className="text-slate-400 font-normal text-xs ml-1 block truncate">
                / {formatCur(latest?.plannedCost ?? 0)} planned
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Progress Updates History Audit Trail */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Progress Update History ({history.length})
          </h4>
        </div>

        {history.length === 0 && !loading && (
          <Card>
            <div className="text-center py-8 text-slate-500 text-sm">
              No progress updates recorded yet. Click "Update Progress" to record the first progress update.
            </div>
          </Card>
        )}

        {history.map((update, index) => {
          const isLatestRecord = index === 0;
          return (
            <Card key={update.id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Progress Date: {formatProgressDate(update.asOnDate)}
                    </span>
                    {isLatestRecord && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Current Progress
                      </span>
                    )}
                  </div>
                  {update.notes && (
                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{update.notes}</p>
                  )}
                </div>

                <div className="flex items-start gap-3 md:justify-end shrink-0">
                  <div className="text-right text-xs">
                    <div className="text-slate-500">
                      Updated by <span className="font-medium text-slate-700">{update.updatedByName || 'Unknown'}</span>
                    </div>
                    <div className="text-slate-400">{formatDate(update.createdAt)}</div>
                    {update.editedAt && (
                      <div className="text-slate-400 italic mt-0.5">
                        Edited {formatDate(update.editedAt)}
                        {update.editedByName ? ` by ${update.editedByName}` : ''}
                      </div>
                    )}
                  </div>
                  {canUpdate && (
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={() => openEditModal(update)}
                      aria-label="Edit progress update"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-slate-500 block">Planned Completion</span>
                  <span className="font-semibold text-slate-800">{update.plannedCompletionPct ?? 0}%</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-slate-500 block">Actual Completion</span>
                  <span className="font-semibold text-slate-800">{update.actualCompletionPct ?? 0}%</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-slate-500 block">Planned Effort</span>
                  <span className="font-semibold text-slate-800">{update.plannedEffortHours ?? 0} hrs</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-slate-500 block">Actual Effort</span>
                  <span className="font-semibold text-slate-800">{update.actualEffortHours ?? 0} hrs</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-slate-500 block">Planned Cost</span>
                  <span className="font-semibold text-slate-800">{formatCur(update.plannedCost ?? 0)}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-slate-500 block">Actual Cost</span>
                  <span className="font-semibold text-slate-800">{formatCur(update.actualCost ?? 0)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {isModalOpen && (
        <ProgressUpdateFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={handleSave}
          draft={draft}
          setDraft={setDraft}
          isSaving={isSaving}
          isEditing={isEditing}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
};
