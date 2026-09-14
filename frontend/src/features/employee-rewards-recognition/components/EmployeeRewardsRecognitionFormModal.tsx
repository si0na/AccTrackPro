import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { usersApi } from '@/api/crm.api';
import { User, EmployeeRewardsRecognition } from '@/types';
import { Award, Pencil, User as UserIcon, Calendar, Info } from 'lucide-react';
import {
  FormGrid,
  FormModal,
  FormSection,
  FormField,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SELECT_CLS,
} from '@/components/ui';
import {
  REWARDS_RECOGNITION_TYPE_OPTIONS,
  REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS,
  REWARDS_RECOGNITION_STATUS_OPTIONS,
  REWARDS_RECOGNITION_CATEGORIES_BY_TYPE,
} from '@/constants/rewards-recognition';

export interface EmployeeRewardsRecognitionFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: EmployeeRewardsRecognition | null;
  onClose: () => void;
  onSubmit: (draft: Omit<EmployeeRewardsRecognition, 'id' | 'createdAt' | 'updatedAt'> | Partial<EmployeeRewardsRecognition>) => Promise<void> | void;
}

const getCurrentMonthYearISO = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const EmployeeRewardsRecognitionFormModal: React.FC<EmployeeRewardsRecognitionFormModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  const isEdit = mode === 'edit';
  const { currentUser } = useCRM();

  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, [isOpen]);

  const [monthOfRr, setMonthOfRr] = useState<string>(getCurrentMonthYearISO());
  const [nominatedById, setNominatedById] = useState<string>('');
  const [nominatedByName, setNominatedByName] = useState<string>('');
  const [type, setType] = useState<string>('Continous');
  const [category, setCategory] = useState<string>('Spot Award');
  const [teamOrIndividual, setTeamOrIndividual] = useState<string>('Individual');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [status, setStatus] = useState<string>('Nominated - Not Won');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available categories based on selected Type
  const availableCategories = useMemo(() => {
    return REWARDS_RECOGNITION_CATEGORIES_BY_TYPE[type] || [];
  }, [type]);

  // Seed form on open
  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && initialData) {
      setMonthOfRr(initialData.monthOfRr || getCurrentMonthYearISO());
      setNominatedById(initialData.nominatedById || '');
      setNominatedByName(initialData.nominatedByName || '');
      setType(initialData.type || 'Continous');
      setCategory(initialData.category || '');
      setTeamOrIndividual(initialData.teamOrIndividual || 'Individual');
      setEmployeeId(initialData.employeeId || '');
      setEmployeeName(initialData.employeeName || '');
      setStatus(initialData.status || 'Nominated - Not Won');
      setDetails(initialData.details || '');
    } else {
      setMonthOfRr(getCurrentMonthYearISO());
      setNominatedById('');
      setNominatedByName(currentUser || '');
      setType('Continous');
      setCategory('Spot Award');
      setTeamOrIndividual('Individual');
      setEmployeeId('');
      setEmployeeName('');
      setStatus('Nominated - Not Won');
      setDetails('');
    }
  }, [isOpen, isEdit, initialData, currentUser]);

  // When Type changes, validate Category and reset if incompatible
  const handleTypeChange = (newType: string) => {
    setType(newType);
    const validCats = REWARDS_RECOGNITION_CATEGORIES_BY_TYPE[newType] || [];
    if (!validCats.includes(category)) {
      setCategory(validCats[0] || '');
    }
  };

  const inputCls = isEdit ? INPUT_CLS_AMBER : INPUT_CLS;
  const selectCls = `${inputCls} bg-white cursor-pointer`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthOfRr.trim() || !type || !category || !teamOrIndividual || !status || !details.trim()) {
      return;
    }
    if (teamOrIndividual === 'Individual' && !employeeName.trim() && !employeeId) {
      return;
    }

    setIsSubmitting(true);
    try {
      let resolvedNominatedByName = nominatedByName;
      if (nominatedById) {
        const found = users.find(u => u.id === nominatedById);
        if (found) resolvedNominatedByName = found.name;
      }

      let resolvedEmployeeName = employeeName;
      if (teamOrIndividual === 'Individual' && employeeId) {
        const found = users.find(u => u.id === employeeId);
        if (found) resolvedEmployeeName = found.name;
      }

      await onSubmit({
        monthOfRr,
        nominatedById: nominatedById || undefined,
        nominatedByName: resolvedNominatedByName || currentUser,
        type: type as any,
        category,
        teamOrIndividual: teamOrIndividual as any,
        employeeId: teamOrIndividual === 'Individual' ? (employeeId || undefined) : undefined,
        employeeName: teamOrIndividual === 'Individual' ? resolvedEmployeeName : 'Team',
        status: status as any,
        details,
      });
      onClose();
    } catch {
      // Failure handled centrally
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? 'Edit Recognition Nomination' : 'Create Rewards & Recognition Nomination'}
      icon={
        isEdit ? (
          <Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />
        ) : (
          <Award className="w-5 h-5 text-indigo-600" aria-hidden="true" />
        )
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save Changes' : 'Submit Nomination'}
      submitVariant={isEdit ? 'warning' : 'primary'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Basic Info Section */}
        <FormSection title="Nomination Scope & Timeline">
          <FormGrid columns={2}>
            <FormField label="Month of the R&R" required>
              <input
                type="month"
                required
                value={monthOfRr}
                onChange={(e) => setMonthOfRr(e.target.value)}
                className={inputCls}
              />
            </FormField>

            <FormField label="Nominated By" required>
              <select
                value={nominatedById}
                onChange={(e) => {
                  const id = e.target.value;
                  setNominatedById(id);
                  const selUser = users.find(u => u.id === id);
                  if (selUser) setNominatedByName(selUser.name);
                }}
                className={selectCls}
              >
                <option value="">{nominatedByName ? `Current: ${nominatedByName}` : 'Select Nominator...'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role || u.email})
                  </option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Award Type & Category Section */}
        <FormSection title="Award Type & Category">
          <FormGrid columns={2}>
            <FormField label="Type" required>
              <select
                required
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className={selectCls}
              >
                {REWARDS_RECOGNITION_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Category" required>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectCls}
              >
                <option value="" disabled>Select category...</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Nominee Details Section */}
        <FormSection title="Nominee & Status">
          <FormGrid columns={3}>
            <FormField label="Team / Individual" required>
              <select
                required
                value={teamOrIndividual}
                onChange={(e) => {
                  const val = e.target.value;
                  setTeamOrIndividual(val);
                  if (val === 'Team') {
                    setEmployeeId('');
                    setEmployeeName('Team');
                  }
                }}
                className={selectCls}
              >
                {REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </FormField>

            {teamOrIndividual === 'Individual' ? (
              <FormField label="Employee Name" required>
                <select
                  required
                  value={employeeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setEmployeeId(id);
                    const found = users.find(u => u.id === id);
                    if (found) setEmployeeName(found.name);
                  }}
                  className={selectCls}
                >
                  <option value="">Select Employee...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.department || u.role || u.email})
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Target Team">
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Project Alpha Team / Engineering"
                  className={inputCls}
                />
              </FormField>
            )}

            <FormField label="Status" required>
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                {REWARDS_RECOGNITION_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Details Section */}
        <FormSection title="Nomination Details & Citation">
          <FormField label="Details" required wide>
            <textarea
              required
              rows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide reason for nomination, key achievements, impact details, and supporting recognition narrative..."
              className={`${inputCls} resize-none leading-relaxed`}
            />
          </FormField>
        </FormSection>
      </div>
    </FormModal>
  );
};
