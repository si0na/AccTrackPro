import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { AccountWeeklyHealth, AccountHealth } from '@/types';
import { serviceProviderOptionLabel } from '@/utils';
import {
  FormModal,
  FormSection,
  FormField,
  FormGrid,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';
import {
  HeartPulse,
  AlertCircle,
} from 'lucide-react';

export interface WeeklyHealthFormData {
  reportingDate: string;
  healthStatus: AccountHealth;
  summary: string;
  keyUpdates?: string;
  risksAndIssues?: string;
  actionItemsMitigation?: string;
  owner?: string;
  ownerId?: string;
  nextSteps?: string;
}

export interface WeeklyHealthFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WeeklyHealthFormData) => Promise<void>;
  initialData?: AccountWeeklyHealth | null;
  accountName?: string;
  existingDates?: string[];
  defaultOwner?: string;
  defaultOwnerId?: string;
}

export const WeeklyHealthFormModal: React.FC<WeeklyHealthFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  accountName = '',
  existingDates = [],
  defaultOwner = '',
  defaultOwnerId = '',
}) => {
  const { serviceProviders, currentUser, currentUserId } = useCRM();

  const isEdit = !!initialData;

  const [reportingDate, setReportingDate] = useState<string>('');
  const [healthStatus, setHealthStatus] = useState<AccountHealth>('Green');
  const [summary, setSummary] = useState<string>('');
  const [keyUpdates, setKeyUpdates] = useState<string>('');
  const [risksAndIssues, setRisksAndIssues] = useState<string>('');
  const [actionItemsMitigation, setActionItemsMitigation] = useState<string>('');
  const [owner, setOwner] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [nextSteps, setNextSteps] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setReportingDate(initialData.reportingDate || '');
        setHealthStatus(initialData.healthStatus || 'Green');
        setSummary(initialData.summary || '');
        setKeyUpdates(initialData.keyUpdates || '');
        setRisksAndIssues(initialData.risksAndIssues || '');
        setActionItemsMitigation(initialData.actionItemsMitigation || '');
        setOwner(initialData.owner || '');
        setOwnerId(initialData.ownerId || '');
        setNextSteps(initialData.nextSteps || '');
      } else {
        const today = new Date().toISOString().split('T')[0];
        setReportingDate(today);
        setHealthStatus('Green');
        setSummary('');
        setKeyUpdates('');
        setRisksAndIssues('');
        setActionItemsMitigation('');
        setOwner(defaultOwner || currentUser || '');
        setOwnerId(defaultOwnerId || currentUserId || '');
        setNextSteps('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialData, defaultOwner, defaultOwnerId, currentUser, currentUserId]);

  const handleOwnerSelect = (selectedId: string) => {
    setOwnerId(selectedId);
    if (!selectedId) {
      setOwner('');
      return;
    }
    const found = serviceProviders.find((sp) => sp.id === selectedId);
    if (found) {
      setOwner(found.name || found.email);
    }
  };

  const isDuplicateDate = !isEdit
    ? existingDates.includes(reportingDate)
    : initialData?.reportingDate !== reportingDate && existingDates.includes(reportingDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!reportingDate) {
      setErrorMsg('Reporting date is required.');
      return;
    }

    if (isDuplicateDate) {
      setErrorMsg(`A weekly health update for ${reportingDate} already exists for this account.`);
      return;
    }

    if (!summary.trim()) {
      setErrorMsg('Health Summary is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reportingDate,
        healthStatus,
        summary: summary.trim(),
        keyUpdates: keyUpdates.trim() || undefined,
        risksAndIssues: risksAndIssues.trim() || undefined,
        actionItemsMitigation: actionItemsMitigation.trim() || undefined,
        owner: owner.trim() || undefined,
        ownerId: ownerId || undefined,
        nextSteps: nextSteps.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to save weekly health update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = isEdit
    ? `Edit Weekly Health Update${accountName ? ` · ${accountName}` : ''}`
    : `New Weekly Health Update${accountName ? ` · ${accountName}` : ''}`;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      icon={<HeartPulse className="w-5 h-5 text-indigo-500" />}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : 'Record Weekly Update'}
      submitVariant={isEdit ? 'warning' : 'primary'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Reporting Overview */}
        <FormSection title="Reporting Overview">
          <FormGrid columns={2}>
            {/* Reporting Date */}
            <FormField
              label="Reporting Date / Week"
              required
              hint="Select the reporting date for this health snapshot."
            >
              <input
                type="date"
                value={reportingDate}
                onChange={(e) => setReportingDate(e.target.value)}
                className={`${INPUT_CLS} ${isDuplicateDate ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                required
              />
              {isDuplicateDate && (
                <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> An update for this date already exists.
                </p>
              )}
            </FormField>

            {/* Overall Health Selector */}
            <FormField label="Overall Health Status" required>
              <div className="grid grid-cols-3 gap-2">
                {(['Green', 'Amber', 'Red'] as AccountHealth[]).map((status) => {
                  const isSelected = healthStatus === status;
                  const colors = {
                    Green: isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
                    Amber: isSelected
                      ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
                    Red: isSelected
                      ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-600/20 shadow-xs'
                      : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
                  }[status];

                  return (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setHealthStatus(status)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-semibold text-xs transition-all ${colors}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected
                            ? 'bg-white'
                            : status === 'Green'
                            ? 'bg-emerald-500'
                            : status === 'Amber'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      {status}
                    </button>
                  );
                })}
              </div>
            </FormField>
          </FormGrid>

          {/* Owner Fields */}
          <FormGrid columns={2} className="mt-4">
            <FormField
              label="Assigned Owner / Lead"
              hint="Person responsible for this weekly update or follow-up."
            >
              <select
                value={ownerId}
                onChange={(e) => handleOwnerSelect(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">— Select from Team Directory —</option>
                {[...serviceProviders]
                  .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {serviceProviderOptionLabel(user)}
                    </option>
                  ))}
              </select>
            </FormField>

            <FormField
              label="Owner Display Name"
              hint="Free-text owner name or external POC designation."
            >
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Section 2: Health Summary & Highlights */}
        <FormSection title="Health Summary & Highlights">
          <FormField
            label="Health Summary"
            required
            hint="Concise executive overview of the account's state, client relationship, and delivery health."
          >
            <textarea
              rows={3}
              required
              placeholder="e.g. Account remains stable with strong client relationship. Q4 deliverables on track with positive feedback from stakeholders..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={INPUT_CLS}
            />
          </FormField>

          <div className="mt-4">
            <FormField
              label="Key Updates"
              hint="Notable milestones achieved, meetings held, deployments, or changes this week."
            >
              <textarea
                rows={3}
                placeholder="e.g. Completed UAT sign-off for Phase 2; onboarded 2 new front-end engineers; renewed MS licensing agreement..."
                value={keyUpdates}
                onChange={(e) => setKeyUpdates(e.target.value)}
                className={INPUT_CLS}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Section 3: Risks, Mitigation & Next Steps */}
        <FormSection title="Risks, Mitigation & Next Steps">
          <FormGrid columns={2}>
            <FormField
              label="Risks & Issues"
              hint="Current concerns, blockers, or potential risks."
            >
              <textarea
                rows={3}
                placeholder="e.g. Potential delay in vendor API integration due to third-party outage; client budget approvals pending..."
                value={risksAndIssues}
                onChange={(e) => setRisksAndIssues(e.target.value)}
                className={INPUT_CLS}
              />
            </FormField>

            <FormField
              label="Action Items & Mitigation"
              hint="Concrete actions being taken to eliminate or mitigate risks."
            >
              <textarea
                rows={3}
                placeholder="e.g. Scheduling technical escalation call with vendor lead; providing interim mock services to unblock testing..."
                value={actionItemsMitigation}
                onChange={(e) => setActionItemsMitigation(e.target.value)}
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>

          <div className="mt-4">
            <FormField
              label="Next Steps"
              hint="Key priorities, scheduled deliverables, or governance meetings for the upcoming week."
            >
              <textarea
                rows={2}
                placeholder="e.g. Conduct weekly steering committee on Tuesday; finalize SOW extension draft; review sprint release burndown..."
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className={INPUT_CLS}
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
};
