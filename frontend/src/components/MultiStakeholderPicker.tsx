/**
 * MultiStakeholderPicker — a compact multi-select with checkboxes.
 * Displays selected stakeholders/users as a comma-separated string to keep the UI clean.
 *
 * The option list is rendered through a portal to `document.body` with fixed
 * positioning (the same approach as `SearchableSelect`), so it is never clipped
 * by a scrollable modal body and never forces the user to scroll the dialog to
 * reach the options. It flips above the trigger when there isn't enough room
 * below, and tracks the trigger on scroll/resize.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import type { Stakeholder, ServiceProviderUser } from '@/types';

/** Gap between the trigger and the floating list, and the list's max height. */
const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 260;
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

export interface MultiStakeholderPickerProps {
  mode: 'client' | 'service-provider';
  /** Controlled selected IDs */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** CLIENT stakeholders */
  stakeholders?: Stakeholder[];
  /** System users */
  serviceProviders?: ServiceProviderUser[];
  tone?: 'blue' | 'amber';
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export const MultiStakeholderPicker: React.FC<MultiStakeholderPickerProps> = ({
  mode,
  selectedIds,
  onChange,
  stakeholders = [],
  serviceProviders = [],
  tone = 'blue',
  placeholder,
  disabled = false,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click — the menu lives in a portal, so it has to be
  // checked separately from the trigger's container.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Position the floating list relative to the trigger, flipping upward when
  // the space below is too small. Recomputed on open and on scroll/resize.
  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 200) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
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
      setSearchTerm('');
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

  // Focus the search box as soon as the list opens so typing filters straight away.
  useEffect(() => {
    if (open && menuPos) searchRef.current?.focus();
  }, [open, menuPos]);

  const options = mode === 'client'
    ? stakeholders
        .filter((s) => s.stakeholderType === 'CLIENT')
        .map((s) => ({
          id: s.id,
          name: `${s.name}${s.designation ? ` (${s.designation})` : ''}`,
        }))
    : serviceProviders.map((sp) => ({
        id: sp.id,
        name: `${sp.name || sp.email}${sp.designation ? ` (${sp.designation})` : ''}${!sp.isActive ? ' [Inactive]' : ''}`,
      }));

  const query = searchTerm.trim().toLowerCase();
  const filteredOptions = query
    ? options.filter((o) => o.name.toLowerCase().includes(query))
    : options;

  const handleToggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  const selectedNames = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.name);

  const ringCls = tone === 'amber'
    ? 'focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
    : 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

  const defaultPlaceholder = mode === 'client'
    ? 'Select client stakeholders…'
    : 'Select service providers…';

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white cursor-pointer outline-none flex items-center justify-between gap-2 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${ringCls}`}
      >
        <span className={`truncate ${selectedNames.length ? 'text-slate-700' : 'text-slate-400'}`}>
          {selectedNames.length ? selectedNames.join(', ') : (placeholder || defaultPlaceholder)}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selectedNames.length > 0 && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
              {selectedNames.length}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-multiselectable="true"
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              top: menuPos.top,
              bottom: menuPos.bottom,
              maxHeight: menuPos.maxHeight,
            }}
            className="z-[300] flex flex-col rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // Close only the dropdown — stop the event from reaching the
                // Modal's document-level Escape handler so the dialog stays open.
                e.stopPropagation();
                setOpen(false);
              }
            }}
          >
            <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5 shrink-0">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                className="flex-1 min-w-0 text-xs px-1 py-0.5 text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-red-600 cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>

            <div className="overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                  {options.length === 0 ? 'No options available.' : 'No matches'}
                </div>
              ) : (
                filteredOptions.map((o) => {
                  const checked = selectedIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      role="option"
                      aria-selected={checked}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer select-none transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(o.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer w-3.5 h-3.5 shrink-0"
                      />
                      <span className="truncate flex-1">{o.name}</span>
                      {checked && <Check className="w-3 h-3 text-blue-600 shrink-0" aria-hidden="true" />}
                    </label>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
