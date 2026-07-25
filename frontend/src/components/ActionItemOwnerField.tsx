import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { STAKEHOLDER_TYPE_LABELS } from '@/components/ui';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { useCRM } from '@/contexts/CRMContext';
import type { Stakeholder } from '@/types';

const TONE_CLS = {
  blue: 'focus:ring-blue-500/20 focus:border-blue-500',
  amber: 'focus:ring-amber-500/20 focus:border-amber-500',
} as const;

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 208;
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export interface ActionItemOwnerFieldProps {
  accountId: string;
  stakeholders: Stakeholder[];
  /** The selected stakeholder's id (the Action Item's ownerStakeholderId). */
  value?: string;
  onChange: (stakeholderId: string) => void;
  tone?: keyof typeof TONE_CLS;
  required?: boolean;
}

/** Shown on the "+ New" button (tooltip + hint) until an account is chosen. */
const NO_ACCOUNT_MSG = 'Please select an Account before assigning an Owner.';

/**
 * Searchable Owner picker for Action Items — a single combined dropdown of
 * every stakeholder (Client AND Service Provider) on the selected account,
 * each labelled "{name} ({Client|Service Provider})" so the two are easy to
 * tell apart. Owner must always be a real stakeholder on the account, so this
 * never accepts free text; typing only filters the list.
 *
 * Carries the same inline "+ New Stakeholder" affordance as
 * `StakeholderAssignmentFields` (portal to the shared create dialog, account
 * pre-filled and locked, new record auto-selected) so an account with no
 * stakeholders yet isn't a dead end.
 */
export const ActionItemOwnerField: React.FC<ActionItemOwnerFieldProps> = ({
  accountId,
  stakeholders,
  value,
  onChange,
  tone = 'blue',
  required = true,
}) => {
  const { accounts, addStakeholder } = useCRM();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const account = accounts.find((a) => a.id === accountId);
  const createDisabledReason = account ? undefined : NO_ACCOUNT_MSG;

  const options = stakeholders
    .filter((s) => s.accountId === accountId)
    .map((s) => ({
      id: s.id,
      label: `${s.name} (${STAKEHOLDER_TYPE_LABELS[s.stakeholderType]})`,
    }));

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
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
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const activeEl = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commit = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
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
      if (filtered[activeIndex]) commit(filtered[activeIndex].id);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  const fieldCls =
    `w-full text-xs pl-3 pr-9 py-2 border border-slate-200 rounded-lg bg-white cursor-text ` +
    `focus:outline-none focus:ring-2 ${TONE_CLS[tone]}`;

  const handleCreated = async (draft: Omit<Stakeholder, 'id'>) => {
    const created = await addStakeholder(draft);
    onChange(created.id);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1 min-w-0" ref={containerRef}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Owner"
          required={required}
          disabled={!accountId}
          value={open ? query : (selected?.label ?? '')}
          placeholder="Search stakeholders…"
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
        <ChevronsUpDown
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
          aria-hidden="true"
        />
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
                <li className="px-3 py-1.5 text-slate-400">
                  {options.length === 0 ? 'No stakeholders on this account yet' : 'No matches'}
                </li>
              ) : (
                filtered.map((option, i) => (
                  <li
                    key={option.id}
                    role="option"
                    aria-selected={option.id === value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(option.id);
                    }}
                    className={`px-2.5 py-1 cursor-pointer flex items-center justify-between ${
                      i === activeIndex ? 'bg-blue-50' : ''
                    } ${option.id === value ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
                  >
                    {option.label}
                    {option.id === value && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!!createDisabledReason}
          title={createDisabledReason ? createDisabledReason : 'Create a new stakeholder'}
          aria-label="Create a new stakeholder"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50 disabled:hover:border-blue-200 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New
        </button>
      </div>
      {createDisabledReason && (
        <span className="block text-micro text-slate-400 font-medium">{createDisabledReason}</span>
      )}

      {creating && account &&
        createPortal(
          <StakeholderFormModal
            isOpen
            mode="create"
            accounts={accounts}
            lockedAccount={{ id: account.id, name: account.name }}
            onClose={() => setCreating(false)}
            onSubmit={handleCreated}
          />,
          document.body,
        )}
    </div>
  );
};
