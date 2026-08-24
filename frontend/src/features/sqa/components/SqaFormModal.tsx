import React from 'react';
import { BadgeCheck } from 'lucide-react';
import type {
  ProjectHealth, SqaAvailableProject, SqaRecord, SqaRevenueSource, SqaWeeklyHealth,
} from '@/types';
import type { SqaRecordInput } from '@/api/crm.api';
import {
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  HEALTH_COLORS,
  INPUT_CLS,
  SearchableSelect,
  SELECT_CLS,
  StatusBadge,
} from '@/components/ui';
import {
  SQA_BILLING_MODEL_OPTIONS,
  SQA_DELIVERY_MODEL_OPTIONS,
  SQA_IMPORTANCE_OPTIONS,
  SQA_RESOURCING_STATUS_OPTIONS,
  SQA_SDLC_PHASE_OPTIONS,
  SQA_TOWER_OPTIONS,
} from '@/constants';

/**
 * Everything the SQA form edits.
 *
 * Only SQA's own fields and the three overrides live here — Account, PM,
 * Revenue, Billing Model, Tower and FTE are never editable as SQA data, because
 * they belong to the Project/Opportunity. They appear on the form read-only
 * (see {@link SqaInherited}) so a user can see what the record inherits, and an
 * override is offered next to each one for the case where SQA must state
 * something different.
 */
export interface SqaDraft {
  projectId: string;
  importance: string;
  deliveryModel: string;
  billingModelOverride: string;
  towerOverride: string;
  fteOverride?: number;
  revenueOverride?: number;
  wsrPublished: boolean;
  clientEscalation: boolean;
  currentWeekUpdate: string;
  nextWeekPlan: string;
  issuesChallenges: string;
  pathToGreen: string;
  resourcingStatus: string;
  currentSdlcPhase: string;
  sqaRemarks: string;
  /** The record's trailing weeks, oldest first — the "Health Week NN" fields. */
  weeklyHealth: SqaWeeklyHealth[];
  /**
   * Weeks the user actually touched, as `${isoYear}-${weekNumber}`. Only these
   * are submitted, so simply opening and saving the form never stamps an edit
   * across the project's whole health history.
   */
  touchedWeekKeys: string[];
}

export const emptySqaDraft: SqaDraft = {
  projectId: '',
  importance: 'Medium',
  deliveryModel: '',
  billingModelOverride: '',
  towerOverride: '',
  fteOverride: undefined,
  revenueOverride: undefined,
  wsrPublished: false,
  clientEscalation: false,
  currentWeekUpdate: '',
  nextWeekPlan: '',
  issuesChallenges: '',
  pathToGreen: '',
  resourcingStatus: '',
  currentSdlcPhase: '',
  sqaRemarks: '',
  weeklyHealth: [],
  touchedWeekKeys: [],
};

export function draftFromRecord(record: SqaRecord): SqaDraft {
  return {
    projectId: record.projectId,
    importance: record.importance ?? 'Medium',
    deliveryModel: record.deliveryModel ?? '',
    billingModelOverride: record.billingModelOverride ?? '',
    towerOverride: record.towerOverride ?? '',
    fteOverride: record.fteOverride,
    revenueOverride: record.revenueOverride,
    wsrPublished: !!record.wsrPublished,
    clientEscalation: !!record.clientEscalation,
    currentWeekUpdate: record.currentWeekUpdate ?? '',
    nextWeekPlan: record.nextWeekPlan ?? '',
    issuesChallenges: record.issuesChallenges ?? '',
    pathToGreen: record.pathToGreen ?? '',
    resourcingStatus: record.resourcingStatus ?? '',
    currentSdlcPhase: record.currentSdlcPhase ?? '',
    sqaRemarks: record.sqaRemarks ?? '',
    weeklyHealth: record.weeklyHealth ?? [],
    touchedWeekKeys: [],
  };
}

/** '' means "inherit from the Project/Opportunity", so it is sent as undefined. */
const orInherit = (v: string): string | undefined => (v.trim() === '' ? undefined : v);

export function draftToInput(draft: SqaDraft): SqaRecordInput {
  const touched = new Set(draft.touchedWeekKeys);
  return {
    projectId: draft.projectId,
    importance: draft.importance,
    deliveryModel: orInherit(draft.deliveryModel),
    billingModelOverride: orInherit(draft.billingModelOverride),
    towerOverride: orInherit(draft.towerOverride),
    fteOverride: draft.fteOverride,
    revenueOverride: draft.revenueOverride,
    wsrPublished: draft.wsrPublished,
    clientEscalation: draft.clientEscalation,
    currentWeekUpdate: draft.currentWeekUpdate,
    nextWeekPlan: draft.nextWeekPlan,
    issuesChallenges: draft.issuesChallenges,
    pathToGreen: draft.pathToGreen,
    resourcingStatus: orInherit(draft.resourcingStatus),
    currentSdlcPhase: orInherit(draft.currentSdlcPhase),
    sqaRemarks: draft.sqaRemarks,
    weeklyHealth: [],
  };
}

