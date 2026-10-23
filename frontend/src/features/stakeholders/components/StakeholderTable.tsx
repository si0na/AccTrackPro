/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Account, NextConnectStatus, Stakeholder, StakeholderLevel, StakeholderType } from '@/types';
import { Mail, Phone, Linkedin, User } from 'lucide-react';
import { NEXT_CONNECT_STATUS_OPTIONS, STAKEHOLDER_LEVEL_OPTIONS, STAKEHOLDER_RELATIONSHIP_OPTIONS } from '@/constants';
import {
  Card,
  EmptyRow,
  FilterBar,
  INFLUENCE_COLORS,
  InlineTextEditCell,
  InlineSelectEditCell,
  InlineTextareaEditCell,
  NEXT_CONNECT_STATUS_COLORS,
  Pagination,
  RELATIONSHIP_COLORS,
  ROLE_IN_DECISION_COLORS,
  SearchBar,
  SortableHeader,
  StatusBadge,
  Table,
  TableActions,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
  computePinnedOffsets,
} from '@/components/ui';
import { compareForSort, SortDirection } from '@/utils';

export interface StakeholderTableProps {
  rows: Stakeholder[];
  type: StakeholderType; // 'CLIENT' | 'SERVICE_PROVIDER'
  resolveAccount: (id: string) => Account | undefined;
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: (s: Stakeholder) => void;
  onDelete?: (s: Stakeholder) => void;
  /** Row / name click — renders the name as a button (read-only "view details"). */
  onRowClick?: (s: Stakeholder) => void;
  /** Message shown when there are no rows to display. */
  emptyMessage: string;
  /** Hide the Account column (used inside a single account's detail page). */
  hideAccountColumn?: boolean;
  /** Persistence key suffix for resizable column widths. */
  storageKey?: string;
}

/**
 * A single stakeholder-type table with its OWN search, sort and pagination, so
 * Client Stakeholders and Service Providers filter and page completely
 * independently. Shared by the Stakeholders directory and the Account Details
 * stakeholders tab so both entry points look and behave identically.
 *
 * Client Stakeholders support customizable visible columns, pinned column offsets,
 * inline editing (including Next Connect date, Next Connect Status dropdown, Level,
 * Influence, Relationship, Department, Designation, Email, Phone, LinkedIn, and
 * narrative fields like Key Priorities, Pain Points, Action/Follow-ups, and Comments).
 *
 * Service Providers carry no Influence / Relationship dimension, so those
 * columns are omitted from that variant rather than rendered blank.
 */
