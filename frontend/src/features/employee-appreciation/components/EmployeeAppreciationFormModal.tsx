import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
  FormModal,
  FormSection,
  FormGrid,
  FormField,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SELECT_CLS,
} from '@/components/ui';
import { EmployeeAppreciation } from '@/types';
import { getTodayISODate } from '@/utils';
import { HeartHandshake } from 'lucide-react';

export interface EmployeeAppreciationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: EmployeeAppreciation | null;
  /** Pre-selected Account ID when opened from Account Details view */
  defaultAccountId?: string;
  /** Pre-selected Project ID when opened from Project Details view */
  defaultProjectId?: string;
}

export const EmployeeAppreciationFormModal: React.FC<EmployeeAppreciationFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  defaultAccountId,
  defaultProjectId,
}) => {
  const {
    accounts,
    projects,
    serviceProviders,
    stakeholders,
    addEmployeeAppreciation,
    updateEmployeeAppreciation,
  } = useCRM();

  const isEdit = !!initialData;

  const [receivedDate, setReceivedDate] = useState<string>(getTodayISODate());
  const [accountId, setAccountId] = useState<string>(defaultAccountId || '');
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [empId, setEmpId] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [respondentId, setRespondentId] = useState<string>('');
  const [respondentName, setRespondentName] = useState<string>('');
  const [internalExternal, setInternalExternal] = useState<'Internal' | 'External'>('External');
  const [feedback, setFeedback] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter projects by selected Account
  const availableProjects = useMemo(() => {
    const list = !accountId ? projects : projects.filter((p) => p.accountId === accountId);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [projects, accountId]);

  // Filter stakeholders by selected Account
  const availableStakeholders = useMemo(() => {
    const list = !accountId ? stakeholders : stakeholders.filter((s) => s.accountId === accountId);
    return [...list].sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }));
  }, [stakeholders, accountId]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setReceivedDate(initialData.receivedDate || getTodayISODate());
        setAccountId(initialData.accountId || defaultAccountId || '');
        setProjectId(initialData.projectId || defaultProjectId || '');
        setEmpId(initialData.empId || '');
        setEmployeeId(initialData.employeeId || '');
        setEmployeeName(initialData.employeeName || '');
        setRespondentId(initialData.respondentId || '');
        setRespondentName(initialData.respondentName || '');
        setInternalExternal(initialData.internalExternal || 'External');
        setFeedback(initialData.feedback || '');
      } else {
        setReceivedDate(getTodayISODate());
        setAccountId(defaultAccountId || (accounts[0]?.id ?? ''));
        setProjectId(defaultProjectId || '');
        setEmpId('');
        setEmployeeId('');
        setEmployeeName('');
        setRespondentId('');
        setRespondentName('');
        setInternalExternal('External');
        setFeedback('');
      }
      setError(null);
    }
  }, [isOpen, initialData, defaultAccountId, defaultProjectId, accounts]);

  // When Account changes, reset project if it belongs to another account
  const handleAccountChange = (newAccId: string) => {
    setAccountId(newAccId);
    if (projectId) {
      const match = projects.find((p) => p.id === projectId);
      if (match && match.accountId !== newAccId) {
        setProjectId('');
      }
    }
  };

  // Helper when selecting an existing Employee/User from Service Provider directory
  const handleSelectEmployee = (spId: string) => {
    if (!spId) {
      setEmployeeId('');
      return;
    }
    const sp = serviceProviders.find((s) => s.id === spId);
    if (sp) {
      setEmployeeId(sp.id);
      setEmployeeName(sp.name);
    }
  };

  // Helper when selecting an existing Stakeholder
  const handleSelectRespondent = (stkId: string) => {
    if (!stkId) {
      setRespondentId('');
      return;
    }
    const stk = stakeholders.find((s) => s.id === stkId);
    if (stk) {
      setRespondentId(stk.id);
      setRespondentName(stk.name);
    }
  };

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedDate) {
      setError('Please select a Received Date.');
      return;
    }
    if (!accountId) {
      setError('Please select an Account.');
      return;
    }
    if (!employeeName.trim()) {
      setError('Please enter or select an Employee Name.');
      return;
    }
    if (!respondentName.trim()) {
      setError('Please enter or select a Respondent Name.');
      return;
    }
    if (!feedback.trim()) {
      setError('Please enter feedback/appreciation comments.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (initialData) {
        await updateEmployeeAppreciation(initialData.id, {
          receivedDate,
          accountId,
          projectId: projectId || undefined,
          empId: empId.trim() || undefined,
          employeeId: employeeId || undefined,
          employeeName: employeeName.trim(),
          respondentId: respondentId || undefined,
          respondentName: respondentName.trim(),
          internalExternal,
          feedback: feedback.trim(),
        });
      } else {
        await addEmployeeAppreciation({
          receivedDate,
          accountId,
          projectId: projectId || undefined,
          empId: empId.trim() || undefined,
          employeeId: employeeId || undefined,
          employeeName: employeeName.trim(),
          respondentId: respondentId || undefined,
          respondentName: respondentName.trim(),
          internalExternal,
          feedback: feedback.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to save Employee Appreciation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Employee Appreciation' : 'Log Employee Appreciation'}
      icon={<HeartHandshake className="w-5 h-5 text-blue-600" />}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Update Appreciation' : 'Save Appreciation'}
      submitVariant={isEdit ? 'warning' : 'primary'}
      isSubmitting={submitting}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
            {error}
          </div>
        )}

        {/* Section 1: Record Scope & Dates */}
        <FormSection title="General Information">
          <FormGrid columns={3}>
            <FormField label="Received Date" required>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className={inputCls}
                required
              />
            </FormField>

            <FormField label="Source Type" required>
              <select
                value={internalExternal}
                onChange={(e) => setInternalExternal(e.target.value as 'Internal' | 'External')}
                className={selectCls}
                required
              >
                <option value="External">External (Client / Partner)</option>
                <option value="Internal">Internal (Colleague / Lead)</option>
              </select>
            </FormField>

            <FormField label="Account" required>
              <select
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className={selectCls}
                required
              >
                <option value="">Select Account…</option>
                {[...accounts]
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </FormField>
          </FormGrid>

          <FormGrid columns={2} className="mt-4">
            <FormField label="Project (Optional)">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={selectCls}
              >
                <option value="">None (Account Level)</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Section 2: Employee Receiving Appreciation */}
        <FormSection title="Employee Details">
          <FormGrid columns={2}>
            <FormField label="Select from Directory (Optional)">
              <select
                value={employeeId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className={selectCls}
              >
                <option value="">— Select from Team Directory —</option>
                {[...serviceProviders]
                  .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }))
                  .map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} {sp.designation ? `(${sp.designation})` : ''}
                    </option>
                  ))}
              </select>
            </FormField>

            <FormField label="Emp ID (Optional)">
              <input
                type="text"
                placeholder="e.g. EMP-1024"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className={inputCls}
              />
            </FormField>

            <FormField label="Employee Name" required wide>
              <input
                type="text"
                placeholder="Enter full employee name..."
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className={inputCls}
                required
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Section 3: Respondent / Giver of Appreciation */}
        <FormSection title="Appreciation Source / Respondent">
          <FormGrid columns={2}>
            {availableStakeholders.length > 0 && (
              <FormField label="Select Stakeholder (Optional)">
                <select
                  value={respondentId}
                  onChange={(e) => handleSelectRespondent(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— Select Account Stakeholder —</option>
                  {availableStakeholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.designation || 'Client Stakeholder'})
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Respondent Name (Given By)" required wide={availableStakeholders.length === 0}>
              <input
                type="text"
                placeholder="Enter respondent name (e.g. Jane Doe, VP Engineering)..."
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                className={inputCls}
                required
              />
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Section 4: Feedback Comments */}
        <FormSection title="Appreciation Details">
          <FormField label="Appreciation / Feedback Comments" required wide>
            <textarea
              rows={4}
              placeholder="Capture the full appreciation quote, client email feedback, or commendation details..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className={`${inputCls} resize-y leading-relaxed font-medium`}
              required
            />
          </FormField>
        </FormSection>
      </div>
    </FormModal>
  );
};
