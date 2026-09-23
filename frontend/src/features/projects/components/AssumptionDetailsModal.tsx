/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle, Pencil } from 'lucide-react';
import type { ProjectAssumption } from '@/types';
import { Button, Modal, ModalFooter, StatusBadge, PRIORITY_COLORS } from '@/components/ui';

export const ASSUMPTION_VALIDATION_COLORS: Record<string, string> = {
  Unvalidated: 'bg-slate-100 text-slate-600',
  Validated: 'bg-green-100 text-green-700',
  Invalidated: 'bg-red-100 text-red-700',
};

const text = (val: string | null | undefined): string => (val && val.trim() ? val : '—');

const dateTime = (val: string | null | undefined): string => {
  if (!val || !val.trim()) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? val : d.toLocaleString();
};

const Field: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({
  label,
  wide = false,
  children,
}) => (
  <div className={wide ? 'sm:col-span-full' : ''}>
    <div className="text-label font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</div>
    <div className="text-xs font-medium text-slate-800 whitespace-pre-wrap break-words">{children}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="flex items-center gap-2 border-b border-slate-200 pb-2">
      <span className="w-1 h-3.5 rounded-full bg-purple-500 shrink-0" aria-hidden="true" />
      <span className="text-label font-bold text-slate-700 uppercase tracking-wider">{title}</span>
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
  </div>
);

export interface AssumptionDetailsModalProps {
  isOpen: boolean;
  assumption: ProjectAssumption | null;
  onClose: () => void;
  onEdit?: () => void;
}

export const AssumptionDetailsModal: React.FC<AssumptionDetailsModalProps> = ({
  isOpen,
  assumption,
  onClose,
  onEdit,
}) => {
  if (!assumption) return null;
  const a = assumption;

  return (
    <Modal
      isOpen={isOpen}
      title="Assumption Details"
      icon={<HelpCircle className="w-5 h-5 text-purple-600" aria-hidden="true" />}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-6">
        <Section title="Basic Information">
          <Field label="Description" wide>{a.description}</Field>
          <Field label="Priority">
            <StatusBadge value={a.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
          </Field>
          <Field label="Validation Status">
            <StatusBadge value={a.validationStatus} colorMap={ASSUMPTION_VALIDATION_COLORS} shape="rounded" />
          </Field>
          <Field label="Owner">{text(a.ownerName)}</Field>
        </Section>

        <Section title="Validation & Impact">
          <Field label="Impact If False" wide>{text(a.impactIfFalse)}</Field>
          <Field label="Date Identified">{text(a.dateIdentified)}</Field>
          <Field label="Target Validation Date">{text(a.targetValidationDate)}</Field>
        </Section>

        <Section title="Remarks">
          <Field label="Remarks" wide>{text(a.remarks)}</Field>
        </Section>

        <Section title="Additional Information">
          <Field label="Created Date">{dateTime(a.createdAt)}</Field>
          <Field label="Modified Date">{dateTime(a.updatedAt)}</Field>
        </Section>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {onEdit && (
          <Button
            variant="warning"
            icon={<Pencil className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={onEdit}
          >
            Edit Assumption
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
