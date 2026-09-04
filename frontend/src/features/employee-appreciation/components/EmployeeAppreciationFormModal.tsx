import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Modal, ModalFooter, Button, INPUT_CLS } from '@/components/ui';
import { EmployeeAppreciation } from '@/types';
import { getTodayISODate } from '@/utils';
import { HeartHandshake, User, Building2, FolderKanban, Calendar, MessageSquare, Tag } from 'lucide-react';

const LABEL_CLS = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1';

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
  const availableProjects = React.useMemo(() => {
    if (!accountId) return projects;
    return projects.filter((p) => p.accountId === accountId);
  }, [projects, accountId]);

  // Filter stakeholders by selected Account
  const availableStakeholders = React.useMemo(() => {
    if (!accountId) return stakeholders;
    return stakeholders.filter((s) => s.accountId === accountId);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <span>{initialData ? 'Edit Employee Appreciation' : 'Log Employee Appreciation'}</span>
        </div>
      }
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-2">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Received Date */}
          <div>
            <label className={LABEL_CLS}>
              <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Received Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className={INPUT_CLS}
              required
            />
          </div>

          {/* Internal / External */}
          <div>
            <label className={LABEL_CLS}>
              <Tag className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Source Type (Internal / External) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setInternalExternal('External')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                  internalExternal === 'External'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                External (Client / Partner)
              </button>
              <button
                type="button"
                onClick={() => setInternalExternal('Internal')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                  internalExternal === 'Internal'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Internal (Colleague / Lead)
              </button>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className={LABEL_CLS}>
              <Building2 className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Account <span className="text-red-500">*</span>
            </label>
            <select
              value={accountId}
              onChange={(e) => handleAccountChange(e.target.value)}
              className={INPUT_CLS}
              required
            >
              <option value="">Select Account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div>
            <label className={LABEL_CLS}>
              <FolderKanban className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Project (Optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">None (Account Level)</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Name */}
          <div>
            <label className={LABEL_CLS}>
              <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Employee Name <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {serviceProviders.length > 0 && (
                <select
                  value={employeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none mb-1 cursor-pointer"
                >
                  <option value="">Quick select from Team Directory…</option>
                  {serviceProviders.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} {sp.designation ? `(${sp.designation})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Or enter employee name..."
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className={INPUT_CLS}
                required
              />
            </div>
          </div>

          {/* Emp ID (Optional) */}
          <div>
            <label className={LABEL_CLS}>Emp ID (Optional)</label>
            <input
              type="text"
              placeholder="e.g. EMP-1024"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Respondent Name */}
          <div className="md:col-span-2">
            <label className={LABEL_CLS}>
              <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Respondent Name (Appreciation Given By) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {availableStakeholders.length > 0 && (
                <select
                  value={respondentId}
                  onChange={(e) => handleSelectRespondent(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none mb-1 cursor-pointer"
                >
                  <option value="">Quick select from Account Stakeholders…</option>
                  {availableStakeholders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.designation || 'Client Stakeholder'})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Enter respondent name (e.g. Jane Doe, VP Engineering)..."
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                className={INPUT_CLS}
                required
              />
            </div>
          </div>
        </div>

        {/* Feedback Multiline Textarea */}
        <div>
          <label className={LABEL_CLS}>
            <MessageSquare className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            Appreciation / Feedback Comments <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            placeholder="Capture the full appreciation quote, client email feedback, or commendation details..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className={`${INPUT_CLS} resize-y leading-relaxed font-medium`}
            required
          />
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : initialData ? 'Update Appreciation' : 'Save Appreciation'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
