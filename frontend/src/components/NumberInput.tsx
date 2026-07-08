import React, { useEffect, useState } from 'react';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Current numeric value. 0 / undefined / null render as an empty field. */
  value: number | undefined | null;
  /** Called with the parsed number; empty or invalid input reports 0. */
  onValueChange: (value: number) => void;
}

/**
 * Controlled numeric input that keeps the raw text the user is typing, so
 * fields never get stuck on a default "0" that must be deleted first.
 * An empty field reports 0 to the parent while displaying as blank; when the
 * field is `required`, native form validation still forces an explicit entry.
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onValueChange,
  placeholder = '0',
  ...rest
}) => {
  const toText = (v: number | undefined | null) =>
    v === undefined || v === null || v === 0 ? '' : String(v);

  const [text, setText] = useState<string>(() => toText(value));

  // Sync from the parent only when the numeric value diverges from what the
  // current text already represents (an external change, not our own echo).
  useEffect(() => {
    const parsed = text === '' ? 0 : Number(text);
    if (Number.isNaN(parsed) || parsed !== (value ?? 0)) setText(toText(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="number"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = Number(raw);
        onValueChange(raw === '' || Number.isNaN(parsed) ? 0 : parsed);
      }}
      {...rest}
    />
  );
};
