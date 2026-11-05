/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type {
  Account,
  Stakeholder,
  ServiceProviderUser,
  StakeholderConnect,
  ConnectStatus,
} from '@/types';
import { stakeholderConnectsApi } from '@/api/crm.api';
import { getTodayISODate } from '@/utils';
import {
  FormModal,
  FormField,
  FormGrid,
  INPUT_CLS,
  SELECT_CLS,
  ErrorBanner,
} from '@/components/ui';
import { CalendarCheck, Users, Info } from 'lucide-react';
import { showToast } from '@/components/common/ToastHost';

export interface ConnectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedConnect: StakeholderConnect) => void;
  accounts: Account[];
  stakeholders: Stakeholder[];
  serviceProviders: ServiceProviderUser[];
  currentUserId?: string;
  editConnect?: StakeholderConnect | null;
  initialAccountId?: string;
  initialStakeholderId?: string;
}

export const ConnectFormModal: React.FC<ConnectFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  stakeholders,
  serviceProviders,
  currentUserId,
  editConnect,
  initialAccountId,
  initialStakeholderId,
}) => {
  const isEditing = !!editConnect;

  const [accountId, setAccountId] = useState(
    editConnect?.accountId || initialAccountId || (accounts[0]?.id ?? '')
  );
  const [title, setTitle] = useState(editConnect?.title || '');
  const [meetingDate, setMeetingDate] = useState(editConnect?.meetingDate || getTodayISODate());
  const [meetingTime, setMeetingTime] = useState(
    editConnect?.meetingTime ? editConnect.meetingTime.slice(0, 5) : '10:00'
  );
  const [ownerId, setOwnerId] = useState(
    editConnect?.ownerId || currentUserId || (serviceProviders[0]?.id ?? '')
  );
  const [status, setStatus] = useState<ConnectStatus>(editConnect?.status || 'Scheduled');
  const [mom, setMom] = useState(editConnect?.mom || editConnect?.momNotes || '');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [selectedStakeholderIds, setSelectedStakeholderIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Eligible stakeholders: Client stakeholders for this account + active Service Providers associated with this account or global
  const eligibleStakeholders = useMemo(() => {
    if (!accountId) return [];
    return stakeholders.filter(
      (s) => s.accountId === accountId || (s.stakeholderType === 'SERVICE_PROVIDER' && !s.accountId)
    );
  }, [stakeholders, accountId]);

  const isDateTimeChanged = useMemo(() => {
    if (!isEditing || !editConnect) return false;
    const origDate = editConnect.meetingDate || '';
    const origTime = editConnect.meetingTime ? editConnect.meetingTime.slice(0, 5) : '';
    const currTime = meetingTime.slice(0, 5);
    return meetingDate !== origDate || currTime !== origTime;
  }, [isEditing, editConnect, meetingDate, meetingTime]);

  useEffect(() => {
    if (!isOpen) return;

    if (editConnect) {
      setAccountId(editConnect.accountId);
      setTitle(editConnect.title);
      setMeetingDate(editConnect.meetingDate);
      setMeetingTime(editConnect.meetingTime ? editConnect.meetingTime.slice(0, 5) : '10:00');
      setOwnerId(editConnect.ownerId);
      setStatus(editConnect.status);
      setMom(editConnect.mom || editConnect.momNotes || '');
      setRescheduleReason('');
      const existingIds = editConnect.attendees?.map((a: any) =>
        typeof a === 'string' ? a : (a.stakeholderId || a.id)
      ).filter((id): id is string => typeof id === 'string' && id.trim().length > 0) || [];
      setSelectedStakeholderIds(existingIds);
    } else {
      const effAccId = initialAccountId || (accounts[0]?.id ?? '');
      setAccountId(effAccId);
      setTitle('');
      setMeetingDate(getTodayISODate());
      setMeetingTime('10:00');
      setOwnerId(currentUserId || (serviceProviders[0]?.id ?? ''));
      setStatus('Scheduled');
      setMom('');
      setRescheduleReason('');

      // If opened from stakeholder row, prefill that contextual stakeholder IF eligible for this account
      if (initialStakeholderId) {
        const initId = typeof initialStakeholderId === 'string'
          ? initialStakeholderId
          : (initialStakeholderId as any)?.id;
        const isEligible = stakeholders.some(
          (s) => s.id === initId && (s.accountId === effAccId || (s.stakeholderType === 'SERVICE_PROVIDER' && !s.accountId))
        );
        setSelectedStakeholderIds(isEligible && initId ? [initId] : []);
      } else {
        // Global Schedule Connect flow: all attendee checkboxes must initially be unchecked
        setSelectedStakeholderIds([]);
      }
    }
    setError(null);
  }, [editConnect, initialAccountId, initialStakeholderId, accounts, currentUserId, serviceProviders, stakeholders, isOpen]);

  const toggleStakeholder = (stkId: string) => {
    const targetId = typeof stkId === 'string' ? stkId : (stkId as any)?.id;
    if (!targetId) return;

    setSelectedStakeholderIds((prev) => {
      const normalizedPrev = prev.map((item: any) =>
        typeof item === 'string' ? item : item?.id || item?.stakeholderId
      ).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

      setError(null);
      if (normalizedPrev.includes(targetId)) {
        return normalizedPrev.filter((id) => id !== targetId);
      } else {
        return [...normalizedPrev, targetId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      setError('Account selection is required.');
      return;
    }
    if (!title.trim()) {
      setError('Meeting title or agenda is required.');
      return;
    }
    if (!meetingDate) {
      setError('Meeting date is required.');
      return;
    }
    if (!meetingTime) {
      setError('Meeting time is required.');
      return;
    }
    if (!ownerId) {
      setError('Meeting host / owner is required.');
      return;
    }

    const attendeeIds: string[] = selectedStakeholderIds
      .map((item: any) => (typeof item === 'string' ? item : item?.id || item?.stakeholderId))
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

    const selectedStks = stakeholders.filter((s) => attendeeIds.includes(s.id));
    const hasClientAttendee = selectedStks.some((s) => s.stakeholderType === 'CLIENT');

    if (attendeeIds.length === 0 || !hasClientAttendee) {
      setError('Select at least one client attendee from this account.');
      return;
    }

    // Validation: Date and time logic
    const [y, m, d] = meetingDate.split('-').map(Number);
    const [hh, mm] = meetingTime.split(':').map(Number);
    const meetingDt = new Date(y, m - 1, d, hh || 0, mm || 0, 0);

    if (status === 'Completed' && meetingDt.getTime() > Date.now()) {
      setError('A future meeting cannot be marked as completed. Update the meeting date/time after it has taken place.');
      return;
    }

    if (isDateTimeChanged && meetingDt.getTime() <= Date.now()) {
      setError('Cannot reschedule meeting to a past date and time.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formattedTime = meetingTime.length === 5 ? `${meetingTime}:00` : meetingTime;

    try {
      if (isEditing && editConnect) {
        const updated = await stakeholderConnectsApi.update(editConnect.id, {
          title: title.trim(),
          meetingDate,
          meetingTime: formattedTime,
          ownerId,
          status: isDateTimeChanged ? undefined : (status === editConnect.status ? undefined : status),
          momNotes: mom.trim() || undefined,
          mom: mom.trim() || undefined,
          rescheduleReason: isDateTimeChanged ? (rescheduleReason.trim() || undefined) : undefined,
          attendees: attendeeIds,
        });
        showToast({
          kind: 'success',
          message: isDateTimeChanged
            ? 'Stakeholder connect rescheduled and updated successfully.'
            : 'Stakeholder connect updated successfully.',
        });
        onSuccess(updated);
      } else {
        const created = await stakeholderConnectsApi.create({
          accountId,
          title: title.trim(),
          meetingDate,
          meetingTime: formattedTime,
          ownerId,
          status: status === 'Rescheduled' ? 'Scheduled' : status,
          momNotes: mom.trim() || undefined,
          mom: mom.trim() || undefined,
          attendees: attendeeIds,
        });
        showToast({ kind: 'success', message: 'Stakeholder connect scheduled successfully.' });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={isEditing ? 'Edit Stakeholder Connect' : 'Schedule Stakeholder Connect'}
      icon={<CalendarCheck className="w-5 h-5 text-indigo-600" />}
      submitLabel={isSubmitting ? 'Saving…' : isEditing ? 'Update Connect' : 'Schedule Connect'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <FormGrid columns={2}>
          <FormField
            label="Account"
            required
            hint={isEditing ? 'Account is fixed after creation.' : undefined}
          >
            <select
              required
              disabled={isEditing || !!initialAccountId}
              className={`${SELECT_CLS} disabled:opacity-75 disabled:bg-slate-100`}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setSelectedStakeholderIds([]);
                setError(null);
              }}
            >
              <option value="" disabled>Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Meeting Host / Primary Owner" required hint="Internal owner responsible for the meeting.">
            <select
              required
              className={SELECT_CLS}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="" disabled>Select host…</option>
              {serviceProviders.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name || sp.email} {sp.designation ? `(${sp.designation})` : ''}
                </option>
              ))}
            </select>
          </FormField>
        </FormGrid>

        <FormField label="Meeting Title / Agenda" required>
          <input
            type="text"
            required
            className={INPUT_CLS}
            placeholder="e.g. Q4 Executive Cadence & Delivery Alignment"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>

        <FormGrid columns={3}>
          <FormField label="Meeting Date" required>
            <input
              type="date"
              required
              className={INPUT_CLS}
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </FormField>

          <FormField label="Meeting Time" required>
            <input
              type="time"
              required
              className={INPUT_CLS}
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </FormField>

          <FormField label="Status" required>
            {isDateTimeChanged ? (
              <div className="h-10 flex items-center px-3 rounded-lg bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-800">
                Rescheduled (auto)
              </div>
            ) : (
              <select
                className={SELECT_CLS}
                value={status}
                onChange={(e) => setStatus(e.target.value as ConnectStatus)}
              >
                {editConnect?.status === 'Rescheduled' && (
                  <option value="Rescheduled">Rescheduled</option>
                )}
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            )}
          </FormField>
        </FormGrid>

        {isDateTimeChanged && (
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-900">
              <CalendarCheck className="w-4 h-4 text-purple-600" />
              <span>Reschedule Event Detected</span>
            </div>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              Changing the meeting date or time records this update as a reschedule event in the audit trail.
            </p>
            <FormField label="Reason for Rescheduling" hint="Optional note explaining why the schedule changed.">
              <textarea
                className={`${INPUT_CLS} resize-none bg-white`}
                rows={2}
                placeholder="e.g. Stakeholder requested postponement due to team review…"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </FormField>
          </div>
        )}


        {/* Stakeholder Attendees Multi-Select */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Stakeholder Attendees <span className="text-red-500">*</span>
            <span className="ml-2 font-normal text-slate-400 text-[11px]">
              (Select at least one client attendee from this account)
            </span>
          </label>
          <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50/50">
            {eligibleStakeholders.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">
                No stakeholders found for the selected account. Please add a stakeholder first.
              </p>
            ) : (
              eligibleStakeholders.map((s) => {
                const isChecked = selectedStakeholderIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                        : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStakeholder(s.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span>{s.name}</span>
                        {s.designation && (
                          <span className="text-slate-400 text-[11px] ml-1.5">
                            ({s.designation})
                          </span>
                        )}
                        {s.email && (
                          <span className="text-slate-400 font-mono text-[10px] ml-1.5 block md:inline">
                            {s.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        s.stakeholderType === 'CLIENT'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {s.stakeholderType === 'CLIENT' ? 'Client' : 'Service Provider'}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Minutes of Meeting (MoM) */}
        <FormField
          label="Minutes of Meeting (MoM)"
          hint="Capture key discussion points, notes, and outcomes (optional initially, editable anytime)."
        >
          <textarea
            className={`${INPUT_CLS} resize-y min-h-[90px]`}
            rows={4}
            placeholder="Document key meeting takeaways, client feedback, or agreed discussion notes…"
            value={mom}
            onChange={(e) => setMom(e.target.value)}
          />
        </FormField>
      </div>
    </FormModal>
  );
};
