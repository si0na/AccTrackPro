import React, { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { FormField, FormGrid, FormModal, FormSection, INPUT_CLS_AMBER, SearchableSelect } from '@/components/ui';
import { NumberInput } from '@/components/NumberInput';
import { AopYearFields } from '@/components/AopYearFields';
import { StakeholderAssignmentFields } from '@/components/StakeholderAssignmentFields';
import { getCustomerSinceYearOptions } from '@/utils';
import { ACTION_ITEM_STATUS_OPTIONS, OPPORTUNITY_STAGE_OPTIONS, OPPORTUNITY_TYPE_OPTIONS, SERVICE_LINE_OPTIONS, ACCOUNT_TYPE_OPTIONS, ACCOUNT_HEALTH_OPTIONS, LOCATION_OPTIONS, stageChangePatch } from '@/constants';
import type {
  Account,
  Opportunity,
  ColumnConfig,
  AccountType,
  AccountHealth,
  OpportunityStage,
  PriorityLevel,
  ActionItemStatus,
  Stakeholder,
} from '@/types';

export type EditMode = 'accounts' | 'opportunities' | 'actionItems';

export interface InlineEditModalProps {
  mode: EditMode;
  entity: Record<string, any>;
  /** Columns currently visible in the table — the modal renders only these fields. */
  displayedConfigs: ColumnConfig[];
  accounts: Account[];
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  onChange: (patch: Record<string, any>) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const MODE_META: Record<EditMode, { title: string; primaryKey: string }> = {
  accounts:      { title: 'Edit Account',     primaryKey: 'name'  },
  opportunities: { title: 'Edit Opportunity', primaryKey: 'name'  },
  actionItems:   { title: 'Edit Action Item', primaryKey: 'title' },
};

// These keys span both columns of the 2-col grid — reserved for fields that
// genuinely need the room (long free text, read-only context, composite
// controls). Short values (selects, dates, categorical text) stay half-width
// so more fields fit per row and the modal scrolls less.
const WIDE_KEYS = new Set([
  'name', 'title', 'accountId', 'address',
  'description', 'notes', 'nextStep', 'risksAndDependencies', 'tags', 'team',
  'aopAvailable',
]);

export const InlineEditModal: React.FC<InlineEditModalProps> = ({
  mode,
  entity,
  displayedConfigs,
  accounts,
  opportunities,
  stakeholders,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  const { title, primaryKey } = MODE_META[mode];
  const inputCls = INPUT_CLS_AMBER;

  // Always include the primary identifier field even if hidden in the table,
  // plus (for opportunities) the client/service-provider stakeholder assignment
  // fields — these aren't part of the customizable-columns system, so they must
  // be force-included the same way the primary key is.
  const formConfigs = useMemo<ColumnConfig[]>(() => {
    const cols = displayedConfigs.some((c) => c.key === primaryKey)
      ? displayedConfigs
      : [{
          key: primaryKey,
          name: primaryKey === 'title' ? 'Task Title' : 'Name',
          isStandard: true,
          isPinned: true,
          isDisplayed: true,
          type: 'text' as const,
        }, ...displayedConfigs];

    // Risks & Dependencies must always be editable, even when the user has
    // hidden its table column, so force-include it in the Action Item form.
    if (mode === 'actionItems') {
      const risksCol: ColumnConfig = {
        key: 'risksAndDependencies', name: 'Risks & Dependencies', isStandard: true, isPinned: false, isDisplayed: true, type: 'text',
      };
      return cols.some((c) => c.key === risksCol.key) ? cols : [...cols, risksCol];
    }

    // Opportunities render the dedicated sectioned form below (mirroring the
    // Create Opportunity dialog) instead of this flat column-driven list.
    return cols;
  }, [displayedConfigs, primaryKey, mode]);

  // Synthetic column descriptor for opportunity fields that renderInput keys on.
  const editCol = (key: string, name: string, type: ColumnConfig['type'] = 'text'): ColumnConfig => ({
    key, name, isStandard: true, isPinned: false, isDisplayed: true, type,
  });

  // User-defined custom columns currently visible in the opportunities table.
  const customOppConfigs = mode === 'opportunities' ? displayedConfigs.filter((c) => !c.isStandard) : [];

  const renderInput = (col: ColumnConfig): React.ReactNode => {
    const { key, type: colType } = col;
    const val = entity[key];

    switch (key) {
      case 'name':
      case 'title':
        return (
          <input
            type="text"
            required
            value={val ?? ''}
            onChange={(e) => onChange({ [key]: e.target.value })}
            className={inputCls}
          />
        );

      case 'type':
        return (
          <select
            value={val ?? ACCOUNT_TYPE_OPTIONS[0]}
            onChange={(e) => onChange({ type: e.target.value as AccountType })}
            className={`${inputCls} bg-white`}
          >
            {ACCOUNT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        );

      case 'health':
        return (
          <select
            value={val ?? ACCOUNT_HEALTH_OPTIONS[0]}
            onChange={(e) => onChange({ health: e.target.value as AccountHealth })}
            className={`${inputCls} bg-white`}
          >
            {ACCOUNT_HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        );

      case 'location':
        return (
          <SearchableSelect
            value={val ?? ''}
            onChange={(location) => onChange({ location })}
            options={LOCATION_OPTIONS}
            placeholder="Search countries…"
            tone="amber"
            aria-label="Account location"
          />
        );

      case 'since':
        return (
          <SearchableSelect
            value={val ?? ''}
            onChange={(since) => onChange({ since })}
            options={getCustomerSinceYearOptions()}
            placeholder="Select year…"
            tone="amber"
            aria-label="Customer since year"
          />
        );

      case 'owner':
        return (
          <input
            type="text"
            value={val ?? ''}
            onChange={(e) => onChange({ owner: e.target.value })}
            placeholder="e.g., John Smith"
            className={inputCls}
          />
        );

      case 'revenue': {
        if (mode === 'accounts') {
          const computed = opportunities
            .filter((o) => o.accountId === entity.id)
            .reduce((sum, o) => sum + (o.value || 0), 0);
          return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs font-mono font-bold text-slate-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(computed)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">(auto-calculated from opportunities)</span>
            </div>
          );
        }
        return (
          <NumberInput
            value={val}
            onValueChange={(n) => onChange({ [key]: n })}
            className={inputCls}
          />
        );
      }

      case 'crmValue':
        return (
          <NumberInput
            value={val}
            onValueChange={(n) => onChange({ [key]: n })}
            className={inputCls}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={val ?? ''}
            onChange={(e) => onChange({ email: e.target.value })}
            className={inputCls}
          />
        );

      case 'description':
      case 'notes':
      case 'risksAndDependencies':
        return (
          <textarea
            value={val ?? ''}
            rows={3}
            onChange={(e) => onChange({ [key]: e.target.value })}
            className={`${inputCls} resize-none`}
          />
        );

      case 'accountId': {
        // The account association is part of the relationship — read-only when editing.
        const accountName =
          accounts.find((a) => a.id === val)?.name ?? entity.accountName ?? '—';
        return (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs font-medium text-slate-700">{accountName}</span>
            <span className="text-[10px] text-slate-400 font-medium">(read-only)</span>
          </div>
        );
      }

      // Client/Service-Provider stakeholder assignment is rendered by the shared
      // StakeholderAssignmentFields component (which also carries the inline
      // "+ New Stakeholder" action) in the opportunity Stakeholders section
      // below — it is never routed through renderInput.

      case 'stage':
        return (
          <select
            value={val ?? 'Lead'}
            onChange={(e) => onChange(stageChangePatch(e.target.value as OpportunityStage))}
            className={`${inputCls} bg-white`}
          >
            {OPPORTUNITY_STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        );

      case 'value':
        return (
          <NumberInput
            min={0}
            value={val}
            onValueChange={(v) => onChange({ value: v, crmValue: Math.round(v * 0.9) })}
            className={inputCls}
          />
        );

      case 'probability':
        return (
          <NumberInput
            min={0}
            max={100}
            value={val}
            onValueChange={(v) => onChange({ probability: v })}
            placeholder="0–100"
            className={inputCls}
          />
        );

      case 'allocationStartDate':
      case 'allocationEndDate':
      case 'dealStartDate':
      case 'dealCloseDate':
      case 'dueDate':
      case 'openDate':
        return (
          <input
            type="date"
            value={val ?? ''}
            onChange={(e) => onChange({ [key]: e.target.value })}
            className={`${inputCls} font-mono`}
          />
        );

      case 'opportunityId':
        return (
          <select
            value={val ?? ''}
            onChange={(e) => onChange({ opportunityId: e.target.value })}
            className={`${inputCls} bg-white`}
          >
            <option value="">None / General Task</option>
            {opportunities
              .filter((o) => o.accountId === entity.accountId)
              .map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
          </select>
        );

      case 'priority':
        return (
          <select
            value={val ?? 'Medium'}
            onChange={(e) => onChange({ priority: e.target.value as PriorityLevel })}
            className={`${inputCls} bg-white`}
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        );

      case 'status':
        if (mode === 'accounts') {
          return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs font-medium text-slate-700">{val ?? 'Active'}</span>
              <span className="text-[10px] text-slate-400 font-medium">(read-only)</span>
            </div>
          );
        }
        return (
          <select
            value={val ?? 'To Do'}
            onChange={(e) => onChange({ status: e.target.value as ActionItemStatus })}
            className={`${inputCls} bg-white`}
          >
            {ACTION_ITEM_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        );

      case 'opportunityType':
        return (
          <select
            value={val ?? 'Growth'}
            onChange={(e) => onChange({ opportunityType: e.target.value })}
            className={`${inputCls} bg-white`}
          >
            {OPPORTUNITY_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        );

      case 'serviceLine':
        return (
          <select
            value={val ?? ''}
            onChange={(e) => onChange({ serviceLine: e.target.value || undefined })}
            className={`${inputCls} bg-white`}
          >
            <option value="">— None —</option>
            {SERVICE_LINE_OPTIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        );

      case 'aopAvailable':
        return (
          <AopYearFields
            aopAvailable={!!val}
            aopYear={entity.aopYear}
            onChange={(patch) => onChange(patch)}
            inputCls={inputCls}
          />
        );

      case 'tags':
        return (
          <input
            type="text"
            value={Array.isArray(val) ? val.join(', ') : (val ?? '')}
            onChange={(e) =>
              onChange({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="e.g., Consulting, Cloud"
            className={inputCls}
          />
        );

      case 'team':
        return (
          <input
            type="text"
            value={Array.isArray(val) ? val.join(', ') : (val ?? '')}
            onChange={(e) =>
              onChange({ team: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="e.g., John Smith, Sarah Lee"
            className={inputCls}
          />
        );

      default: {
        // Custom columns (user-defined) — render based on declared type.
        if (colType === 'boolean') {
          return (
            <div className="flex items-center h-8">
              <input
                type="checkbox"
                checked={!!val}
                onChange={(e) => onChange({ [key]: e.target.checked })}
                className="w-4 h-4 text-amber-600 border-slate-300 rounded cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-500 ml-2">Active / Yes</span>
            </div>
          );
        }
        if (colType === 'number') {
          return (
            <input
              type="number"
              value={val ?? ''}
              onChange={(e) =>
                onChange({ [key]: e.target.value === '' ? '' : Number(e.target.value) })
              }
              placeholder="Enter number"
              className={inputCls}
            />
          );
        }
        if (colType === 'date') {
          return (
            <input
              type="date"
              value={val ?? ''}
              onChange={(e) => onChange({ [key]: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          );
        }
        return (
          <input
            type="text"
            value={val ?? ''}
            onChange={(e) => onChange({ [key]: e.target.value })}
            placeholder="Enter value"
            className={inputCls}
          />
        );
      }
    }
  };

  return (
    <FormModal
      isOpen
      title={title}
      icon={<Pencil className="w-5 h-5 text-amber-600" aria-hidden="true" />}
      onClose={onCancel}
      onSubmit={onSave}
      submitLabel="Save Changes"
      isSubmitting={isSaving}
      submitVariant="warning"
      maxWidth="max-w-5xl"
    >
      {mode === 'opportunities' ? (
        /* Sectioned layout mirroring the Create Opportunity dialog so every
           editable field — including the Additional Details section — is
           available when editing, grouped exactly like the create flow. */
        <div className="space-y-5">
          <FormSection title="Deal Information">
            <FormGrid>
              <FormField label="Target Corporate Account">
                {renderInput(editCol('accountId', 'Target Corporate Account'))}
              </FormField>
              <FormField label="Opportunity Name" required>
                {renderInput(editCol('name', 'Opportunity Name'))}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Classification">
            <FormGrid columns={3}>
              <FormField label="Stage">
                {renderInput(editCol('stage', 'Stage'))}
              </FormField>
              <FormField label="Probability (%)">
                {renderInput(editCol('probability', 'Probability (%)', 'number'))}
              </FormField>
              <FormField label="Opportunity Type">
                {renderInput(editCol('opportunityType', 'Opportunity Type'))}
              </FormField>
              <FormField label="Service Line">
                {renderInput(editCol('serviceLine', 'Service Line'))}
              </FormField>
            </FormGrid>

            {/* Closing a deal captures an optional win/loss reason for analysis. */}
            {(entity.stage === 'Won' || entity.stage === 'Lost') && (
              <FormGrid>
                <FormField label={entity.stage === 'Won' ? 'Win Reason' : 'Loss Reason'} wide>
                  <textarea
                    value={entity.closeReason ?? ''}
                    rows={2}
                    onChange={(e) => onChange({ closeReason: e.target.value })}
                    placeholder={entity.stage === 'Won'
                      ? 'e.g., Strong technical fit and competitive pricing'
                      : 'e.g., Lost to competitor on price'}
                    className={`${inputCls} resize-none`}
                  />
                </FormField>
              </FormGrid>
            )}

            {/* Blocked/Delayed capture an optional reason — a distinct concept
                from Risks & Dependencies. */}
            {entity.stage === 'Blocked' && (
              <FormGrid>
                <FormField label="Blocked Reason" wide>
                  <textarea
                    value={entity.blockedReason ?? ''}
                    rows={2}
                    onChange={(e) => onChange({ blockedReason: e.target.value })}
                    placeholder="Describe why this opportunity is currently blocked..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>
              </FormGrid>
            )}
            {entity.stage === 'Delayed' && (
              <FormGrid>
                <FormField label="Delayed Reason" wide>
                  <textarea
                    value={entity.delayedReason ?? ''}
                    rows={2}
                    onChange={(e) => onChange({ delayedReason: e.target.value })}
                    placeholder="Describe why this opportunity has been delayed..."
                    className={`${inputCls} resize-none`}
                  />
                </FormField>
              </FormGrid>
            )}
          </FormSection>

          <FormSection title="Timeline & Value">
            <FormGrid columns={2}>
              <FormField label="Deal Value ($)">
                {renderInput(editCol('value', 'Deal Value ($)', 'number'))}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Allocation Period">
            <FormGrid columns={2}>
              <FormField label="Allocation Start Date">
                {renderInput(editCol('allocationStartDate', 'Allocation Start Date', 'date'))}
              </FormField>
              <FormField label="Allocation End Date">
                {renderInput(editCol('allocationEndDate', 'Allocation End Date', 'date'))}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Deal Period (Optional)">
            <FormGrid columns={2}>
              <FormField label="Deal Start Date">
                {renderInput(editCol('dealStartDate', 'Deal Start Date', 'date'))}
              </FormField>
              <FormField label="Deal Close Date">
                {renderInput(editCol('dealCloseDate', 'Deal Close Date', 'date'))}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Stakeholders">
            <FormGrid>
              {/* Same shared assignment fields as the Create Opportunity dialog,
                  so the inline "+ New Stakeholder" workflow (account + type
                  pre-filled and locked, form preserved, new record auto-selected)
                  is identical across every Opportunity create/edit entry point.
                  `tone="amber"` matches the surrounding edit-modal inputs. */}
              <StakeholderAssignmentFields
                accountId={entity.accountId}
                stakeholders={stakeholders}
                value={{
                  clientStakeholderId: entity.clientStakeholderId,
                  serviceProviderStakeholderId: entity.serviceProviderStakeholderId,
                }}
                onChange={onChange}
                tone="amber"
              />
            </FormGrid>
          </FormSection>

          <FormSection title="AOP Planning">
            <FormField label="AOP Planned" wide>
              {renderInput(editCol('aopAvailable', 'AOP Planned'))}
            </FormField>
          </FormSection>

          <FormSection title="Additional Details">
            <FormGrid>
              <FormField label="Detailed Scope" wide>
                {renderInput(editCol('description', 'Detailed Scope'))}
              </FormField>
              <FormField label="Risks & Dependencies" wide>
                {renderInput(editCol('risksAndDependencies', 'Risks & Dependencies'))}
              </FormField>
            </FormGrid>
          </FormSection>

          {customOppConfigs.length > 0 && (
            <FormSection title="Custom Fields">
              <FormGrid>
                {customOppConfigs.map((col) => (
                  <FormField key={col.key} label={col.name}>
                    {renderInput(col)}
                  </FormField>
                ))}
              </FormGrid>
            </FormSection>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formConfigs.map((col) => (
            <div
              key={col.key}
              className={`space-y-1${WIDE_KEYS.has(col.key) ? ' md:col-span-full' : ''}`}
            >
              <label className="text-label font-semibold text-slate-600 uppercase tracking-wide">
                {col.name}
              </label>
              {renderInput(col)}
            </div>
          ))}
        </div>
      )}
    </FormModal>
  );
};