export const StakeholderTable: React.FC<StakeholderTableProps> = ({
  rows,
  type,
  resolveAccount,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onRowClick,
  emptyMessage,
  hideAccountColumn = false,
  storageKey,
}) => {
  const { updateStakeholder, setActiveExportRows, stakeholdersColumnConfig } = useCRM();
  const isServiceProvider = type === 'SERVICE_PROVIDER';

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const displayedConfigs = useMemo(() => {
    if (isServiceProvider) return [];
    return stakeholdersColumnConfig
      .filter((c) => c.isDisplayed)
      .filter((c) => !hideAccountColumn || c.key !== 'accountId');
  }, [isServiceProvider, stakeholdersColumnConfig, hideAccountColumn]);

  const pinnedOffsets = useMemo(() => {
    if (isServiceProvider) return {};
    return computePinnedOffsets(displayedConfigs, storageKey || 'stakeholders-client');
  }, [isServiceProvider, displayedConfigs, storageKey]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortValue = (s: Stakeholder, key: string) => {
    if (key === 'name') return s.name || s.email || '';
    if (key === 'accountId') return resolveAccount(s.accountId)?.name || s.accountName || '';
    return (s as any)[key] ?? '';
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((s) => {
      if (!q) return true;
      const account = resolveAccount(s.accountId);
      if (s.pendingRegistration && 'pending registration'.includes(q)) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q) ||
        (s.area || '').toLowerCase().includes(q) ||
        (s.roleInDecision || '').toLowerCase().includes(q) ||
        (s.nextConnect || '').toLowerCase().includes(q) ||
        (s.nextConnectStatus || '').toLowerCase().includes(q) ||
        (s.level || '').toLowerCase().includes(q) ||
        (s.influence || '').toLowerCase().includes(q) ||
        (s.relationship || '').toLowerCase().includes(q) ||
        (s.primaryOwnerName || '').toLowerCase().includes(q) ||
        (s.secondaryOwnerName || '').toLowerCase().includes(q) ||
        (s.tertiaryOwnerName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.keyPriorities || '').toLowerCase().includes(q) ||
        (s.painPointsInsights || '').toLowerCase().includes(q) ||
        (s.actionFollowUps || '').toLowerCase().includes(q) ||
        (s.comments || '').toLowerCase().includes(q) ||
        (s.country || '').toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q) ||
        (account?.name || '').toLowerCase().includes(q)
      );
    });
  }, [rows, q, resolveAccount]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
      ),
    [filtered, sortField, sortDirection],
  );

  useEffect(() => {
    if (!isServiceProvider) {
      setActiveExportRows('stakeholders', sorted);
    }
  }, [sorted, isServiceProvider, setActiveExportRows]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const colSpan = isServiceProvider
    ? hideAccountColumn
      ? 7
      : 8
    : displayedConfigs.length + 1;

  const renderClientCell = (s: Stakeholder, account: Account | undefined, col: any) => {
    const stickyProps = {
      sticky: (col.isPinned ? 'left' : undefined) as 'left' | undefined,
      stickyLeft: pinnedOffsets[col.key],
    };

    if (col.key === 'name') {
      return (
        <TableCell key={col.key} {...stickyProps} className="font-extrabold text-slate-900">
          <span className="flex items-center gap-2">
            {onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(s)}
                className="text-left text-blue-600 hover:underline cursor-pointer"
              >
                {s.name || s.email}
              </button>
            ) : (
              s.name || s.email
            )}
            {s.pendingRegistration && (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700"
                title="Whitelisted employee who has not completed self-registration yet"
              >
                Pending Registration
              </span>
            )}
          </span>
        </TableCell>
      );
    }

    if (col.key === 'accountId') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-600 font-bold">
          {account?.name || s.accountName || 'Unknown'}
        </TableCell>
      );
    }

    if (col.key === 'department') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-500 font-semibold">
          <InlineTextEditCell
            value={s.department ?? ''}
            disabled={!canEdit}
            placeholder="—"
            onSave={async (val) => {
              await updateStakeholder({ ...s, department: val });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'designation') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-500 font-semibold">
          <InlineTextEditCell
            value={s.designation ?? ''}
            disabled={!canEdit}
            placeholder="Set designation…"
            onSave={async (val) => {
              await updateStakeholder({ ...s, designation: val });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'area') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-600 font-semibold">
          {s.area || <span className="text-slate-400 font-normal">—</span>}
        </TableCell>
      );
    }

    if (col.key === 'roleInDecision') {
      return (
        <TableCell key={col.key} {...stickyProps}>
          {s.roleInDecision ? (
            <StatusBadge value={s.roleInDecision} colorMap={ROLE_IN_DECISION_COLORS} shape="rounded" />
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'nextConnect') {
      return (
        <TableCell key={col.key} {...stickyProps} className="font-mono text-xs text-slate-600">
          <InlineTextEditCell
            type="date"
            value={s.nextConnect ? String(s.nextConnect).slice(0, 10) : ''}
            disabled={!canEdit}
            placeholder="—"
            onSave={async (val) => {
              await updateStakeholder({ ...s, nextConnect: val || undefined });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'nextConnectStatus') {
      return (
        <TableCell key={col.key} {...stickyProps} align="center">
          <InlineSelectEditCell
            value={s.nextConnectStatus || ''}
            options={NEXT_CONNECT_STATUS_OPTIONS}
            colorMap={NEXT_CONNECT_STATUS_COLORS}
            placeholder="—"
            disabled={!canEdit}
            onSave={async (val) => {
              await updateStakeholder({
                ...s,
                nextConnectStatus: (val as NextConnectStatus) || undefined,
              });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'level') {
      return (
        <TableCell key={col.key} {...stickyProps} align="center">
          <InlineSelectEditCell
            value={s.level || 'Level 3'}
            options={STAKEHOLDER_LEVEL_OPTIONS}
            disabled={!canEdit}
            onSave={async (val) => {
              await updateStakeholder({ ...s, level: val as StakeholderLevel });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'influence') {
      return (
        <TableCell key={col.key} {...stickyProps} align="center">
          <InlineSelectEditCell
            value={s.influence}
            options={['High', 'Medium', 'Low']}
            disabled={!canEdit}
            onSave={async (val) => {
              await updateStakeholder({ ...s, influence: val as any });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'relationship') {
      return (
        <TableCell key={col.key} {...stickyProps} align="center">
          <InlineSelectEditCell
            value={s.relationship}
            options={STAKEHOLDER_RELATIONSHIP_OPTIONS}
            colorMap={RELATIONSHIP_COLORS}
            disabled={!canEdit}
            onSave={async (val) => {
              await updateStakeholder({ ...s, relationship: val as any });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'primaryOwnerName') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-700 font-medium">
          {s.primaryOwnerName ? (
            <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <User className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />
              <span>{s.primaryOwnerName}</span>
            </span>
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'secondaryOwnerName') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-700 font-medium">
          {s.secondaryOwnerName ? (
            <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden="true" />
              <span>{s.secondaryOwnerName}</span>
            </span>
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'tertiaryOwnerName') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-700 font-medium">
          {s.tertiaryOwnerName || s.thirdOwnerName ? (
            <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span>{s.tertiaryOwnerName || s.thirdOwnerName}</span>
            </span>
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'email') {
      return (
        <TableCell key={col.key} {...stickyProps} className="select-all text-slate-500 hover:text-blue-500 transition-colors">
          <InlineTextEditCell
            value={s.email ?? ''}
            disabled={!canEdit}
            placeholder="Set email…"
            onSave={async (val) => {
              await updateStakeholder({ ...s, email: val });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'phone') {
      return (
        <TableCell key={col.key} {...stickyProps} className="font-mono select-all text-slate-500">
          <InlineTextEditCell
            value={s.phone ?? ''}
            disabled={!canEdit}
            placeholder="Set phone…"
            onSave={async (val) => {
              await updateStakeholder({ ...s, phone: val });
            }}
          />
        </TableCell>
      );
    }

    if (col.key === 'linkedinProfileUrl') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-500" onDoubleClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {s.linkedinProfileUrl ? (
              <a
                href={s.linkedinProfileUrl.startsWith('http') ? s.linkedinProfileUrl : `https://${s.linkedinProfileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold text-xs"
                title={s.linkedinProfileUrl}
              >
                <Linkedin className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[120px]">LinkedIn</span>
              </a>
            ) : null}
            <InlineTextEditCell
              value={s.linkedinProfileUrl ?? ''}
              placeholder={s.linkedinProfileUrl ? '' : 'Add LinkedIn…'}
              disabled={!canEdit}
              formatDisplay={() => ''}
              onSave={async (val) => {
                await updateStakeholder({ ...s, linkedinProfileUrl: val || undefined });
              }}
            />
          </div>
        </TableCell>
      );
    }

    // Four missing narrative columns
    if (col.key === 'keyPriorities') {
      return (
        <TableCell key={col.key} {...stickyProps} className="max-w-[240px]">
          {canEdit ? (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineTextareaEditCell
                value={s.keyPriorities}
                label="Key Priorities"
                placeholder="—"
                onSave={async (val) => {
                  await updateStakeholder({ ...s, keyPriorities: val });
                }}
              />
            </div>
          ) : (
            <span className="truncate block text-slate-600" title={s.keyPriorities || ''}>
              {s.keyPriorities || <span className="text-slate-400 font-normal">—</span>}
            </span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'painPointsInsights') {
      return (
        <TableCell key={col.key} {...stickyProps} className="max-w-[240px]">
          {canEdit ? (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineTextareaEditCell
                value={s.painPointsInsights}
                label="Pain Points / Insights"
                placeholder="—"
                onSave={async (val) => {
                  await updateStakeholder({ ...s, painPointsInsights: val });
                }}
              />
            </div>
          ) : (
            <span className="truncate block text-slate-600" title={s.painPointsInsights || ''}>
              {s.painPointsInsights || <span className="text-slate-400 font-normal">—</span>}
            </span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'actionFollowUps') {
      return (
        <TableCell key={col.key} {...stickyProps} className="max-w-[240px]">
          {canEdit ? (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineTextareaEditCell
                value={s.actionFollowUps}
                label="Action / Follow-ups"
                placeholder="—"
                onSave={async (val) => {
                  await updateStakeholder({ ...s, actionFollowUps: val });
                }}
              />
            </div>
          ) : (
            <span className="truncate block text-slate-600" title={s.actionFollowUps || ''}>
              {s.actionFollowUps || <span className="text-slate-400 font-normal">—</span>}
            </span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'comments') {
      return (
        <TableCell key={col.key} {...stickyProps} className="max-w-[240px]">
          {canEdit ? (
            <div onClick={(e) => e.stopPropagation()}>
              <InlineTextareaEditCell
                value={s.comments}
                label="Comments"
                placeholder="—"
                onSave={async (val) => {
                  await updateStakeholder({ ...s, comments: val });
                }}
              />
            </div>
          ) : (
            <span className="truncate block text-slate-600" title={s.comments || ''}>
              {s.comments || <span className="text-slate-400 font-normal">—</span>}
            </span>
          )}
        </TableCell>
      );
    }

    if (col.key === 'country') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-600 font-medium">
          {s.country || <span className="text-slate-400 font-normal">—</span>}
        </TableCell>
      );
    }

    if (col.key === 'location') {
      return (
        <TableCell key={col.key} {...stickyProps} className="text-slate-600 font-medium">
          {s.location || <span className="text-slate-400 font-normal">—</span>}
        </TableCell>
      );
    }

    if (col.key === 'estimatedBudgetAvailable') {
      return (
        <TableCell key={col.key} {...stickyProps} align="right" className="font-mono text-slate-700">
          {s.estimatedBudgetAvailable != null ? (
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(s.estimatedBudgetAvailable)
          ) : (
            <span className="text-slate-400 font-normal">—</span>
          )}
        </TableCell>
      );
    }

    return (
      <TableCell key={col.key} {...stickyProps} className="text-slate-600">
        {String((s as any)[col.key] ?? '') || <span className="text-slate-400 font-normal">—</span>}
      </TableCell>
    );
  };

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchBar
          value={searchQuery}
          onChange={(v) => {
            setSearchQuery(v);
            setPage(1);
          }}
          placeholder={
            isServiceProvider
              ? 'Search service providers by name, designation, department...'
              : 'Search stakeholders by name, designation, department...'
          }
          className="flex-1 min-w-[240px]"
        />
      </FilterBar>

      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable={!!storageKey} storageKey={storageKey}>
            {isServiceProvider ? (
              <TableHead>
                <TableHeadCell>
                  <SortableHeader
                    label="Name"
                    field="name"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                {!hideAccountColumn && (
                  <TableHeadCell>
                    <SortableHeader
                      label="Account"
                      field="accountId"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHeadCell>
                )}
                <TableHeadCell>
                  <SortableHeader
                    label="Department"
                    field="department"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader
                    label="Designation"
                    field="designation"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader
                    label="Email"
                    field="email"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader
                    label="Phone"
                    field="phone"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                <TableHeadCell>
                  <SortableHeader
                    label="LinkedIn"
                    field="linkedinProfileUrl"
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                <TableHeadCell align="center" sticky="right">
                  Actions
                </TableHeadCell>
              </TableHead>
            ) : (
              <TableHead>
                {displayedConfigs.map((col) => (
                  <TableHeadCell
                    key={col.key}
                    columnId={col.key}
                    align={
                      ['nextConnectStatus', 'level', 'influence', 'relationship'].includes(col.key)
                        ? 'center'
                        : col.type === 'number'
                        ? 'right'
                        : 'left'
                    }
                    sticky={col.isPinned ? 'left' : undefined}
                    stickyLeft={pinnedOffsets[col.key]}
                  >
                    <SortableHeader
                      label={col.name}
                      field={col.key}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      className={
                        ['nextConnectStatus', 'level', 'influence', 'relationship'].includes(col.key)
                          ? 'justify-center w-full'
                          : col.type === 'number'
                          ? 'justify-end w-full'
                          : ''
                      }
                    />
                  </TableHeadCell>
                ))}
                <TableHeadCell align="center" sticky="right">
                  Actions
                </TableHeadCell>
              </TableHead>
            )}

            <tbody>
              {sorted.length === 0 ? (
                <EmptyRow colSpan={colSpan} message={emptyMessage} />
              ) : (
                paged.map((s) => {
                  const account = resolveAccount(s.accountId);

                  if (isServiceProvider) {
                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-extrabold text-slate-900">
                          <span className="flex items-center gap-2">
                            {onRowClick ? (
                              <button
                                type="button"
                                onClick={() => onRowClick(s)}
                                className="text-left text-blue-600 hover:underline cursor-pointer"
                              >
                                {s.name || s.email}
                              </button>
                            ) : (
                              s.name || s.email
                            )}
                            {s.pendingRegistration && (
                              <span
                                className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700"
                                title="Whitelisted employee who has not completed self-registration yet"
                              >
                                Pending Registration
                              </span>
                            )}
                          </span>
                        </TableCell>
                        {!hideAccountColumn && (
                          <TableCell className="text-slate-600 font-bold">
                            {account?.name || s.accountName || 'Unknown'}
                          </TableCell>
                        )}
                        <TableCell className="text-slate-500 font-semibold">
                          <InlineTextEditCell
                            value={s.department ?? ''}
                            disabled={!canEdit}
                            placeholder="—"
                            onSave={async (val) => {
                              await updateStakeholder({ ...s, department: val });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-slate-500 font-semibold">
                          <InlineTextEditCell
                            value={s.designation ?? ''}
                            disabled={!canEdit}
                            placeholder="Set designation…"
                            onSave={async (val) => {
                              await updateStakeholder({ ...s, designation: val });
                            }}
                          />
                        </TableCell>
                        <TableCell className="select-all text-slate-500 hover:text-blue-500 transition-colors">
                          <InlineTextEditCell
                            value={s.email ?? ''}
                            disabled={!canEdit}
                            placeholder="Set email…"
                            onSave={async (val) => {
                              await updateStakeholder({ ...s, email: val });
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono select-all text-slate-500">
                          <InlineTextEditCell
                            value={s.phone ?? ''}
                            disabled={!canEdit}
                            placeholder="Set phone…"
                            onSave={async (val) => {
                              await updateStakeholder({ ...s, phone: val });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-slate-500" onDoubleClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {s.linkedinProfileUrl ? (
                              <a
                                href={
                                  s.linkedinProfileUrl.startsWith('http')
                                    ? s.linkedinProfileUrl
                                    : `https://${s.linkedinProfileUrl}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold text-xs"
                                title={s.linkedinProfileUrl}
                              >
                                <Linkedin className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                                <span className="truncate max-w-[120px]">LinkedIn</span>
                              </a>
                            ) : null}
                            <InlineTextEditCell
                              value={s.linkedinProfileUrl ?? ''}
                              placeholder={s.linkedinProfileUrl ? '' : 'Add LinkedIn…'}
                              disabled={!canEdit}
                              formatDisplay={() => ''}
                              onSave={async (val) => {
                                await updateStakeholder({ ...s, linkedinProfileUrl: val || undefined });
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell align="center" sticky="right">
                          <TableActions
                            entityLabel={`stakeholder ${s.name}`}
                            onEdit={canEdit && onEdit ? () => onEdit(s) : undefined}
                            onDelete={canDelete && onDelete ? () => onDelete(s) : undefined}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      {displayedConfigs.map((col) => renderClientCell(s, account, col))}
                      <TableCell align="center" sticky="right">
                        <TableActions
                          entityLabel={`stakeholder ${s.name}`}
                          onEdit={canEdit && onEdit ? () => onEdit(s) : undefined}
                          onDelete={canDelete && onDelete ? () => onDelete(s) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel={isServiceProvider ? 'service providers' : 'stakeholders'}
        />
      </Card>
    </div>
  );
};
