import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { usersApi, serviceProvidersApi, employeeMasterApi } from '@/api/crm.api';
import { User, EmployeeRewardsRecognition } from '@/types';
import { Award, Pencil } from 'lucide-react';
import {
  FormGrid,
  FormModal,
  FormSection,
  FormField,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  SELECT_CLS,
} from '@/components/ui';
import { MultiEmployeePicker } from '@/components/MultiEmployeePicker';
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
  const { currentUser, serviceProviders: contextServiceProviders } = useCRM();

  const [users, setUsers] = useState<User[]>([]);
  const [fetchedSpUsers, setFetchedSpUsers] = useState<any[]>([]);
  const [fetchedEmpMaster, setFetchedEmpMaster] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
    serviceProvidersApi.getAll().then(setFetchedSpUsers).catch(() => setFetchedSpUsers([]));
    employeeMasterApi.getAll().then(setFetchedEmpMaster).catch(() => setFetchedEmpMaster([]));
  }, [isOpen]);

  // Connect system employee options to serviceProviders, employeeMaster & users lists
  const spUsers = useMemo(() => {
    const list: Array<{ id: string; name: string; email: string; role: string; department: string }> = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();

    const addCandidate = (item: any) => {
      if (!item) return;
      const resolvedName = (item.name || item.fullName || item.displayName || item.email || '').trim();
      if (!resolvedName) return;

      const email = (item.email || '').trim().toLowerCase();
      const nameKey = resolvedName.toLowerCase();
      const primaryKey = email || nameKey;
      const id = item.id || primaryKey;

      if (seenIds.has(id) || seenKeys.has(primaryKey) || seenKeys.has(nameKey)) return;

      seenIds.add(id);
      if (email) seenKeys.add(email);
      seenKeys.add(nameKey);

      list.push({
        id,
        name: resolvedName,
        email: item.email || '',
        role: item.designation || item.role || item.department || '',
        department: item.department || '',
      });
    };

    if (contextServiceProviders && contextServiceProviders.length > 0) {
      contextServiceProviders.forEach(addCandidate);
    }
    if (fetchedSpUsers && fetchedSpUsers.length > 0) {
      fetchedSpUsers.forEach(addCandidate);
    }
    if (fetchedEmpMaster && fetchedEmpMaster.length > 0) {
      fetchedEmpMaster.forEach(addCandidate);
    }
    if (users && users.length > 0) {
      users.forEach(addCandidate);
    }

    return list;
  }, [contextServiceProviders, fetchedSpUsers, fetchedEmpMaster, users]);

  const [monthOfRr, setMonthOfRr] = useState<string>(getCurrentMonthYearISO());
  const [nominatedById, setNominatedById] = useState<string>('');
  const [nominatedByName, setNominatedByName] = useState<string>('');
  const [type, setType] = useState<string>('Continous');
  const [category, setCategory] = useState<string>('Spot Award');
  const [teamOrIndividual, setTeamOrIndividual] = useState<string>('Individual');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<string>('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
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
      setNominatedByName(initialData.nominatedByName || currentUser || '');
      setType(initialData.type || 'Continous');
      setCategory(initialData.category || '');
      setTeamOrIndividual(initialData.teamOrIndividual || 'Individual');
      setEmployeeId(initialData.employeeId || '');
      setEmployeeName(initialData.employeeName || '');
      setTeamMembers(initialData.teamMembers || '');
      setTeamMemberIds(initialData.teamMemberIds || []);
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
      setTeamMembers('');
      setTeamMemberIds([]);
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

    let resolvedNominatedByName = nominatedByName.trim();
    if (nominatedById) {
      const found = spUsers.find(u => u.id === nominatedById);
      if (found) resolvedNominatedByName = found.name;
    }
    if (!resolvedNominatedByName) {
      resolvedNominatedByName = currentUser || 'Nominator';
    }

    let resolvedEmployeeName = employeeName.trim();
    if (teamOrIndividual === 'Individual') {
      if (employeeId) {
        const found = spUsers.find(u => u.id === employeeId);
        if (found) resolvedEmployeeName = found.name;
      }
      if (!resolvedEmployeeName) return; // Individual requires employee name
    } else if (teamOrIndividual === 'Team' && !resolvedEmployeeName) {
      resolvedEmployeeName = 'Team Nomination';
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        monthOfRr,
        nominatedById: nominatedById || undefined,
        nominatedByName: resolvedNominatedByName,
        type: type as any,
        category,
        teamOrIndividual: teamOrIndividual as any,
        employeeId: teamOrIndividual === 'Individual' ? (employeeId || undefined) : undefined,
        employeeName: resolvedEmployeeName,
        teamMembers: teamOrIndividual === 'Team' ? (teamMembers.trim() || undefined) : undefined,
        teamMemberIds: teamOrIndividual === 'Team' ? (teamMemberIds.length ? teamMemberIds : undefined) : undefined,
        status: status as any,
        details: details.trim(),
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
                  const selUser = spUsers.find(u => u.id === id);
                  if (selUser) setNominatedByName(selUser.name);
                }}
                className={selectCls}
              >
                <option value="">{nominatedByName ? `Current: ${nominatedByName}` : 'Select Nominator...'}</option>
                {spUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role ? `(${u.role})` : u.email ? `(${u.email})` : ''}
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
                  if (val === 'Team' && (!employeeName || employeeName === 'Individual')) {
                    setEmployeeId('');
                    setEmployeeName('Team Nomination');
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
                    const found = spUsers.find(u => u.id === id);
                    if (found) setEmployeeName(found.name);
                  }}
                  className={selectCls}
                >
                  <option value="">Select Employee...</option>
                  {spUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.role ? `(${u.role})` : u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Target Team Name">
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

            {/* Single Team Members Field connected to employee list */}
            {teamOrIndividual === 'Team' && (
              <div className="sm:col-span-full">
                <FormField label="Team Members" wide>
                  <MultiEmployeePicker
                    users={spUsers}
                    selectedIds={teamMemberIds}
                    onChangeIds={setTeamMemberIds}
                    valueText={teamMembers}
                    onChangeText={setTeamMembers}
                    placeholder="Search or select employee names to add..."
                  />
                </FormField>
              </div>
            )}
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
