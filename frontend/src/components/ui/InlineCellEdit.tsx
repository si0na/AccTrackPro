import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2 } from 'lucide-react';
import { INPUT_CLS } from './Form';

/** Inline Text / Date / Number Edit Cell */
export const InlineTextEditCell: React.FC<{
  value?: string | number | null;
  type?: 'text' | 'date' | 'number';
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSave: (val: any) => Promise<void> | void;
  formatDisplay?: (val: any) => string;
}> = ({
  value = '',
  type = 'text',
  placeholder = 'Click to edit...',
  className = '',
  disabled = false,
  onSave,
  formatDisplay,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempVal(value ?? '');
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      if (type === 'text') inputRef.current?.select();
    }
  }, [isEditing, type]);

  const handleSave = async () => {
    if (saving) return;
    setIsEditing(false);
    if (tempVal === (value ?? '')) return;
    setSaving(true);
    try {
      let finalVal: any = tempVal;
      if (type === 'number') {
        finalVal = tempVal === '' ? undefined : Number(tempVal);
      }
      await onSave(finalVal);
    } catch {
      setTempVal(value ?? '');
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    const displayStr = formatDisplay ? formatDisplay(value) : String(value ?? '');
    return (
      <div
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setIsEditing(true);
        }}
        className={`group inline-flex items-center gap-1.5 px-1.5 py-1 -mx-1.5 rounded hover:bg-slate-100/80 transition-colors ${
          disabled ? '' : 'cursor-pointer'
        } ${className}`}
        title={disabled ? undefined : 'Click to edit'}
      >
        <span className={displayStr ? 'truncate' : 'text-slate-400 italic font-normal'}>
          {displayStr || placeholder}
        </span>
        {!disabled && (
          <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center w-full">
      <input
        ref={inputRef}
        type={type}
        value={tempVal}
        disabled={saving}
        onChange={(e) => setTempVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setTempVal(value ?? '');
            setIsEditing(false);
          }
        }}
        className={`${INPUT_CLS} text-xs py-0.5 px-1.5 h-7 w-full`}
      />
    </div>
  );
};

/** Inline Dropdown Select Edit Cell */
export const InlineSelectEditCell: React.FC<{
  value?: string | boolean | number | null;
  options: ReadonlyArray<{ value: string; label: string } | string>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSave: (val: string) => Promise<void> | void;
}> = ({
  value = '',
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  onSave,
}) => {
  const [saving, setSaving] = useState(false);

  const formattedOptions = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );

  const strVal = value === true ? 'Yes' : value === false ? 'No' : String(value ?? '');

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    if (newVal === strVal || saving) return;
    setSaving(true);
    try {
      await onSave(newVal);
    } finally {
      setSaving(false);
    }
  };

  if (disabled) {
    const selectedOpt = formattedOptions.find((o) => o.value === strVal);
    return (
      <span className="text-slate-600 font-medium">
        {selectedOpt?.label || strVal || placeholder}
      </span>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center max-w-full">
      <select
        value={strVal}
        disabled={saving}
        onChange={handleChange}
        className={`text-xs font-semibold border border-slate-200 rounded-md py-1 px-1.5 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors ${className}`}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {formattedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/** Inline Long Text Popover Edit Cell */
export const InlineTextareaEditCell: React.FC<{
  value?: string | null;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSave: (val: string) => Promise<void> | void;
}> = ({
  value = '',
  label,
  placeholder = 'No content',
  disabled = false,
  className = 'w-[190px]',
  onSave,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempVal, setTempVal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => { setTempVal(value ?? ''); }, [value]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    let top = rect.bottom + 6;
    if (
      top + popover.offsetHeight > window.innerHeight - 8 &&
      rect.top - 6 - popover.offsetHeight > 8
    ) {
      top = rect.top - 6 - popover.offsetHeight;
    }
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - popover.offsetWidth - 8),
    );
    setPos({ top, left });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  const handleSave = async () => {
    if (saving) return;
    setIsOpen(false);
    if (tempVal === (value ?? '')) return;
    setSaving(true);
    try {
      await onSave(tempVal);
    } catch {
      setTempVal(value ?? '');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      handleSave();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setTempVal(value ?? '');
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, tempVal, value]);

  const strVal = (value ?? '').trim();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setPos(null);
          setIsOpen((o) => !o);
        }}
        title={strVal || undefined}
        className={`group flex items-center justify-between gap-1 ${className} truncate text-left text-xs font-medium cursor-pointer rounded py-0.5 px-1 hover:bg-slate-100 transition-colors ${
          strVal ? 'text-slate-700' : 'text-slate-400 italic'
        }`}
      >
        <span className="truncate">{strVal || placeholder}</span>
        {!disabled && (
          <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          className="fixed z-[70] w-80 max-w-[calc(100vw-16px)] rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Save
            </button>
          </div>
          <textarea
            ref={textareaRef}
            rows={4}
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
            placeholder={`Enter ${label}...`}
          />
        </div>,
        document.body,
      )}
    </>
  );
};
