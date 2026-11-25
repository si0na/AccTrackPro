import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, RefreshCw, UserCheck, Cloud, CloudOff, ExternalLink } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { showToast } from '@/components/common/ToastHost';
import type { EmployeeDirectoryUser } from '@/types';

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 280;
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export interface EmployeeSearchableSelectProps {
  valueId?: string;
  valueName?: string;
  onSelect: (employee: EmployeeDirectoryUser | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  allowClear?: boolean;
  /** Custom employees list if provided by parent, otherwise defaults to useEmployees() hook */
  customEmployees?: EmployeeDirectoryUser[];
  /** Optional secondary label override */
  ariaLabel?: string;
}

export const EmployeeSearchableSelect: React.FC<EmployeeSearchableSelectProps> = ({
  valueId,
  valueName,
  onSelect,
  placeholder = 'Search employee directory by name or email…',
  disabled = false,
  required = false,
  className = '',
  allowClear = true,
  customEmployees,
  ariaLabel = 'Select Employee',
}) => {
  const {
    employees: hookEmployees,
    loading,
    connecting,
    source,
    fallbackReason,
    isGraphConnected,
    refresh,
    totalCount,
    connectGraph,
  } = useEmployees(!customEmployees);

  const employees = customEmployees || hookEmployees;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently selected employee object by valueId or valueName
  const selectedEmployee = useMemo(() => {
    if (!employees || employees.length === 0) return null;
    if (valueId) {
      const match = employees.find((e) => e.id === valueId || e.localEmployeeId === valueId);
      if (match) return match;
    }
    if (valueName) {
      const matchName = employees.find(
        (e) => e.displayName.toLowerCase() === valueName.trim().toLowerCase(),
      );
      if (matchName) return matchName;
    }
    return null;
  }, [employees, valueId, valueName]);

  // Filtered employees capped at 50 for smooth UI rendering
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return employees.slice(0, 50);
    }
    const matches: EmployeeDirectoryUser[] = [];
    for (const emp of employees) {
      const nameMatch = emp.displayName.toLowerCase().includes(q);
      const emailMatch =
        (emp.email || '').toLowerCase().includes(q) ||
        emp.userPrincipalName.toLowerCase().includes(q);
      if (nameMatch || emailMatch) {
        matches.push(emp);
        if (matches.length >= 50) break;
      }
    }
    return matches;
  }, [employees, searchQuery]);

  // Compute floating menu position
  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openUp = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

    const availableHeight = Math.max(100, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));

    setMenuPos({
      left: Math.max(VIEWPORT_MARGIN, rect.left),
      width: rect.width,
      top: openUp ? undefined : rect.bottom + MENU_GAP,
      bottom: openUp ? window.innerHeight - rect.top + MENU_GAP : undefined,
      maxHeight: availableHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      window.addEventListener('resize', updateMenuPosition);
      window.addEventListener('scroll', updateMenuPosition, true);
      return () => {
        window.removeEventListener('resize', updateMenuPosition);
        window.removeEventListener('scroll', updateMenuPosition, true);
      };
    }
  }, [isOpen, updateMenuPosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (emp: EmployeeDirectoryUser) => {
    onSelect(emp);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearchQuery('');
  };

  const handleConnectDirectory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    try {
      const count = await connectGraph();
      showToast({
        kind: 'success',
        message: `Successfully connected Microsoft Employee Directory. ${count} employees synchronized.`,
      });
    } catch (err: any) {
      showToast({
        kind: 'error',
        message: err?.message || 'Failed to connect to Microsoft Entra Directory.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const displayText = selectedEmployee
    ? `${selectedEmployee.displayName}${selectedEmployee.email ? ` (${selectedEmployee.email})` : ''}`
    : valueName || '';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={displayText}
          required={required}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Select trigger button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={`flex items-center justify-between w-full px-3 py-2 text-xs border rounded-lg transition-colors cursor-pointer select-none ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-white text-slate-900'
            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-900'
        }`}
      >
        <div className="flex items-center space-x-2 truncate min-w-0">
          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className={`truncate ${displayText ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
            {displayText || placeholder}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
          {allowClear && (displayText || valueId) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {isGraphConnected ? (
            <span
              title={`Connected to Microsoft Entra Directory via Microsoft Graph (${totalCount} employees)`}
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100"
            >
              <Cloud className="w-2.5 h-2.5 mr-1 text-blue-600" />
              Graph
            </span>
          ) : (
            <span
              title={fallbackReason || 'Not connected to Microsoft Graph directory'}
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"
            >
              <CloudOff className="w-2.5 h-2.5 mr-1 text-slate-400" />
              Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Floating Menu Portal */}
      {isOpen &&
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
              zIndex: 9999,
            }}
            className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-xs animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {/* Search Input Header */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or email…"
                className="w-full bg-transparent border-none outline-none text-xs text-slate-800 placeholder-slate-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Employee Options List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 max-h-[190px]">
              {loading && employees.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Loading Microsoft employee directory…</div>
              ) : !isGraphConnected && employees.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  <CloudOff className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">Microsoft Directory Not Connected</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] mx-auto">
                    Connect your organization account to search and select employees from Microsoft Entra ID.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectDirectory}
                    disabled={isConnecting || connecting}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    {isConnecting || connecting ? 'Connecting…' : 'Connect Microsoft'}
                  </button>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-slate-400">
                  <p>No employees matching “{searchQuery}”</p>
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected =
                    (selectedEmployee && selectedEmployee.id === emp.id) ||
                    valueId === emp.id ||
                    valueId === emp.localEmployeeId;

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleSelect(emp)}
                      className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/80 text-indigo-900 font-medium'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-slate-900 truncate">
                          {emp.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {emp.email || emp.userPrincipalName}
                          {emp.designation ? ` • ${emp.designation}` : ''}
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Status Bar with Explicit Connect Action */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span className="truncate flex items-center gap-1">
                {isGraphConnected ? (
                  <>
                    <Cloud className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>Microsoft Directory ({totalCount})</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Not Connected</span>
                  </>
                )}
              </span>

              <div className="flex items-center gap-2 shrink-0">
                {!isGraphConnected ? (
                  <button
                    type="button"
                    onClick={handleConnectDirectory}
                    disabled={isConnecting || connecting}
                    title="Connect your Microsoft account to access the organization employee directory"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    <Cloud className="w-3 h-3 mr-1" />
                    {isConnecting || connecting ? 'Connecting…' : 'Connect Microsoft'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => refresh(true)}
                    title="Refresh employee directory from Microsoft Graph"
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5 mr-1" />
                    Refresh
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
