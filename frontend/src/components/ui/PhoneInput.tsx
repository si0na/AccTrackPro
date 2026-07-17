import React, { useEffect, useRef, useState } from 'react';

export interface CountryDialCode {
  dial: string;
  /** Short country label shown next to the dial code in the selector. */
  label: string;
  /** Valid national-number length range (digits only, excluding the dial code). */
  minDigits: number;
  maxDigits: number;
}

/**
 * Supported country codes for phone fields. National-number lengths follow
 * the ITU national significant number for each country.
 */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { dial: '+91', label: 'India', minDigits: 10, maxDigits: 10 },
  { dial: '+1', label: 'US/CA', minDigits: 10, maxDigits: 10 },
  { dial: '+44', label: 'UK', minDigits: 9, maxDigits: 10 },
  { dial: '+971', label: 'UAE', minDigits: 8, maxDigits: 9 },
  { dial: '+61', label: 'Australia', minDigits: 9, maxDigits: 9 },
  { dial: '+65', label: 'Singapore', minDigits: 8, maxDigits: 8 },
  { dial: '+49', label: 'Germany', minDigits: 10, maxDigits: 11 },
  { dial: '+33', label: 'France', minDigits: 9, maxDigits: 9 },
  { dial: '+31', label: 'Netherlands', minDigits: 9, maxDigits: 9 },
  { dial: '+81', label: 'Japan', minDigits: 10, maxDigits: 10 },
  { dial: '+86', label: 'China', minDigits: 11, maxDigits: 11 },
  { dial: '+60', label: 'Malaysia', minDigits: 9, maxDigits: 10 },
  { dial: '+63', label: 'Philippines', minDigits: 10, maxDigits: 10 },
  { dial: '+64', label: 'New Zealand', minDigits: 8, maxDigits: 10 },
  { dial: '+27', label: 'South Africa', minDigits: 9, maxDigits: 9 },
  { dial: '+55', label: 'Brazil', minDigits: 10, maxDigits: 11 },
  { dial: '+94', label: 'Sri Lanka', minDigits: 9, maxDigits: 9 },
  { dial: '+880', label: 'Bangladesh', minDigits: 10, maxDigits: 10 },
  { dial: '+966', label: 'Saudi Arabia', minDigits: 9, maxDigits: 9 },
  { dial: '+977', label: 'Nepal', minDigits: 10, maxDigits: 10 },
];

export const DEFAULT_DIAL_CODE = '+91';

// Longest dial code first so "+1" never claims a "+91"/"+971" number.
const DIAL_CODES_BY_LENGTH = [...COUNTRY_DIAL_CODES].sort(
  (a, b) => b.dial.length - a.dial.length,
);

/**
 * Splits a stored phone value ("+91 98765 43210") into dial code + national
 * number. Legacy values without a recognised dial code parse as national-only.
 */
export function splitPhone(value: string): { dial: string; national: string } {
  const v = (value || '').trim();
  if (v.startsWith('+')) {
    const match = DIAL_CODES_BY_LENGTH.find((c) => v.startsWith(c.dial));
    if (match) return { dial: match.dial, national: v.slice(match.dial.length).trim() };
  }
  return { dial: '', national: v };
}

/**
 * Validates a national number against the selected country's length rules.
 * Returns an error message, or null when valid. Emptiness is left to the
 * field's own `required` handling.
 */
export function validatePhone(dial: string, national: string): string | null {
  const trimmed = (national || '').trim();
  if (!trimmed) return null;
  if (/[^\d\s\-()]/.test(trimmed)) {
    return 'Phone number may only contain digits, spaces, dashes, and parentheses.';
  }
  const digits = trimmed.replace(/\D/g, '');
  const country = COUNTRY_DIAL_CODES.find((c) => c.dial === dial);
  if (!country) return null;
  if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    return country.minDigits === country.maxDigits
      ? `${country.label} (${country.dial}) numbers must have exactly ${country.minDigits} digits.`
      : `${country.label} (${country.dial}) numbers must have ${country.minDigits}–${country.maxDigits} digits.`;
  }
  return null;
}

/** Convenience check for callers that only hold the combined stored value. */
export function isValidPhone(value: string): boolean {
  const { dial, national } = splitPhone(value);
  return validatePhone(dial || DEFAULT_DIAL_CODE, national) === null;
}

const TONE_CLS = {
  blue: 'focus:ring-blue-500/20 focus:border-blue-500',
  amber: 'focus:ring-amber-500/20 focus:border-amber-500',
} as const;

export interface PhoneInputProps {
  /** Combined stored value, e.g. "+91 98765 43210". */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Amber focus styling for edit dialogs, blue for create forms. */
  tone?: keyof typeof TONE_CLS;
  placeholder?: string;
  className?: string;
}

/**
 * Phone field with a country-code selector: the dial code and the national
 * number are stored together as one string ("+91 98765 43210"), so existing
 * string-typed phone fields, APIs, and DB columns are unchanged. The national
 * number is length-validated per country via native form validation.
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  required = false,
  tone = 'blue',
  placeholder = 'e.g. 98765 43210',
  className = '',
}) => {
  const parsed = splitPhone(value);
  // The dial code lives in local state so it survives while the number is
  // empty (an empty field stores '' — no dangling "+91" in the data).
  const [dial, setDial] = useState(parsed.dial || DEFAULT_DIAL_CODE);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync the selector when an external value carries a different code
  // (e.g. opening an edit dialog for another record).
  useEffect(() => {
    const p = splitPhone(value);
    if (p.dial && p.dial !== dial) setDial(p.dial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const national = parsed.national;
  const error = validatePhone(dial, national);

  // Surface the error through native form validation so invalid numbers
  // block form submission with the browser's standard message UI.
  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? '');
  }, [error]);

  const emit = (nextDial: string, nextNational: string) => {
    onChange(nextNational.trim() ? `${nextDial} ${nextNational.trim()}` : '');
  };

  const fieldCls = `text-xs px-2.5 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
    error ? 'border-red-300' : 'border-slate-200'
  } ${TONE_CLS[tone]}`;

  return (
    <div className={className}>
      <div className="flex gap-2">
        <select
          value={dial}
          onChange={(e) => {
            setDial(e.target.value);
            if (national.trim()) emit(e.target.value, national);
          }}
          aria-label="Country code"
          className={`${fieldCls} w-28 shrink-0 bg-white cursor-pointer`}
        >
          {COUNTRY_DIAL_CODES.map((c) => (
            <option key={c.dial} value={c.dial}>
              {c.dial} {c.label}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="tel"
          required={required}
          value={national}
          onChange={(e) => emit(dial, e.target.value.replace(/[^\d\s\-()]/g, ''))}
          placeholder={placeholder}
          aria-label="Phone number"
          aria-invalid={!!error}
          className={`${fieldCls} flex-1 min-w-0 font-mono`}
        />
      </div>
      {error && (
        <p className="text-[10px] text-red-500 font-semibold mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
