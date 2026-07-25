import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, X } from 'lucide-react';

const TONE_CLS = {
  blue: 'focus:ring-blue-500/20 focus:border-blue-500',
  amber: 'focus:ring-amber-500/20 focus:border-amber-500',
} as const;

/** Gap between the input and the floating list, and the list's max height. */
const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 176;
/** Keep the list clear of the viewport edge when computing available space. */
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  left: number;
  width: number;
  /** Distance from the top of the viewport when opening downward. */
  top?: number;
  /** Distance from the bottom of the viewport when opening upward. */
  bottom?: number;
  maxHeight: number;
}

/** A plain string is its own value and label; `{ value, label }` backs id-based pickers (e.g. selecting an employee by id while displaying their name). */
export type SearchableSelectOption = string | { value: string; label: string };

interface NormalizedOption {
  value: string;
  label: string;
}

function normalizeOptions(options: readonly SearchableSelectOption[]): NormalizedOption[] {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  placeholder?: string;
  required?: boolean;
  /** Amber focus styling for edit dialogs, blue for create forms. */
  tone?: keyof typeof TONE_CLS;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Hides the chevron affordance for compact fields where it's just visual noise. Default true. */
  showChevron?: boolean;
}

/**
 * Type-to-search dropdown: value can only be set by picking one of `options`
 * (typing filters the list but never becomes the stored value directly), so
 * callers never receive free text outside the predefined list.
 *
 * The floating list is rendered through a portal to `document.body` with
 * fixed positioning, so it is never clipped by a scrollable modal body or
 * hidden behind a fixed modal footer. It flips upward automatically when there
 * isn't enough room below the input, and tracks the input on scroll/resize.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Search…',
  required = false,
  tone = 'blue',
  className = '',
  id,
  'aria-label': ariaLabel,
  showChevron = true,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const normalizedOptions = normalizeOptions(options);
  const selectedOption = normalizedOptions.find((o) => o.value === value);
  const displayValue = selectedOption?.label ?? value;

  const filtered = query.trim()
    ? normalizedOptions.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : normalizedOptions;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Position the floating list relative to the input, flipping upward when
  // the space below is too small. Recomputed on open and on scroll/resize.
  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
    );
    setMenuPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + MENU_GAP,
      bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    // Capture phase so we react to scrolls on any ancestor (e.g. modal body).
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  // Keep the active option scrolled into view while navigating by keyboard.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const activeEl = list?.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commit = (option: NormalizedOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) commit(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      // Close only the dropdown — stop the event from reaching the Modal's
      // document-level Escape handler so the dialog stays open.
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  const showClearButton = !required && !!value;
  const hasRightSlot = showClearButton || showChevron;

  const fieldCls =
    `w-full text-xs pl-3 ${hasRightSlot ? 'pr-16' : 'pr-3'} py-2 border border-slate-200 rounded-lg bg-white cursor-text ` +
    `focus:outline-none focus:ring-2 ${TONE_CLS[tone]} ${className}`;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        required={required}
        value={open ? query : displayValue}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery('');
        }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className={fieldCls}
      />
      {hasRightSlot && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-slate-400">
          {showClearButton && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                clear();
              }}
              aria-label="Clear selection"
              className="p-0.5 rounded hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {showChevron && <ChevronsUpDown className="w-3.5 h-3.5" aria-hidden="true" />}
        </div>
      )}
      {open &&
        menuPos &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              top: menuPos.top,
              bottom: menuPos.bottom,
              maxHeight: menuPos.maxHeight,
            }}
            className="z-[300] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg text-xs py-0.5"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-1.5 text-slate-400">No matches</li>
            ) : (
              filtered.map((option, i) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(option);
                  }}
                  className={`px-2.5 py-1 cursor-pointer flex items-center justify-between ${
                    i === activeIndex ? 'bg-blue-50' : ''
                  } ${option.value === value ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
                >
                  {option.label}
                  {option.value === value && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
};
