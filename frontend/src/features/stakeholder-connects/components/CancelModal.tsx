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
  INPUT_CLS,
  ErrorBanner,
} from '@/components/ui';
import { Ban, AlertTriangle } from 'lucide-react';
import { showToast } from '@/components/common/ToastHost';

export interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  connect: StakeholderConnect;
  onSuccess: () => void;
}

export const CancelModal: React.FC<CancelModalProps> = ({
  isOpen,
  onClose,
  connect,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for cancellation.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await stakeholderConnectsApi.cancel(connect.id, { reason: reason.trim() });
      showToast({ kind: 'success', message: 'Stakeholder connect cancelled successfully.' });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to cancel meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Cancel Stakeholder Connect"
      icon={<Ban className="w-5 h-5 text-rose-600" />}
      submitLabel={isSubmitting ? 'Cancelling…' : 'Confirm Cancellation'}
      isSubmitting={isSubmitting}
      submitVariant="danger"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Notice:</span> Cancelled meetings remain accessible and auditable in the system for historical reference.
          </div>
        </div>

        <FormField label="Reason for Cancellation" required hint="Document why the meeting was cancelled.">
          <textarea
            required
            className={`${INPUT_CLS} resize-none`}
            rows={3}
            placeholder="e.g. Client stakeholder called off the project discussion…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </div>
    </FormModal>
  );
};
