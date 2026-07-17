import React, { useId } from 'react';
import { INPUT_CLS } from '@/components/ui';

export interface AopYearFieldsProps {
  aopAvailable: boolean;
  aopYear: string | null | undefined;
  onChange: (patch: { aopAvailable?: boolean; aopYear?: string | null }) => void;
  inputCls?: string;
}

/**
 * "AOP Planned" Yes/No radio pair with a conditional "Year" field in
 * YYYY-YYYY format — selecting No hides and clears the Year value (stored as null).
 */
export const AopYearFields: React.FC<AopYearFieldsProps> = ({
  aopAvailable,
  aopYear,
  onChange,
  inputCls = INPUT_CLS,
}) => {
  const name = useId();
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
                onChange={() => onChange(value ? { aopAvailable: true } : { aopAvailable: false, aopYear: null })}
                className="w-3.5 h-3.5 text-blue-600 border-slate-300 cursor-pointer"
              />
              {label}
            </label>
          );
        })}
      </div>
      {aopAvailable && (
        <input
          type="text"
          required
          inputMode="numeric"
          maxLength={9}
          pattern="\d{4}-\d{4}"
          title="AOP Year must be in YYYY-YYYY format (e.g. 2026-2027)"
          value={aopYear ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
            const formatted = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
            onChange({ aopYear: formatted });
          }}
          placeholder="e.g., 2026-2027"
          className={`${inputCls} font-mono max-w-[140px]`}
        />
      )}
    </div>
  );
};
