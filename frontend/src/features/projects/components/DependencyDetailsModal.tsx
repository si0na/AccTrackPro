/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link2, Pencil } from 'lucide-react';
import type { ProjectDependency } from '@/types';
import { Button, Modal, ModalFooter, StatusBadge, PRIORITY_COLORS } from '@/components/ui';

export const DEPENDENCY_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
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
      <span className="w-1 h-3.5 rounded-full bg-teal-500 shrink-0" aria-hidden="true" />
      <span className="text-label font-bold text-slate-700 uppercase tracking-wider">{title}</span>
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
  </div>
);

export interface DependencyDetailsModalProps {
  isOpen: boolean;
  dependency: ProjectDependency | null;
  onClose: () => void;
  onEdit?: () => void;
}

export const DependencyDetailsModal: React.FC<DependencyDetailsModalProps> = ({
  isOpen,
  dependency,
  onClose,
  onEdit,
}) => {
  if (!dependency) return null;
  const d = dependency;

  return (
    <Modal
      isOpen={isOpen}
      title="Dependency Details"
      icon={<Link2 className="w-5 h-5 text-teal-600" aria-hidden="true" />}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-6">
        <Section title="Basic Information">
          <Field label="Description" wide>{d.description}</Field>
          <Field label="Priority">
            <StatusBadge value={d.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
          </Field>
          <Field label="Status">
            <StatusBadge value={d.status} colorMap={DEPENDENCY_STATUS_COLORS} shape="rounded" />
          </Field>
          <Field label="Dependency Type">{text(d.dependencyType)}</Field>
          <Field label="Dependent Task">{text(d.dependentTask)}</Field>
          <Field label="Owner">{text(d.ownerName)}</Field>
          <Field label="External Party">{text(d.externalParty)}</Field>
        </Section>

        <Section title="Schedule & Resolution">
          <Field label="Target Resolution Date">{text(d.targetResolutionDate)}</Field>
        </Section>

        <Section title="Remarks">
          <Field label="Remarks" wide>{text(d.remarks)}</Field>
        </Section>

        <Section title="Additional Information">
          <Field label="Created Date">{dateTime(d.createdAt)}</Field>
          <Field label="Modified Date">{dateTime(d.updatedAt)}</Field>
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
            Edit Dependency
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
