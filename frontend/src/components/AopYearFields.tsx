import React, { useId } from 'react';
import { SearchableSelect } from '@/components/ui';
import { AOP_YEAR_OPTIONS, DEFAULT_AOP_YEAR } from '@/constants';

export interface AopYearFieldsProps {
  aopAvailable: boolean;
  aopYear: string | null | undefined;
  onChange: (patch: { aopAvailable?: boolean; aopYear?: string | null }) => void;
  /** Amber focus styling for edit dialogs, blue (default) for create forms. */
  tone?: 'blue' | 'amber';
}

/**
 * "AOP Planned" Yes/No radio pair with a conditional, type-to-search "Year"
 * field in YYYY-YYYY format — selecting No hides and clears the Year value
 * (stored as null). The year list is generated far enough into the future to
 * be effectively unlimited, so search is how users pick a distant year quickly.
 */
export const AopYearFields: React.FC<AopYearFieldsProps> = ({
  aopAvailable,
  aopYear,
  onChange,
  tone = 'blue',
}) => {
  const name = useId();
  // Existing records may carry a legacy year outside the generated range — keep
  // it selectable so saved data still displays and edits correctly.
  const options =
    aopYear && !(AOP_YEAR_OPTIONS as readonly string[]).includes(aopYear)
      ? [aopYear, ...AOP_YEAR_OPTIONS]
      : AOP_YEAR_OPTIONS;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-5">
        {(['Yes', 'No'] as const).map((label) => {
          const value = label === 'Yes';
          return (
            <label key={label} className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600">
              <input
                type="radio"
                name={name}
                checked={aopAvailable === value}
                onChange={() =>
                  onChange(
                    value
                      ? { aopAvailable: true, aopYear: aopYear ?? DEFAULT_AOP_YEAR }
                      : { aopAvailable: false, aopYear: null },
                  )
                }
                className="w-3.5 h-3.5 text-blue-600 border-slate-300 cursor-pointer"
              />
              {label}
            </label>
          );
        })}
      </div>
      {aopAvailable && (
        <SearchableSelect
          required
          value={aopYear ?? DEFAULT_AOP_YEAR}
          onChange={(year) => onChange({ aopYear: year })}
          options={options}
          placeholder="Search year…"
          tone={tone}
          showChevron={false}
          className="font-mono max-w-[112px]"
          aria-label="AOP Year"
        />
      )}
    </div>
  );
};
