import React, { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { NormalizedRisk, AccountRisk, ProjectRisk, ProjectIssue, PriorityLevel, IssueStatus } from '@/types';
import { AlertCircle, Pencil } from 'lucide-react';
import { serviceProviderOptionLabel } from '@/utils';
import { accountRisksApi, projectIssuesApi } from '@/api/crm.api';
import { RISK_IMPACT_OPTIONS } from '@/constants';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  AutoResizeTextarea,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SELECT_CLS,
} from '@/components/ui';

export interface IssueFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  fixedLevel?: 'Account' | 'Project';
  fixedAccountId?: string;
  fixedProjectId?: string;
  issue?: NormalizedRisk | AccountRisk | ProjectIssue | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export const IssueFormModal: React.FC<IssueFormModalProps> = ({
  isOpen,
  mode,
  fixedLevel,
  fixedAccountId,
  fixedProjectId,
  issue,
  onClose,
  onSuccess,
}) => {
  const { accounts, projects, serviceProviders } = useCRM();
  const isEdit = mode === 'edit';

  const [level, setLevel] = useState<'Account' | 'Project'>(fixedLevel || 'Account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(fixedAccountId || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(fixedProjectId || '');

  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [status, setStatus] = useState<string>('Open');
  const [ownerId, setOwnerId] = useState('');
  const [impact, setImpact] = useState('');
  const [dateIdentified, setDateIdentified] = useState('');
  const [targetResolutionDate, setTargetResolutionDate] = useState('');
  const [resolutionPlan, setResolutionPlan] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Available projects for selected Account
  const accountProjects = useMemo(() => {
    const accId = fixedAccountId || selectedAccountId;
    if (!accId) return [];
    return projects.filter((p) => p.accountId === accId);
  }, [projects, selectedAccountId, fixedAccountId]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');

    if (isEdit && issue) {
      const norm = issue as NormalizedRisk;
      const projIss = issue as ProjectIssue;
      const isProj = norm.sourceType === 'Project' || !!projIss.projectId || !!norm.projectId;
      setLevel(fixedLevel || (isProj ? 'Project' : 'Account'));

      const accId = fixedAccountId || norm.accountId || (issue as AccountRisk).accountId || '';
      setSelectedAccountId(accId);

      const projId = fixedProjectId || norm.projectId || projIss.projectId || '';
      setSelectedProjectId(projId);

      setDescription(norm.description || projIss.description || '');
      setPriority(norm.priority || (issue as AccountRisk).priority || projIss.priority || 'Medium');
      setStatus(norm.status || projIss.status || 'Open');
      setOwnerId(norm.ownerId || (issue as AccountRisk).ownerId || projIss.ownerId || '');
      setImpact(norm.impact || projIss.impact || '');
      setDateIdentified(
        norm.riskOpenDate ||
          projIss.dateIdentified ||
          (issue as AccountRisk).riskOpenDate ||
          ''
      );
      setTargetResolutionDate(
        norm.targetResolutionDate ||
          projIss.targetResolutionDate ||
          (issue as AccountRisk).targetResolutionDate ||
          ''
      );
      setResolutionPlan(
        norm.mitigationPlan ||
          projIss.resolutionPlan ||
          (issue as AccountRisk).mitigationPlan ||
          ''
      );
      setRemarks(
        norm.contingencyPlan ||
          projIss.remarks ||
          (issue as AccountRisk).contingencyPlan ||
          ''
      );
    } else {
      setLevel(fixedLevel || 'Account');
      const accId = fixedAccountId || (accounts.length > 0 ? accounts[0].id : '');
      setSelectedAccountId(accId);
      const validProjs = projects.filter((p) => p.accountId === accId);
      setSelectedProjectId(fixedProjectId || (validProjs.length > 0 ? validProjs[0].id : ''));
      setDescription('');
      setPriority('Medium');
      setStatus('Open');
      setOwnerId('');
      setImpact('');
      setDateIdentified('');
      setTargetResolutionDate('');
      setResolutionPlan('');
      setRemarks('');
    }
  }, [isOpen, isEdit, issue, fixedLevel, fixedAccountId, fixedProjectId, accounts]);

  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    const validProjs = projects.filter((p) => p.accountId === accId);
    if (validProjs.length > 0) {
      setSelectedProjectId(validProjs[0].id);
    } else {
      setSelectedProjectId('');
    }
  };

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim()) {
      setErrorMsg('Description is required.');
      return;
    }
    const accId = fixedAccountId || selectedAccountId;
    if (!accId && level === 'Account') {
      setErrorMsg('Account is required.');
      return;
    }
    const projId = fixedProjectId || selectedProjectId;
    if (level === 'Project' && !projId) {
      setErrorMsg('Project is required for Project Level issues.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (level === 'Account') {
        const payload: Partial<AccountRisk> = {
          accountId: accId,
          riskType: 'Issue',
          description: description.trim(),
          priority,
          status: status as any,
          ownerId: ownerId || undefined,
          impact: impact || undefined,
          riskOpenDate: dateIdentified || undefined,
          targetResolutionDate: targetResolutionDate || undefined,
          mitigationPlan: resolutionPlan.trim(),
          contingencyPlan: remarks.trim() || undefined,
        };

        if (isEdit) {
          const rawId = (issue as NormalizedRisk)?.sourceId || (issue as AccountRisk)?.id || issue?.id;
          await accountRisksApi.update(rawId!, payload);
        } else {
          await accountRisksApi.create(payload as any);
        }
      } else {
        // Project Level Issue
        const payload: Omit<ProjectIssue, 'id' | 'projectId' | 'ownerName'> = {
          priority,
          description: description.trim(),
          impact: impact || undefined,
          ownerId: ownerId || undefined,
          dateIdentified: dateIdentified || undefined,
          status: status as IssueStatus,
          resolutionPlan: resolutionPlan.trim(),
          targetResolutionDate: targetResolutionDate || undefined,
          remarks: remarks.trim(),
        };

        if (isEdit) {
          const rawId = (issue as NormalizedRisk)?.sourceId || (issue as ProjectIssue)?.id || issue?.id;
          await projectIssuesApi.update(projId, rawId!, payload);
        } else {
          await projectIssuesApi.create(projId, payload);
        }
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to save Issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? `Edit ${level} Issue` : `Add ${level} Issue`}
      icon={
        isEdit
          ? <Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />
          : <AlertCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : 'Create Issue'}
      submitVariant={isEdit ? 'warning' : 'primary'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* Scope & Location header if not fixed */}
        {!fixedLevel && (
          <FormSection title="Scope & Location">
            <FormGrid columns={3}>
              <FormField label="Level / Scope" required>
                <select
                  disabled={isEdit}
                  value={level}
                  onChange={(e) => {
                    const newLvl = e.target.value as 'Account' | 'Project';
                    setLevel(newLvl);
                    if (newLvl === 'Project' && selectedAccountId && !selectedProjectId) {
                      const validProjs = projects.filter((p) => p.accountId === selectedAccountId);
                      if (validProjs.length > 0) setSelectedProjectId(validProjs[0].id);
                    }
                  }}
                  className={`${selectCls} ${isEdit ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                >
                  <option value="Account">Account Level</option>
                  <option value="Project">Project Level</option>
                </select>
              </FormField>

              <FormField label="Account" required>
                <select
                  disabled={isEdit || !!fixedAccountId}
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className={`${selectCls} ${(isEdit || !!fixedAccountId) ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">— Select Account —</option>
                  {[...accounts]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </FormField>

              {level === 'Project' && (
                <FormField label="Project" required>
                  <select
                    disabled={isEdit || !!fixedProjectId}
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className={`${selectCls} ${(isEdit || !!fixedProjectId) ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">— Select Project —</option>
                    {[...accountProjects]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </FormField>
              )}
            </FormGrid>
          </FormSection>
        )}

        {/* Section 1: Issue Details */}
        <FormSection title="Issue Details">
          <div className="space-y-4">
            <FormField label="Description*" required wide>
              <AutoResizeTextarea
                required
                minRows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                className={inputCls}
              />
            </FormField>

            <FormGrid columns={3}>
              <FormField label="Priority*" required>
                <select
                  required
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className={selectCls}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={selectCls}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </FormField>

              <FormField label="Owner">
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Not assigned</option>
                  {[...serviceProviders]
                    .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {serviceProviderOptionLabel(user)}
                      </option>
                    ))}
                </select>
              </FormField>

              <FormField label="Impact">
                <select
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— Select —</option>
                  {RISK_IMPACT_OPTIONS.map((imp) => (
                    <option key={imp} value={imp}>
                      {imp}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date Identified">
                <input
                  type="date"
                  value={dateIdentified}
                  onChange={(e) => setDateIdentified(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </FormField>

              <FormField label="Target Resolution Date">
                <input
                  type="date"
                  value={targetResolutionDate}
                  onChange={(e) => setTargetResolutionDate(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </FormField>
            </FormGrid>
          </div>
        </FormSection>

        {/* Section 2: Resolution */}
        <FormSection title="Resolution">
          <div className="space-y-3">
            <FormField label="Resolution Plan" wide>
              <AutoResizeTextarea
                minRows={2}
                value={resolutionPlan}
                onChange={(e) => setResolutionPlan(e.target.value)}
                placeholder="How will this issue be resolved..."
                className={inputCls}
              />
            </FormField>

            <FormField label="Remarks" wide>
              <AutoResizeTextarea
                minRows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks..."
                className={inputCls}
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
};
