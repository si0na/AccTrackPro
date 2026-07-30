/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Flag, Pencil } from 'lucide-react';
import type { ProjectMilestone } from '@/types';
import { Button, Modal, ModalFooter, StatusBadge } from '@/components/ui';

/** Milestone-status → badge color, mirroring the list column in ProjectDetailsView. */
const MILESTONE_STATUS_COLORS: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Delayed: 'bg-red-100 text-red-700',
};

/** Consistent with the inline `$${n.toLocaleString()}` used elsewhere in the project views. */
const money = (val: number | null | undefined): string =>
  val === null || val === undefined ? '—' : `$${Number(val).toLocaleString()}`;

const num = (val: number | null | undefined, suffix = ''): string =>
  val === null || val === undefined ? '—' : `${Number(val).toLocaleString()}${suffix}`;

const text = (val: string | null | undefined): string => (val && val.trim() ? val : '—');

/** Formats an ISO timestamp (created_at/updated_at) as a readable date-time; falls back to raw text. */
const dateTime = (val: string | null | undefined): string => {
  if (!val || !val.trim()) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? val : d.toLocaleString();
};

/** Read-only label + value pair. `wide` spans the full grid row (for long text). */
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

/** Read-only section: same heading treatment as the form's FormSection. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="flex items-center gap-2 border-b border-slate-200 pb-2">
      <span className="w-1 h-3.5 rounded-full bg-indigo-500 shrink-0" aria-hidden="true" />
      <span className="text-label font-bold text-slate-700 uppercase tracking-wider">{title}</span>
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
  </div>
);

export interface MilestoneDetailsModalProps {
  isOpen: boolean;
  milestone: ProjectMilestone | null;
  onClose: () => void;
  /** Opens the edit form for this milestone. Omit to hide the Edit action (read-only per permissions). */
  onEdit?: () => void;
}

/**
 * Read-only detailed view of a single milestone. The list (SimpleCrudTab) shows
 * only a concise summary; selecting a row opens this dialog, which surfaces
 * every stored milestone field — planning, schedule, effort, cost, payment and
 * progress — organised into logical sections. Editing is delegated back to the
 * shared MilestoneFormModal (in `edit` mode) via {@link MilestoneDetailsModalProps.onEdit},
 * so there is a single source of truth for how milestones are mutated.
 */
export const MilestoneDetailsModal: React.FC<MilestoneDetailsModalProps> = ({
  isOpen,
  milestone,
  onClose,
  onEdit,
}) => {
  if (!milestone) return null;
  const m = milestone;

  return (
    <Modal
      isOpen={isOpen}
      title={`Milestone${m.milestoneNo ? ` ${m.milestoneNo}` : ''} — ${m.name}`}
      icon={<Flag className="w-5 h-5 text-blue-600" aria-hidden="true" />}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-6">
        {/* ── Basic Information ── */}
        <Section title="Basic Information">
          <Field label="Milestone No.">{text(m.milestoneNo)}</Field>
          <Field label="Milestone Name">{m.name}</Field>
        </Section>

        {/* ── Planning ── */}
        <Section title="Planning">
          <Field label="Activities" wide>{text(m.activities)}</Field>
          <Field label="Deliverables" wide>{text(m.deliverables)}</Field>
          <Field label="Acceptance Criteria" wide>{text(m.acceptanceCriteria)}</Field>
        </Section>

        {/* ── Payment ── */}
        <Section title="Payment">
          <Field label="Payment Trigger">{text(m.paymentTrigger)}</Field>
          <Field label="Payment %">{num(m.paymentPct, '%')}</Field>
          <Field label="Payment Amount">{money(m.paymentAmount)}</Field>
        </Section>

        {/* ── Schedule ── */}
        <Section title="Schedule">
          <Field label="Target Date">{text(m.targetDate)}</Field>
          <Field label="Sprint(s)">{text(m.sprints)}</Field>
          <Field label="Planned Start Date">{text(m.plannedStart)}</Field>
          <Field label="Planned End Date">{text(m.plannedEnd)}</Field>
          <Field label="Actual Start Date">{text(m.actualStart)}</Field>
          <Field label="Actual End Date">{text(m.actualEnd)}</Field>
        </Section>

        {/* ── Progress ── */}
        <Section title="Progress">
          <Field label="Status">
            <StatusBadge value={m.status} colorMap={MILESTONE_STATUS_COLORS} shape="rounded" />
          </Field>
          <Field label="Completion %">{num(m.completionPct ?? 0, '%')}</Field>
          <Field label="Remarks" wide>{text(m.remarks)}</Field>
        </Section>

        {/* ── Effort Tracking ── */}
        <Section title="Effort Tracking">
          <Field label="Effort Planned (Hours)">{num(m.effortPlanned)}</Field>
          <Field label="Effort Spent (Hours)">{num(m.effortSpent)}</Field>
        </Section>

        {/* ── Cost Tracking ── */}
        <Section title="Cost Tracking">
          <Field label="Cost Planned">{money(m.costPlanned)}</Field>
          <Field label="Cost Spent">{money(m.costSpent)}</Field>
        </Section>

        {/* ── Additional Information ── audit fields the model already carries.
             Only createdAt/updatedAt are stored on a milestone today; no new
             fields are introduced. */}
        <Section title="Additional Information">
          <Field label="Created Date">{dateTime(m.createdAt)}</Field>
          <Field label="Modified Date">{dateTime(m.updatedAt)}</Field>
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
            Edit Milestone
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