/** The values a record inherits from its Project — shown, never edited here. */
export interface SqaInherited {
  accountName?: string;
  projectHealth?: ProjectHealth;
  pmName?: string;
  clientPmName?: string;
  billingModel?: string;
  tower?: string;
  serviceLine?: string;
  /** The inherited revenue, before any SQA override. */
  revenue?: number;
  /** Which existing field supplied `revenue`. */
  revenueInheritedSource?: Exclude<SqaRevenueSource, 'sqa'>;
  fte?: number;
  teamMemberCount?: number;
}

const INHERITED_REVENUE_SOURCE_LABEL: Record<Exclude<SqaRevenueSource, 'sqa'>, string> = {
  project: "the Project's Deal Value",
  opportunity: "the Opportunity's value",
  none: 'no value recorded',
};

const formatCur = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

/** Read-only inherited value with the field it came from named underneath. */
const InheritedValue: React.FC<{ label: string; value: React.ReactNode; source: string }> = ({
  label, value, source,
}) => (
  <div>
    <span className="block text-label font-semibold text-slate-500 uppercase tracking-wide mb-1">
      {label}
    </span>
    <div className="text-xs font-bold text-slate-800 min-h-[1.25rem]">
      {value === undefined || value === null || value === '' ? (
        <span className="text-slate-300 italic font-medium">Not set</span>
      ) : value}
    </div>
    <span className="block text-micro text-slate-400 font-medium mt-0.5">from {source}</span>
  </div>
);

export interface SqaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  value: SqaDraft;
  onChange: (patch: Partial<SqaDraft>) => void;
  /** 'create' shows the Project picker; 'edit' shows the project as fixed. */
  mode: 'create' | 'edit';
  /** Projects without an SQA record yet — create mode only. */
  availableProjects?: SqaAvailableProject[];
  /** What the selected project supplies. Empty until a project is chosen. */
  inherited: SqaInherited;
  /** Set when the user may not edit weekly health (needs projects:update too). */
  weeklyHealthReadOnly?: boolean;
}

/**
 * Create / Edit SQA record.
 *
 * The form is organised around provenance: an "Inherited from Project" section
 * that is read-only, then SQA's own fields, then the weekly narrative and the
 * weekly health grid. An SQA record cannot be moved between projects after
 * creation (that would silently change which account and revenue it reports on),
 * so the Project picker only appears in create mode.
 */
