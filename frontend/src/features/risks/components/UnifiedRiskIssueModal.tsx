import React, { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { NormalizedRisk, AccountRisk, ProjectRisk, PriorityLevel, RiskStatus } from '@/types';
import { AlertTriangle, Pencil } from 'lucide-react';
import { calculateRiskSeverity, serviceProviderOptionLabel } from '@/utils';
import { accountRisksApi, projectRisksApi } from '@/api/crm.api';
import {
  RISK_RAG_OPTIONS,
  RISK_CLASSIFICATION_OPTIONS,
  RISK_IMPACT_OPTIONS,
  RISK_LIKELIHOOD_OPTIONS,
} from '@/constants';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SELECT_CLS,
} from '@/components/ui';

export interface UnifiedRiskIssueModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialAccountId?: string;
  risk?: NormalizedRisk | AccountRisk | ProjectRisk | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export const UnifiedRiskIssueModal: React.FC<UnifiedRiskIssueModalProps> = ({
  isOpen,
  mode,
  initialAccountId,
  risk,
  onClose,
  onSuccess,
}) => {
  const { accounts, projects, serviceProviders } = useCRM();
  const isEdit = mode === 'edit';

  const [level, setLevel] = useState<'Account' | 'Project'>('Account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [riskType, setRiskType] = useState<'Risk' | 'Issue'>('Risk');
  const [description, setDescription] = useState('');
  const [rag, setRag] = useState<string>('');
  const [classification, setClassification] = useState<string>('');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [status, setStatus] = useState<string>('Open');
  const [ownerId, setOwnerId] = useState('');
  const [riskOpenDate, setRiskOpenDate] = useState('');
  const [targetResolutionDate, setTargetResolutionDate] = useState('');
  const [impact, setImpact] = useState('');
  const [likelihood, setLikelihood] = useState('');
  const [impactDescription, setImpactDescription] = useState('');
  const [mitigationPlan, setMitigationPlan] = useState('');
  const [contingencyPlan, setContingencyPlan] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Available projects for selected Account
  const accountProjects = useMemo(() => {
    if (!selectedAccountId) return [];
    return projects.filter((p) => p.accountId === selectedAccountId);
  }, [projects, selectedAccountId]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');

    if (isEdit && risk) {
      const norm = risk as NormalizedRisk;
      const isProj = norm.sourceType === 'Project' || !!(risk as ProjectRisk).projectId || !!norm.projectId;
      setLevel(isProj ? 'Project' : 'Account');

      const accId = norm.accountId || (risk as AccountRisk).accountId || initialAccountId || '';
      setSelectedAccountId(accId);

      const projId = norm.projectId || (risk as ProjectRisk).projectId || '';
      setSelectedProjectId(projId);

      const rawType = String(norm.riskType || (risk as ProjectRisk).classification || 'Risk');
      const isIssueItem = rawType === 'Dependency' || rawType === 'Issue';
      setRiskType(isIssueItem ? 'Issue' : 'Risk');

      setDescription(norm.description || '');
      setRag(norm.rag || '');
      setClassification(
        norm.classification ||
          (risk as ProjectRisk).classification ||
          (risk as AccountRisk).classification ||
          ''
      );
      setPriority(norm.priority || (risk as AccountRisk).priority || 'Medium');
      setStatus(norm.status || 'Open');
      setOwnerId(norm.ownerId || (risk as AccountRisk).ownerId || '');
      setRiskOpenDate(norm.riskOpenDate || (risk as ProjectRisk).riskOpenDate || '');
      setTargetResolutionDate(norm.targetResolutionDate || (risk as AccountRisk).targetResolutionDate || '');
      setImpact(norm.impact || '');
      setLikelihood(norm.likelihood || '');
      setImpactDescription(norm.impactDescription || (risk as ProjectRisk).impactDescription || '');
      setMitigationPlan(norm.mitigationPlan || (risk as AccountRisk).mitigationPlan || '');
      setContingencyPlan(norm.contingencyPlan || (risk as ProjectRisk).contingencyPlan || '');
    } else {
      setLevel('Account');
      const accId = initialAccountId || (accounts.length > 0 ? accounts[0].id : '');
      setSelectedAccountId(accId);
      setSelectedProjectId('');
      setRiskType('Risk');
      setDescription('');
      setRag('');
      setClassification('');
      setPriority('Medium');
      setStatus('Open');
      setOwnerId('');
      setRiskOpenDate('');
      setTargetResolutionDate('');
      setImpact('');
      setLikelihood('');
      setImpactDescription('');
      setMitigationPlan('');
      setContingencyPlan('');
    }
  }, [isOpen, isEdit, risk, initialAccountId, accounts]);

  // When selected account changes, reset project if current project isn't under new account
  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    const validProjs = projects.filter((p) => p.accountId === accId);
    if (validProjs.length > 0) {
      setSelectedProjectId(validProjs[0].id);
    } else {
      setSelectedProjectId('');
    }
  };

  const computedSeverity = useMemo(
    () => calculateRiskSeverity(impact, likelihood) || (impact && likelihood ? priority : ''),
    [impact, likelihood, priority],
  );

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim()) {
      setErrorMsg('Description is required.');
      return;
    }
    if (!selectedAccountId) {
      setErrorMsg('Account is required.');
      return;
    }
    if (level === 'Project' && !selectedProjectId) {
      setErrorMsg('Project is required for Project Level items.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (level === 'Account') {
        const payload: Partial<AccountRisk> = {
          accountId: selectedAccountId,
          riskType,
          description: description.trim(),
          priority,
          status: status as RiskStatus,
          ownerId: ownerId || undefined,
          impact: impact || undefined,
          targetResolutionDate: targetResolutionDate || undefined,
          riskOpenDate: riskOpenDate || undefined,
          mitigationPlan: mitigationPlan.trim(),
          contingencyPlan: contingencyPlan.trim() || undefined,
          rag: riskType === 'Risk' ? ((rag as any) || undefined) : undefined,
          classification: riskType === 'Risk' ? (classification || undefined) : undefined,
          likelihood: riskType === 'Risk' ? (likelihood || undefined) : undefined,
          severity: riskType === 'Risk' ? (computedSeverity || priority) : undefined,
          impactDescription: riskType === 'Risk' ? (impactDescription.trim() || undefined) : undefined,
        };

        if (isEdit) {
          const rawId = (risk as NormalizedRisk)?.sourceId || (risk as AccountRisk)?.id || risk?.id;
          await accountRisksApi.update(rawId!, payload);
        } else {
          await accountRisksApi.create(payload as any);
        }
      } else {
        // Project Level
        const payload: Omit<ProjectRisk, 'id' | 'projectId' | 'ownerName'> = {
          priority,
          description: description.trim(),
          impact: impact || undefined,
          likelihood: riskType === 'Risk' ? (likelihood || undefined) : undefined,
          severity: riskType === 'Risk' ? (computedSeverity || priority) : undefined,
          impactDescription: riskType === 'Risk' ? (impactDescription.trim() || undefined) : undefined,
          contingencyPlan: contingencyPlan.trim() || undefined,
          riskOpenDate: riskOpenDate || undefined,
          ownerId: ownerId || undefined,
          mitigationPlan: mitigationPlan.trim(),
          status: status as RiskStatus,
          targetResolutionDate: targetResolutionDate || undefined,
          rag: riskType === 'Risk' ? ((rag as any) || undefined) : undefined,
          classification: riskType === 'Risk' ? (classification || riskType) : riskType,
        };

        if (isEdit) {
          const rawId = (risk as NormalizedRisk)?.sourceId || (risk as ProjectRisk)?.id || risk?.id;
          await projectRisksApi.update(selectedProjectId, rawId!, payload);
        } else {
          await projectRisksApi.create(selectedProjectId, payload);
        }
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to save Risk & Issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? `Edit ${level} ${riskType}` : `Add ${riskType}`}
      icon={
        isEdit
          ? <Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />
          : <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : `Create ${riskType}`}
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

        {/* Scope & Type Header */}
        <FormSection title="Scope & Entry Type">
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
                disabled={isEdit || !!initialAccountId}
                value={selectedAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className={`${selectCls} ${(isEdit || !!initialAccountId) ? 'bg-slate-100 cursor-not-allowed' : ''}`}
              >
                <option value="">— Select Account —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </FormField>

            {level === 'Project' && (
              <FormField label="Project" required>
                <select
                  disabled={isEdit}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className={`${selectCls} ${isEdit ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">— Select Project —</option>
                  {accountProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Entry Type" required>
              <select
                value={riskType}
                onChange={(e) => {
                  const nextType = e.target.value as 'Risk' | 'Issue';
                  setRiskType(nextType);
                  if (nextType === 'Risk' && (status === 'In Progress' || status === 'Resolved')) {
                    setStatus('Open');
                  } else if (nextType === 'Issue' && (status === 'Mitigated' || status === 'Accepted')) {
                    setStatus('Open');
                  }
                }}
                className={selectCls}
              >
                <option value="Risk">Risk</option>
                <option value="Issue">Issue</option>
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* DYNAMIC FORM LAYOUT BASED ON ENTRY TYPE */}
        {riskType === 'Risk' ? (
          /* ======================================================== */
          /*                       RISK FORM                          */
          /* ======================================================== */
          <>
            <FormSection title="Risk Details">
              <div className="space-y-4">
                <FormField label="Description*" required wide>
                  <textarea
                    required
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the risk..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>

                <FormGrid columns={3}>
                  <FormField label="RAG Status">
                    <select
                      value={rag}
                      onChange={(e) => setRag(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      {RISK_RAG_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Classification">
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      {RISK_CLASSIFICATION_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </FormField>

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
                      <option value="Mitigated">Mitigated</option>
                      <option value="Closed">Closed</option>
                      <option value="Accepted">Accepted</option>
                    </select>
                  </FormField>

                  <FormField label="Owner">
                    <select
                      value={ownerId}
                      onChange={(e) => setOwnerId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Not assigned</option>
                      {serviceProviders.map((user) => (
                        <option key={user.id} value={user.id}>
                          {serviceProviderOptionLabel(user)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Risk Open Date">
                    <input
                      type="date"
                      value={riskOpenDate}
                      onChange={(e) => setRiskOpenDate(e.target.value)}
                      placeholder="dd-mm-yyyy"
                      className={`${inputCls} font-mono`}
                    />
                  </FormField>

                  <FormField label="Target Resolution Date">
                    <input
                      type="date"
                      value={targetResolutionDate}
                      onChange={(e) => setTargetResolutionDate(e.target.value)}
                      placeholder="dd-mm-yyyy"
                      className={`${inputCls} font-mono`}
                    />
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

                  <FormField label="Likelihood">
                    <select
                      value={likelihood}
                      onChange={(e) => setLikelihood(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      {RISK_LIKELIHOOD_OPTIONS.map((lik) => (
                        <option key={lik} value={lik}>
                          {lik}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Severity (Calculated)">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={computedSeverity}
                      placeholder="Auto-calculated"
                      className={`${inputCls} bg-slate-100 text-slate-700 font-semibold cursor-not-allowed`}
                    />
                  </FormField>
                </FormGrid>
              </div>
            </FormSection>

            <FormSection title="Impact & Plans">
              <div className="space-y-3">
                <FormField label="Impact Description" wide>
                  <textarea
                    rows={2}
                    value={impactDescription}
                    onChange={(e) => setImpactDescription(e.target.value)}
                    placeholder="Describe potential impact of the risk..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>

                <FormField label="Mitigation Plan" wide>
                  <textarea
                    rows={2}
                    value={mitigationPlan}
                    onChange={(e) => setMitigationPlan(e.target.value)}
                    placeholder="How will this risk be mitigated..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>

                <FormField label="Contingency Plan" wide>
                  <textarea
                    rows={2}
                    value={contingencyPlan}
                    onChange={(e) => setContingencyPlan(e.target.value)}
                    placeholder="Describe contingency plan if risk occurs..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>
              </div>
            </FormSection>
          </>
        ) : (
          /* ======================================================== */
          /*                       ISSUE FORM                         */
          /* ======================================================== */
          <>
            <FormSection title="Issue Details">
              <div className="space-y-4">
                <FormField label="Description*" required wide>
                  <textarea
                    required
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue..."
                    className={`${inputCls} resize-none`}
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
                      {serviceProviders.map((user) => (
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
                      value={riskOpenDate}
                      onChange={(e) => setRiskOpenDate(e.target.value)}
                      placeholder="dd-mm-yyyy"
                      className={`${inputCls} font-mono`}
                    />
                  </FormField>

                  <FormField label="Target Resolution Date">
                    <input
                      type="date"
                      value={targetResolutionDate}
                      onChange={(e) => setTargetResolutionDate(e.target.value)}
                      placeholder="dd-mm-yyyy"
                      className={`${inputCls} font-mono`}
                    />
                  </FormField>
                </FormGrid>
              </div>
            </FormSection>

            <FormSection title="Resolution">
              <div className="space-y-3">
                <FormField label="Resolution Plan" wide>
                  <textarea
                    rows={2}
                    value={mitigationPlan}
                    onChange={(e) => setMitigationPlan(e.target.value)}
                    placeholder="How will this issue be resolved..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>

                <FormField label="Remarks" wide>
                  <textarea
                    rows={2}
                    value={contingencyPlan}
                    onChange={(e) => setContingencyPlan(e.target.value)}
                    placeholder="Remarks..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>
              </div>
            </FormSection>
          </>
        )}
      </div>
    </FormModal>
  );
};
