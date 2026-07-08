import React, { useMemo } from 'react';
import { Pencil } from 'lucide-react';
import { FormModal, INPUT_CLS_AMBER } from '@/components/ui';
import { NumberInput } from '@/components/NumberInput';
import type {
  Account,
  Opportunity,
  ColumnConfig,
  AccountType,
  AccountHealth,
  OpportunityStage,
  OpportunityStatus,
  PriorityLevel,
  ActionItemStatus,
} from '@/types';

export type EditMode = 'accounts' | 'opportunities' | 'actionItems';

export interface InlineEditModalProps {
  mode: EditMode;
  entity: Record<string, any>;
  /** Columns currently visible in the table — the modal renders only these fields. */
  displayedConfigs: ColumnConfig[];
  accounts: Account[];
  opportunities: Opportunity[];
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

// These keys span both columns of the 2-col grid.
const WIDE_KEYS = new Set([
  'name', 'title', 'accountId', 'industry', 'address',
  'description', 'notes', 'nextStep', 'tags', 'team',
]);

export const InlineEditModal: React.FC<InlineEditModalProps> = ({
  mode,
  entity,
  displayedConfigs,
  accounts,
  opportunities,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  const { title, primaryKey } = MODE_META[mode];
  const inputCls = INPUT_CLS_AMBER;

  // Always include the primary identifier field even if hidden in the table.
  const formConfigs = useMemo<ColumnConfig[]>(() => {
    if (displayedConfigs.some((c) => c.key === primaryKey)) return displayedConfigs;
    const pkCol: ColumnConfig = {
      key: primaryKey,
      name: primaryKey === 'title' ? 'Task Title' : 'Name',
      isStandard: true,
      isPinned: true,
      isDisplayed: true,
      type: 'text',
    };
    return [pkCol, ...displayedConfigs];
  }, [displayedConfigs, primaryKey]);

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
            value={val ?? 'Growth'}
            onChange={(e) => onChange({ type: e.target.value as AccountType })}
            className={`${inputCls} bg-white`}
          >
            <option value="Growth">Growth</option>
            <option value="Pursuit">Pursuit</option>
            <option value="Project">Project</option>
          </select>
        );

      case 'health':
        return (
          <select
            value={val ?? 'Healthy'}
            onChange={(e) => onChange({ health: e.target.value as AccountHealth })}
            className={`${inputCls} bg-white`}
          >
            <option value="Healthy">Healthy</option>
            <option value="At Risk">At Risk</option>
            <option value="Critical">Critical</option>
          </select>
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

      case 'stage':
        return (
          <select
            value={val ?? 'Lead'}
            onChange={(e) => {
              const stage = e.target.value as OpportunityStage;
              // Lifecycle sync: reaching Won closes the deal; regressing from
              // Won reopens it (an explicit Lost is never overridden).
              const patch: Record<string, any> = { stage };
              if (stage === 'Won') patch.status = 'Won';
              else if (entity.status === 'Won') patch.status = 'Open';
              onChange(patch);
            }}
            className={`${inputCls} bg-white`}
          >
            <option value="Lead">Lead</option>
            <option value="Qualified">Qualified</option>
            <option value="Proposal">Proposal</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Won">Won</option>
          </select>
        );

      case 'value':
        return (
          <NumberInput
            required
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

      case 'closeDate':
      case 'startDate':
      case 'endDate':
      case 'dueDate':
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
        return mode === 'actionItems' ? (
          <select
            value={val ?? 'Not Started'}
            onChange={(e) => onChange({ status: e.target.value as ActionItemStatus })}
            className={`${inputCls} bg-white`}
          >
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Blocked">Blocked</option>
            <option value="Completed">Completed</option>
          </select>
        ) : (
          <select
            value={val ?? 'Open'}
            onChange={(e) => onChange({ status: e.target.value as OpportunityStatus })}
            className={`${inputCls} bg-white`}
          >
            <option value="Open">Open</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>
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
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {formConfigs.map((col) => (
          <div
            key={col.key}
            className={`space-y-1${WIDE_KEYS.has(col.key) ? ' md:col-span-2' : ''}`}
          >
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              {col.name}
            </label>
            {renderInput(col)}
          </div>
        ))}
        {/* Closing a deal requires a win/loss reason (enforced server-side too). */}
        {mode === 'opportunities' && (entity.status === 'Won' || entity.status === 'Lost') && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              {entity.status === 'Won' ? 'Win Reason' : 'Loss Reason'} <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={entity.closeReason ?? ''}
              rows={2}
              onChange={(e) => onChange({ closeReason: e.target.value })}
              placeholder={entity.status === 'Won'
                ? 'e.g., Strong technical fit and competitive pricing'
                : 'e.g., Lost to competitor on price'}
              className={`${inputCls} resize-none`}
            />
          </div>
        )}
      </div>
    </FormModal>
  );
};
