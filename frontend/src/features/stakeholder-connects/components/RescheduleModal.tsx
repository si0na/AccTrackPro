/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { StakeholderConnect } from '@/types';
import { stakeholderConnectsApi } from '@/api/crm.api';
import {
  FormModal,
  FormField,
  FormGrid,
  INPUT_CLS,
  ErrorBanner,
} from '@/components/ui';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { showToast } from '@/components/common/ToastHost';

export interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  connect: StakeholderConnect;
  onSuccess: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  connect,
  onSuccess,
}) => {
  const [meetingDate, setMeetingDate] = useState(connect.meetingDate || '');
  const [meetingTime, setMeetingTime] = useState(connect.meetingTime ? connect.meetingTime.slice(0, 5) : '10:00');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate) {
      setError('New meeting date is required.');
      return;
    }
    if (!meetingTime) {
      setError('New meeting time is required.');
      return;
    }

    const isSame =
      meetingDate === connect.meetingDate &&
      meetingTime.slice(0, 5) === connect.meetingTime?.slice(0, 5);
    if (isSame) {
      setError('The rescheduled meeting date and time must be different from the current schedule.');
      return;
    }

    const [y, m, d] = meetingDate.split('-').map(Number);
    const [hh, mm] = meetingTime.split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh || 0, mm || 0, 0);
    if (dt.getTime() <= Date.now()) {
      setError('Cannot reschedule meeting to a past date and time.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await stakeholderConnectsApi.reschedule(connect.id, {
        newDate: meetingDate,
        newTime: meetingTime.length === 5 ? `${meetingTime}:00` : meetingTime,
        meetingDate,
        meetingTime: meetingTime.length === 5 ? `${meetingTime}:00` : meetingTime,
        reason: reason.trim() || undefined,
      });
      showToast({ kind: 'success', message: 'Stakeholder connect rescheduled successfully.' });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to reschedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Reschedule Stakeholder Connect"
      icon={<CalendarClock className="w-5 h-5 text-purple-600" />}
      submitLabel={isSubmitting ? 'Rescheduling…' : 'Reschedule Connect'}
      isSubmitting={isSubmitting}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Current schedule:</span> {connect.meetingDate} at {connect.meetingTime?.slice(0, 5)}
            <p className="mt-0.5 text-amber-700 text-[11px]">
              Rescheduling retains this meeting's ID, attendees, MoM, and follow-ups while logging an audit trail in the Reschedule History.
            </p>
          </div>
        </div>

        <FormGrid columns={2}>
          <FormField label="New Meeting Date" required>
            <input
              type="date"
              required
              className={INPUT_CLS}
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </FormField>

          <FormField label="New Meeting Time" required>
            <input
              type="time"
              required
              className={INPUT_CLS}
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormField label="Reason for Rescheduling" hint="Brief note explaining why this connect was rescheduled.">
          <textarea
            className={`${INPUT_CLS} resize-none`}
            rows={3}
            placeholder="e.g. Stakeholder requested postpone due to client internal review…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </div>
    </FormModal>
  );
};
