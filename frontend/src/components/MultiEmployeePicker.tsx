import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Plus, Users } from 'lucide-react';
import { User, ServiceProviderUser } from '@/types';

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export interface EmployeeOption {
  id: string;
  name: string;
  email?: string;
  role?: string;
  designation?: string;
  department?: string;
}

export interface MultiEmployeePickerProps {
  users: Array<EmployeeOption | ServiceProviderUser | User>;
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
  valueText: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MultiEmployeePicker: React.FC<MultiEmployeePickerProps> = ({
  users,
  selectedIds,
  onChangeIds,
  valueText,
  onChangeText,
  placeholder = 'Search or type employee names to add...',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse existing names from valueText
  const currentNames = useMemo(() => {
    if (!valueText) return [];
    return valueText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [valueText]);

  const setNames = useCallback(
    (names: string[]) => {
      onChangeText(names.join(', '));
    },
    [onChangeText],
  );

  // Filtered system users based on search query with secondary deduplication
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();

    return users.filter((u) => {
      const displayName = (u.name || (u as any).fullName || (u as any).displayName || u.email || '').trim();
      if (!displayName) return false;

      const email = (u.email || '').trim().toLowerCase();
      const nameKey = displayName.toLowerCase();
      const dedupKey = u.id ? `${u.id}_${email || nameKey}` : (email || nameKey);

      if (seen.has(dedupKey) || (email && seen.has(email)) || seen.has(nameKey)) return false;
      seen.add(dedupKey);
      if (email) seen.add(email);
      seen.add(nameKey);

      if (!q) return true;

      const roleOrDesig = ((u as any).role || (u as any).designation || '').toLowerCase();
      const deptStr = (u.department || '').toLowerCase();

      return (
        nameKey.includes(q) ||
        email.includes(q) ||
        roleOrDesig.includes(q) ||
        deptStr.includes(q)
      );
    });
  }, [users, query]);

  // Position portal dropdown
  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, 180) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
    setMenuPos({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + MENU_GAP,
      bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
      maxHeight,
    });
  }, []);

  const openPicker = () => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
    inputRef.current?.focus();
  };

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

  // Close on outside click
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

  // Add a user by object
  const handleSelectUser = (user: EmployeeOption | ServiceProviderUser | User) => {
    const nameExists = currentNames.some((n) => n.toLowerCase() === user.name.toLowerCase());
    if (!nameExists) {
      setNames([...currentNames, user.name]);
    }
    if (!selectedIds.includes(user.id)) {
      onChangeIds([...selectedIds, user.id]);
    }
    setQuery('');
  };

  // Toggle user selection
  const handleToggleUser = (user: EmployeeOption | ServiceProviderUser | User) => {
    const nameExists = currentNames.some((n) => n.toLowerCase() === user.name.toLowerCase());
    const isIdSelected = selectedIds.includes(user.id);

    if (nameExists || isIdSelected) {
      // Remove
      setNames(currentNames.filter((n) => n.toLowerCase() !== user.name.toLowerCase()));
      onChangeIds(selectedIds.filter((id) => id !== user.id));
    } else {
      // Add
      handleSelectUser(user);
    }
  };

  // Add custom typed name
  const handleAddCustom = (customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const foundUser = users.find((u) => u.name.toLowerCase() === trimmed.toLowerCase());
    if (foundUser) {
      handleSelectUser(foundUser);
    } else {
      const nameExists = currentNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());
      if (!nameExists) {
        setNames([...currentNames, trimmed]);
      }
    }
    setQuery('');
  };

  // Remove a name tag
  const handleRemoveName = (nameToRemove: string) => {
    const updatedNames = currentNames.filter((n) => n !== nameToRemove);
    setNames(updatedNames);
    const matchedUser = users.find((u) => u.name.toLowerCase() === nameToRemove.toLowerCase());
    if (matchedUser) {
      onChangeIds(selectedIds.filter((id) => id !== matchedUser.id));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        handleAddCustom(query);
      }
    } else if (e.key === 'Backspace' && !query && currentNames.length > 0) {
      handleRemoveName(currentNames[currentNames.length - 1]);
    }
  };

  const showCustomOption =
    query.trim() && !users.some((u) => u.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search & Tag Field Container */}
      <div
        onClick={() => openPicker()}
        className={`w-full min-h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center gap-1.5 cursor-text transition-colors ${
          open ? 'ring-2 ring-indigo-500/20 border-indigo-500' : 'hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <Users className="w-4 h-4 text-indigo-500 shrink-0 mr-1" />

        {/* Selected Member Tags */}
        {currentNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 animate-in fade-in duration-100"
          >
            <span>{name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveName(name);
                }}
                className="hover:bg-indigo-100 rounded p-0.5 text-indigo-500 hover:text-indigo-800 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* Inline Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            openPicker();
          }}
          onFocus={() => openPicker()}
          onKeyDown={handleKeyDown}
          placeholder={currentNames.length === 0 ? placeholder : 'Add more...'}
          className="flex-1 min-w-[140px] text-xs font-medium text-slate-800 placeholder-slate-400 bg-transparent outline-none border-none p-0 focus:ring-0"
        />
      </div>

      {/* Floating Dropdown Portal */}
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              top: menuPos.top !== undefined ? `${menuPos.top}px` : undefined,
              bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : undefined,
              maxHeight: `${menuPos.maxHeight}px`,
            }}
            className="z-[9999] bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
          >
            {/* System Employees Header */}
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Search Employees</span>
              <span>{filteredUsers.length} found</span>
            </div>

            {/* List Options */}
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              {showCustomOption && (
                <button
                  type="button"
                  onClick={() => handleAddCustom(query)}
                  className="w-full text-left px-3 py-2 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Add custom team member: <span className="font-bold underline">{query.trim()}</span></span>
                </button>
              )}

              {filteredUsers.length === 0 && !showCustomOption && (
                <div className="p-3 text-center text-xs text-slate-400 italic">
                  No employees found matching "{query}"
                </div>
              )}

              {filteredUsers.map((user) => {
                const displayName = user.name || (user as any).fullName || (user as any).displayName || user.email || 'Unnamed Employee';
                const isSelected =
                  currentNames.some((n) => n.toLowerCase() === displayName.toLowerCase()) ||
                  selectedIds.includes(user.id);
                return (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => handleToggleUser({ ...user, name: displayName })}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/60 text-indigo-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="truncate">{displayName}</span>
                      <span className="text-[11px] text-slate-400 font-normal truncate">
                        ({(user as any).designation || (user as any).role || user.email || 'Employee'})
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
