/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { EmployeeAppreciation } from '@/types';
import {
  Card,
  Table,
  TableHead,
  TableHeadCell,
  TableRow,
  TableCell,
  SortableHeader,
  EmptyRow,
  RowActionButton,
} from '@/components/ui';
import { Building2, FolderKanban, Tag, User, Pencil, Trash2, Calendar } from 'lucide-react';
import { compareForSort, SortDirection } from '@/utils';

export interface EmployeeAppreciationTableProps {
  items: EmployeeAppreciation[];
  onEdit?: (item: EmployeeAppreciation) => void;
  onDelete?: (item: EmployeeAppreciation) => void;
  canManage?: boolean;
}

export const EmployeeAppreciationTable: React.FC<EmployeeAppreciationTableProps> = ({
  items,
  onEdit,
  onDelete,
  canManage = true,
}) => {
  const [sortField, setSortField] = useState<string>('receivedDate');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];
      if (sortField === 'receivedDate') {
        valA = a.receivedDate || '';
        valB = b.receivedDate || '';
      }
      return compareForSort(valA, valB, sortDir);
    });
    return list;
  }, [items, sortField, sortDir]);

  if (items.length === 0) {
    return null;
  }

  return (
    <Card padding="none" clip>
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableHeadCell columnId="employeeName">
              <SortableHeader
                label="Employee"
                field="employeeName"
                sortField={sortField}
                sortDirection={sortDir}
                onSort={handleSort}
              />
            </TableHeadCell>
            <TableHeadCell columnId="accountName">
              <SortableHeader
                label="Account / Project"
                field="accountName"
                sortField={sortField}
                sortDirection={sortDir}
                onSort={handleSort}
              />
            </TableHeadCell>
            <TableHeadCell align="center" columnId="internalExternal">
              <SortableHeader
                label="Source"
                field="internalExternal"
                sortField={sortField}
                sortDirection={sortDir}
                onSort={handleSort}
                className="justify-center"
              />
            </TableHeadCell>
            <TableHeadCell columnId="respondentName">
              <SortableHeader
                label="Given By"
                field="respondentName"
                sortField={sortField}
                sortDirection={sortDir}
                onSort={handleSort}
              />
            </TableHeadCell>
            <TableHeadCell columnId="receivedDate">
              <SortableHeader
                label="Date Received"
                field="receivedDate"
                sortField={sortField}
                sortDirection={sortDir}
                onSort={handleSort}
              />
            </TableHeadCell>
            <TableHeadCell columnId="feedback">Feedback Quote</TableHeadCell>
            {canManage && (onEdit || onDelete) && (
              <TableHeadCell align="center" sticky="right" columnId="actions">
                Actions
              </TableHeadCell>
            )}
          </TableHead>
          <tbody>
            {sortedItems.map((item) => {
              const isInternal = item.internalExternal === 'Internal';
              return (
                <TableRow key={item.id} className="hover:bg-slate-50/50">
                  {/* Employee */}
                  <TableCell className="font-extrabold text-slate-900">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-900">{item.employeeName}</span>
                      {item.empId && (
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">{item.empId}</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Account / Project */}
                  <TableCell>
                    <div className="flex flex-col text-xs space-y-0.5 min-w-[140px]">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.accountName || '—'}</span>
                      </div>
                      {item.projectName && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.projectName}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Source (Internal / External) */}
                  <TableCell align="center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isInternal
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      {item.internalExternal}
                    </span>
                  </TableCell>

                  {/* Given By */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.respondentName}</span>
                    </div>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="whitespace-nowrap font-mono text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.receivedDate}</span>
                    </div>
                  </TableCell>

                  {/* Feedback Quote */}
                  <TableCell className="max-w-[280px]">
                    <div className="text-xs text-slate-700 italic line-clamp-2 bg-slate-50/80 p-2 rounded-lg border border-slate-200/60 leading-relaxed font-medium">
                      "{item.feedback}"
                    </div>
                  </TableCell>

                  {/* Actions */}
                  {canManage && (onEdit || onDelete) && (
                    <TableCell align="center" sticky="right">
                      <div className="flex items-center justify-center gap-1">
                        {onEdit && (
                          <RowActionButton
                            intent="edit"
                            label={`Edit appreciation for ${item.employeeName}`}
                            icon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => onEdit(item)}
                          />
                        )}
                        {onDelete && (
                          <RowActionButton
                            intent="delete"
                            label={`Delete appreciation for ${item.employeeName}`}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => onDelete(item)}
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Card>
  );
};