export const SqaFormModal: React.FC<SqaFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  value,
  onChange,
  mode,
  availableProjects = [],
  inherited,
  weeklyHealthReadOnly = false,
}) => {
  const isCreate = mode === 'create';
  const selectedProject = availableProjects.find((p) => p.id === value.projectId);
  const projectLabel = selectedProject?.name ?? inherited.accountName ?? '';  return (
    <FormModal
      isOpen={isOpen}
      title={isCreate ? 'Create SQA Record' : 'Edit SQA Record'}
      icon={<BadgeCheck className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={isSubmitting ? (isCreate ? 'Creating…' : 'Saving…') : (isCreate ? 'Create SQA Record' : 'Save Changes')}
      isSubmitting={isSubmitting}
      submitVariant={isCreate ? 'primary' : 'warning'}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5">
        <FormSection title="Project">
          <FormGrid>
            {isCreate ? (
              <FormField
                label="Project"
                required
                wide
                hint="Only projects without an SQA record are listed — one SQA record per project."
              >
                <SearchableSelect
                  value={value.projectId}
                  onChange={(id) => onChange({ projectId: id })}
                  options={availableProjects.map((p) => ({
                    value: p.id,
                    label: `${p.name} — ${p.accountName}`,
                  }))}
                  placeholder="Search projects…"
                  aria-label="Project"
                />
              </FormField>
            ) : (
              <div className="sm:col-span-full">
                <InheritedValue label="Project" value={projectLabel} source="the linked Project" />
              </div>
            )}
          </FormGrid>
        </FormSection>

        {/* Everything here is read through the project on every request; the
            record stores none of it, so it can never go stale. */}
        <FormSection title="Inherited from Project">
          {!value.projectId ? (
            <p className="text-xs text-slate-400 font-medium italic">
              Select a project to see the account, PM, revenue and delivery attributes it supplies.
            </p>
          ) : (
            <FormGrid columns={3}>
              <InheritedValue label="Account" value={inherited.accountName} source="the Project's Account" />
              <InheritedValue
                label="PM"
                value={inherited.pmName}
                source="the Project's Service Provider PM"
              />
              <InheritedValue
                label="Client PM"
                value={inherited.clientPmName}
                source="the Project's Client PM"
              />
              <InheritedValue
                label="Project Health"
                value={inherited.projectHealth
                  ? <StatusBadge value={inherited.projectHealth} colorMap={HEALTH_COLORS} />
                  : undefined}
                source="the Project Health tracker"
              />
              <InheritedValue
                label="Revenue"
                value={inherited.revenue !== undefined ? formatCur(inherited.revenue) : undefined}
                source={INHERITED_REVENUE_SOURCE_LABEL[inherited.revenueInheritedSource ?? 'none']}
              />
              <InheritedValue
                label="FTE"
                value={inherited.fte}
                source={inherited.teamMemberCount
                  ? `the Project team (${inherited.teamMemberCount} member${inherited.teamMemberCount === 1 ? '' : 's'})`
                  : 'no project team recorded'}
              />
            </FormGrid>
          )}
        </FormSection>

        <FormSection title="SQA Classification">
          <FormGrid columns={3}>
            <FormField label="Importance" required>
              <select
                value={value.importance}
                onChange={(e) => onChange({ importance: e.target.value })}
                className={SELECT_CLS}
                required
              >
                {SQA_IMPORTANCE_OPTIONS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Delivery Model"
              hint="SQA-maintained — the application holds no delivery model elsewhere."
            >
              <select
                value={value.deliveryModel}
                onChange={(e) => onChange({ deliveryModel: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Not set</option>
                {SQA_DELIVERY_MODEL_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Current SDLC Phase">
              <select
                value={value.currentSdlcPhase}
                onChange={(e) => onChange({ currentSdlcPhase: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Not set</option>
                {SQA_SDLC_PHASE_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </FormField>

            <FormField label="WSR Publish Status (Y/N)" required>
              <select
                value={value.wsrPublished ? 'true' : 'false'}
                onChange={(e) => onChange({ wsrPublished: e.target.value === 'true' })}
                className={SELECT_CLS}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </FormField>

            <FormField label="Client Escalation" required>
              <select
                value={value.clientEscalation ? 'true' : 'false'}
                onChange={(e) => onChange({ clientEscalation: e.target.value === 'true' })}
                className={SELECT_CLS}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </FormField>

            <FormField label="Resourcing Status">
              <select
                value={value.resourcingStatus}
                onChange={(e) => onChange({ resourcingStatus: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Not set</option>
                {SQA_RESOURCING_STATUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Each control here overrides an inherited value. Left empty the record
            keeps following the Project/Opportunity, so nothing is duplicated. */}
        <FormSection title="Overrides">
          <FormGrid columns={2}>
            <FormField label="Billing Model">
              <select
                value={value.billingModelOverride}
                onChange={(e) => onChange({ billingModelOverride: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">
                  {inherited.billingModel
                    ? `Inherit — ${inherited.billingModel}`
                    : 'Inherit (none recorded)'}
                </option>
                {SQA_BILLING_MODEL_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Tower">
              <select
                value={value.towerOverride}
                onChange={(e) => onChange({ towerOverride: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">
                  {inherited.tower ? `Inherit — ${inherited.tower}` : 'Inherit (none recorded)'}
                </option>
                {SQA_TOWER_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Service Line">
              <input
                type="text"
                readOnly
                value={inherited.serviceLine || 'Inherit (none recorded)'}
                className={`${INPUT_CLS} bg-slate-50 text-slate-500 cursor-not-allowed`}
              />
            </FormField>

            <FormField
              label="FTE"
              hint="Leave blank to use the project team size."
            >
              <input
                type="number"
                min={0}
                step="0.5"
                value={value.fteOverride ?? ''}
                onChange={(e) => onChange({
                  fteOverride: e.target.value === '' ? undefined : Number(e.target.value),
                })}
                placeholder={inherited.teamMemberCount ? String(inherited.teamMemberCount) : 'Not set'}
                className={INPUT_CLS}
              />
            </FormField>

            <FormField
              label="Revenue ($)"
              hint="Leave blank to use the Project Deal Value / Opportunity value."
            >
              <input
                type="number"
                min={0}
                value={value.revenueOverride ?? ''}
                onChange={(e) => onChange({
                  revenueOverride: e.target.value === '' ? undefined : Number(e.target.value),
                })}
                placeholder={inherited.revenue !== undefined ? String(inherited.revenue) : 'Not set'}
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </FormSection>

        <FormSection title="Weekly Status">
          <FormGrid columns={2}>
            <FormField label="Update for the Current Week" wide>
              <textarea
                rows={3}
                value={value.currentWeekUpdate}
                onChange={(e) => onChange({ currentWeekUpdate: e.target.value })}
                placeholder="What happened this week?"
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
            <FormField label="Plan for Next Week" wide>
              <textarea
                rows={3}
                value={value.nextWeekPlan}
                onChange={(e) => onChange({ nextWeekPlan: e.target.value })}
                placeholder="Planned activities for next week"
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
            <FormField label="Issues / Challenges">
              <textarea
                rows={3}
                value={value.issuesChallenges}
                onChange={(e) => onChange({ issuesChallenges: e.target.value })}
                placeholder="What is blocking progress?"
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
            <FormField label="Path to Green">
              <textarea
                rows={3}
                value={value.pathToGreen}
                onChange={(e) => onChange({ pathToGreen: e.target.value })}
                placeholder="Recovery / improvement plan"
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
            <FormField label="SQA Remarks" wide>
              <textarea
                rows={2}
                value={value.sqaRemarks}
                onChange={(e) => onChange({ sqaRemarks: e.target.value })}
                placeholder="SQA's own observations"
                className={`${INPUT_CLS} resize-none`}
              />
            </FormField>
          </FormGrid>
        </FormSection>
      </div>
    </FormModal>
  );
};
