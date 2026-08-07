/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Account, Stakeholder, StakeholderType } from '@/types';
import { Mail, Phone } from 'lucide-react';
import {
  Card,
  EmptyRow,
  FilterBar,
  INFLUENCE_COLORS,
  Pagination,
  RELATIONSHIP_COLORS,
  SearchBar,
  SortableHeader,
  StatusBadge,
  Table,
  TableActions,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
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
 * Service Providers carry no Influence / Relationship dimension, so those
 * columns are omitted from that variant rather than rendered blank.
 */
export const StakeholderTable: React.FC<StakeholderTableProps> = ({
  rows, type, resolveAccount, canEdit, canDelete, onEdit, onDelete, onRowClick, emptyMessage,
  hideAccountColumn = false, storageKey,
}) => {
  const isServiceProvider = type === 'SERVICE_PROVIDER';

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDirection('asc'); }
  };

  const getSortValue = (s: Stakeholder, key: string) => {
    if (key === 'accountId') return resolveAccount(s.accountId)?.name || s.accountName || '';
    return (s as any)[key];
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => rows.filter(s => {
    if (!q) return true;
    const account = resolveAccount(s.accountId);
    return s.name.toLowerCase().includes(q) ||
      s.designation.toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (account?.name || '').toLowerCase().includes(q);
  }), [rows, q, resolveAccount]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareForSort(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection)),
    [filtered, sortField, sortDirection],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Columns: Name, [Account], Department, Designation, [Influence, Relationship], Email, Phone, Actions
  let colSpan = isServiceProvider ? 7 : 9;
  if (hideAccountColumn) colSpan -= 1;

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchBar
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setPage(1); }}
          placeholder={isServiceProvider
            ? 'Search service providers by name, designation, department...'
            : 'Search stakeholders by name, designation, department...'}
          className="flex-1 min-w-[240px]"
        />
      </FilterBar>

      <Card padding="none" clip>
        <div className="overflow-x-auto">
          <Table resizable={!!storageKey} storageKey={storageKey}>
            <TableHead>
              <TableHeadCell><SortableHeader label="Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              {!hideAccountColumn && (
                <TableHeadCell><SortableHeader label={isServiceProvider ? 'Account' : 'Client Account'} field="accountId" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              )}
              <TableHeadCell><SortableHeader label="Department" field="department" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Designation" field="designation" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              {!isServiceProvider && (
                <>
                  <TableHeadCell align="center"><SortableHeader label="Interest" field="influence" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" /></TableHeadCell>
                  <TableHeadCell align="center"><SortableHeader label="Relationship" field="relationship" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="justify-center w-full" /></TableHeadCell>
                </>
              )}
              <TableHeadCell><SortableHeader label="Email" field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell><SortableHeader label="Phone" field="phone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /></TableHeadCell>
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {sorted.length === 0 ? (
                <EmptyRow colSpan={colSpan} message={emptyMessage} />
              ) : (
                paged.map(s => {
                  const account = resolveAccount(s.accountId);
                  return (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-extrabold text-slate-900">
                        {onRowClick ? (
                          <button
                            type="button"
                            onClick={() => onRowClick(s)}
                            className="text-left text-blue-600 hover:underline cursor-pointer"
                          >
                            {s.name}
                          </button>
                        ) : (
                          s.name
                        )}
                      </TableCell>
                      {!hideAccountColumn && (
                        <TableCell className="text-slate-600 font-bold">{account?.name || s.accountName || 'Unknown'}</TableCell>
                      )}
                      <TableCell className="text-slate-500 font-semibold">{s.department || '—'}</TableCell>
                      <TableCell className="text-slate-500 font-semibold">{s.designation}</TableCell>
                      {!isServiceProvider && (
                        <>
                          <TableCell align="center">
                            <StatusBadge value={s.influence} colorMap={INFLUENCE_COLORS} shape="rounded" />
                          </TableCell>
                          <TableCell align="center">
                            <StatusBadge value={s.relationship} colorMap={RELATIONSHIP_COLORS} />
                          </TableCell>
                        </>
                      )}
                      <TableCell className="select-all text-slate-500 hover:text-blue-500 transition-colors">
                        <a href={`mailto:${s.email}`} className="flex items-center space-x-1 font-semibold">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[150px]">{s.email}</span>
                        </a>
                      </TableCell>
                      <TableCell className="font-mono select-all text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>{s.phone}</span>
                        </span>
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
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          itemLabel={isServiceProvider ? 'service providers' : 'stakeholders'}
        />
      </Card>
    </div>
  );
};
