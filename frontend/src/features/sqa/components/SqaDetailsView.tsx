import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BadgeCheck, Building2, CalendarClock, DollarSign, Edit2,
  FolderKanban, History, Layers, Users,
} from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import type { AdminUser, ProjectHealth, SqaRecord, SqaWeeklyHealth } from '@/types';
import { administrationApi } from '@/api/crm.api';
import {
  Button,
  Card,
  DetailHeaderCard,
  DetailTabBar,
  ErrorBanner,
  ErrorState,
  FormSection,
  HEALTH_COLORS,
  PRIORITY_COLORS,
  StatusBadge,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { sqaErrorMessage, useSqaRecord } from '../hooks/useSqaRecords';
import { draftFromRecord, draftToInput, SqaDraft, SqaFormModal, SqaInherited } from './SqaFormModal';
import { ProjectHealthTab } from '@/features/projects/components/ProjectHealthTab';
import { SqaTrackerTab } from './SqaTrackerTab';

type SqaTab = 'overview' | 'sqa-tracker' | 'health-tracker';

const formatCur = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

/** Read-only field with a note naming where the value came from. */
const Field: React.FC<{ label: string; value: React.ReactNode; source?: string }> = ({
  label, value, source,
}) => (
  <div className="min-w-0">
    <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">
      {label}
    </span>
    <div className="text-sm text-slate-800 font-semibold break-words">
      {value === undefined || value === null || value === '' ? (
        <span className="text-slate-300 italic font-medium">—</span>
      ) : value}
    </div>
    {source && (
      <span className="block text-micro text-slate-400 font-medium mt-0.5">{source}</span>
    )}
  </div>
);

/** Multi-line narrative block — the weekly text fields. */
const TextBlock: React.FC<{ label: string; text?: string }> = ({ label, text }) => (
  <div>
    <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">
      {label}
    </span>
    {text?.trim() ? (
      <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{text}</p>
    ) : (
      <p className="text-sm text-slate-300 italic font-medium">Nothing recorded</p>
    )}
  </div>
);

/** Names which existing field an inherited value came from, or the override. */
function provenance(
  overridden: boolean,
  inheritedFrom: string,
): string {
  return overridden ? 'SQA override' : `from ${inheritedFrom}`;
}

/**
 * SQA record details — Overview (inherited data, SQA classification, weekly
 * narrative) and Weekly Health (the ISO-week grid, editable in place).
 *
 * The record is fetched by id rather than read from a list, so the page works
 * on a direct URL. Every inherited value is labelled with the field it comes
 * from, which is what keeps the "no duplicate data" rule visible to users
 * rather than merely true in the schema.
 */
export const SqaDetailsView: React.FC = () => {
  const { selectedSqaId, setView, setSelectedProjectId, setSelectedAccountId } = useCRM();
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    administrationApi.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const {
    record, loading, error, reload, update, setWeekHealth, canUpdate, canEditWeeklyHealth,
  } = useSqaRecord(selectedSqaId);

  const [activeTab, setActiveTab] = useState<SqaTab>('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draft, setDraft] = useState<SqaDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const inherited: SqaInherited = useMemo(() => (record ? {
    accountName: record.accountName,
    projectHealth: record.projectHealth,
    pmName: record.pmName,
    clientPmName: record.clientPmName,
    billingModel: record.billingModelInherited,
    tower: record.towerInherited,
    revenue: record.revenueInherited,
    revenueInheritedSource: record.revenueInheritedSource,
    fte: record.fteInherited,
    teamMemberCount: record.teamMemberCount,
  } : {}), [record]);

  const openEdit = (r: SqaRecord) => {
    setDraft(draftFromRecord(r));
    setIsEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setIsSubmitting(true);
    setWriteError(null);
    try {
      await update(draftToInput(draft));
      setIsEditOpen(false);
      setDraft(null);
    } catch (err) {
      setWriteError(sqaErrorMessage(err, 'Failed to save the SQA record.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading SQA record…" />;

  if (error || !record) {
    return (
      <ErrorState
        title="SQA record unavailable"
        message={error ?? 'This SQA record could not be found. It may have been deactivated.'}
        onRetry={reload}
      />
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BadgeCheck, count: null },
    { id: 'sqa-tracker', label: 'SQA Tracker / History', icon: History, count: null },
    ...(record.projectId ? [{ id: 'health-tracker', label: 'Project Health Tracker', icon: Activity, count: null }] : []),
  ];

  return (
    <div className="space-y-6">
      <DetailHeaderCard
        onBack={() => setView('sqa')}
        backTitle="Back to SQA"
        avatarContent={<BadgeCheck className="w-6 h-6" aria-hidden="true" />}
        avatarColorClass="bg-indigo-50 text-indigo-600"
        title={record.projectName || 'SQA Record'}
        badges={
          <>
            <StatusBadge value={record.importance} colorMap={PRIORITY_COLORS} />
            {record.projectHealth && (
              <StatusBadge
                value={record.projectHealth}
                colorMap={HEALTH_COLORS}
              />
            )}
            {record.clientEscalation && (
              <StatusBadge value="Client Escalation" colorMap={{ 'Client Escalation': 'bg-red-100 text-red-700' }} />
            )}
          </>
        }
        description={
          record.accountName
            ? `${record.accountName}${record.tower ? ` · ${record.tower}` : ''}`
            : undefined
        }
        actions={canUpdate ? (
          <Button variant="warning" icon={<Edit2 className="w-4 h-4" />} onClick={() => openEdit(record)}>
            Edit SQA Record
          </Button>
        ) : undefined}
        attributes={[
          { icon: <Building2 className="w-4 h-4" />, label: 'Account', value: record.accountName },
          { icon: <Users className="w-4 h-4" />, label: 'PM', value: record.pmName },
          {
            icon: <DollarSign className="w-4 h-4" />, label: 'Revenue', mono: true,
            value: record.revenue !== undefined ? formatCur(record.revenue) : undefined,
          },
          { icon: <Layers className="w-4 h-4" />, label: 'FTE', mono: true, value: record.fte },
          { icon: <CalendarClock className="w-4 h-4" />, label: 'SDLC Phase', value: record.currentSdlcPhase },
        ]}
      />

      {writeError && <ErrorBanner message={writeError} onDismiss={() => setWriteError(null)} />}

      <DetailTabBar tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as SqaTab)} />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <FormSection title="Inherited from Project">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field
                  label="Project"
                  source="the linked Project"
                  value={
                    <button
                      type="button"
                      onClick={() => { setSelectedProjectId(record.projectId); setView('project-details'); }}
                      className="text-blue-600 hover:underline font-semibold cursor-pointer text-left"
                    >
                      {record.projectName || 'View project'}
                    </button>
                  }
                />
                <Field
                  label="Account"
                  source="the Project's Account"
                  value={
                    <button
                      type="button"
                      onClick={() => { setSelectedAccountId(record.accountId); setView('account-details'); }}
                      className="text-blue-600 hover:underline font-semibold cursor-pointer text-left"
                    >
                      {record.accountName || 'View account'}
                    </button>
                  }
                />
                <Field label="Opportunity" value={record.opportunityName} source="the originating Opportunity" />
                <Field label="PM" value={record.pmName} source="the Project's Service Provider PM" />
                <Field label="Client PM" value={record.clientPmName} source="the Project's Client PM" />
                <Field
                  label="Project Health"
                  source="the Project Health tracker"
                  value={record.projectHealth
                    ? <StatusBadge value={record.projectHealth} colorMap={HEALTH_COLORS} />
                    : undefined}
                />
                <Field
                  label="Revenue"
                  value={record.revenue !== undefined ? formatCur(record.revenue) : undefined}
                  source={provenance(
                    record.revenueOverride !== undefined,
                    record.revenueInheritedSource === 'project'
                      ? "the Project's Deal Value"
                      : record.revenueInheritedSource === 'opportunity'
                        ? "the Opportunity's value"
                        : 'no source (entered manually)',
                  )}
                />
                <Field
                  label="FTE"
                  value={record.fte}
                  source={provenance(
                    record.fteOverride !== undefined,
                    record.teamMemberCount
                      ? `the Project team (${record.teamMemberCount})`
                      : 'no project team recorded',
                  )}
                />
                <Field
                  label="Billing Model"
                  value={record.billingModel}
                  source={provenance(!!record.billingModelOverride, "the Project/Opportunity Billing Model")}
                />
                <Field
                  label="Tower"
                  value={record.tower}
                  source={provenance(!!record.towerOverride, "the Project/Opportunity Tower")}
                />
                <Field
                  label="Service Line"
                  value={record.serviceLine}
                  source="the Project/Opportunity Service Line"
                />
                <Field label="Start Date" value={record.startDate} source="the Project timeline" />
                <Field label="End Date" value={record.endDate} source="the Project timeline" />
              </div>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="SQA Classification">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field
                  label="Importance"
                  value={<StatusBadge value={record.importance} colorMap={PRIORITY_COLORS} />}
                />
                <Field label="Delivery Model" value={record.deliveryModel} source="SQA-maintained" />
                <Field label="Current SDLC Phase" value={record.currentSdlcPhase} />
                <Field
                  label="WSR Publish Status (Y/N)"
                  value={
                    <StatusBadge
                      value={record.wsrPublished ? 'Yes' : 'No'}
                      colorMap={{ Yes: 'bg-green-100 text-green-700', No: 'bg-slate-100 text-slate-600' }}
                    />
                  }
                />
                <Field
                  label="Client Escalation"
                  value={
                    <StatusBadge
                      value={record.clientEscalation ? 'Yes' : 'No'}
                      colorMap={{ Yes: 'bg-red-100 text-red-700', No: 'bg-slate-100 text-slate-600' }}
                    />
                  }
                />
                <Field label="Resourcing Status" value={record.resourcingStatus} />
              </div>
            </FormSection>
          </Card>

          <Card>
            <FormSection title="Weekly Status">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextBlock label="Update for the Current Week" text={record.currentWeekUpdate} />
                <TextBlock label="Plan for Next Week" text={record.nextWeekPlan} />
                <TextBlock label="Issues / Challenges" text={record.issuesChallenges} />
                <TextBlock label="Path to Green" text={record.pathToGreen} />
                <div className="md:col-span-2">
                  <TextBlock label="SQA Remarks" text={record.sqaRemarks} />
                </div>
              </div>
            </FormSection>
          </Card>
        </div>
      )}

      {activeTab === 'sqa-tracker' && (
        <Card>
          <div className="mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">SQA Historical Weekly Snapshots</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Complete weekly history snapshots for <span className="font-semibold text-slate-700">{record.projectName}</span> over time.
            </p>
          </div>
          <SqaTrackerTab sqaRecordId={record.id} storageKey={`sqa-tracker-${record.id}`} />
        </Card>
      )}

      {activeTab === 'health-tracker' && record.projectId && (
        <Card>
          <div className="mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Project Health Status Tracking</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Full project health status tracking and history for <span className="font-semibold text-slate-700">{record.projectName}</span> over the project timeline.
            </p>
          </div>
          <ProjectHealthTab projectId={record.projectId} users={users ?? []} />
        </Card>
      )}

      {isEditOpen && draft && (
        <SqaFormModal
          isOpen
          mode="edit"
          onClose={() => { setIsEditOpen(false); setDraft(null); }}
          onSubmit={submitEdit}
          isSubmitting={isSubmitting}
          value={draft}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          inherited={inherited}
          weeklyHealthReadOnly={!canEditWeeklyHealth}
        />
      )}
    </div>
  );
};
