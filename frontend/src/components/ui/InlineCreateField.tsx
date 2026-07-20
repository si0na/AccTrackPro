import React from 'react';
import { Plus } from 'lucide-react';

export interface InlineCreateFieldProps {
  /** Bold uppercase field label, matching FormField. */
  label: string;
  required?: boolean;
  /** Span both columns of a 2-col form grid. */
  wide?: boolean;
  /**
   * When set, the "+ New" button is disabled and this text is surfaced both as
   * its tooltip and as a hint below the control (e.g. "Please select an Account
   * before creating a Stakeholder.").
   */
  createDisabledReason?: string;
  /** Fired when the "+ New" button is pressed. */
  onCreate: () => void;
  /** Noun used in the button's title/aria-label — e.g. "client stakeholder". */
  createLabel?: string;
  /** The field control (select/input) rendered to the left of the button. */
  children: React.ReactNode;
}

/**
 * A labelled field paired with a "+ New" action, so a related record can be
 * created inline without leaving the current form. Presentational and entity-
 * agnostic: the caller supplies the control as children and wires `onCreate` to
 * open whatever create dialog fits — reusable for stakeholders, contacts,
 * accounts, and any future inline-creatable relationship.
 *
 * Note: this renders a plain container (not a `<label>`) on purpose — a `<label>`
 * wrapping both the control and the button would route button clicks to the
 * control, so the label is a `<span>` and the button stands on its own.
 */
export const InlineCreateField: React.FC<InlineCreateFieldProps> = ({
  label,
  required = false,
  wide = false,
  createDisabledReason,
  onCreate,
  createLabel = 'record',
  children,
}) => {
  const disabled = !!createDisabledReason;
  return (
    <div className={`block space-y-1 ${wide ? 'sm:col-span-full' : ''}`}>
      <span className="block text-label font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0">{children}</div>
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          title={disabled ? createDisabledReason : `Create a new ${createLabel}`}
          aria-label={`Create a new ${createLabel}`}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50 disabled:hover:border-blue-200 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New
        </button>
      </div>
      {disabled && (
        <span className="block text-micro text-slate-400 font-medium">{createDisabledReason}</span>
      )}
    </div>
  );
};
